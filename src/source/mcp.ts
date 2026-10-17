// 读取 MCP 服务器（F-01-08，SD-30）：mcp/servers.json 的顶层只有 mcpServers，值为服务器名到
// 配置的映射。本地服务器为 command（必填）、args、env、envVars（F-01-13，SD-40），远程服务器为
// url（必填）、headers；{pluginRoot} 只用于本地服务器，由各宿主模块换算。
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { failed, type InputIssue, type Loaded, loaded } from '../config/issues.ts'
import { compare } from './files.ts'
import type { McpServer } from './types.ts'

const FILE = 'mcp/servers.json'
const PLUGIN_ROOT = '{pluginRoot}'
const LOCAL_FIELDS = ['command', 'args', 'env']
const REMOTE_FIELDS = ['url', 'headers']
// 只用于本地服务器；不参与本地与远程的判断，远程服务器写它时单独报错
const ENV_VARS = 'envVars'
const SERVER_NAME = /^[A-Za-z0-9_-]+$/
const ENV_VAR_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

type Fields = Readonly<Record<string, unknown>>

function isRecord(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function readMcpServers(
  root: string,
): Promise<Loaded<readonly McpServer[]>> {
  const text = await readText(join(root, ...FILE.split('/')))
  if (text === null) return loaded([])
  if (typeof text !== 'string') return failed([text])
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return failed([{ file: FILE, field: null, message: `不是有效的 JSON：${message}` }])
  }
  const issues: InputIssue[] = []
  const servers = readServers(value, issues)
  if (issues.length > 0) return failed(issues)
  return loaded(servers.sort((a, b) => compare(a.name, b.name)))
}

// 文件不存在时为 null；mcp 不是目录或 servers.json 不是文件时为 InputIssue
async function readText(path: string): Promise<string | InputIssue | null> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    const code = (error as { code?: unknown }).code
    if (code === 'ENOENT') return null
    if (code === 'ENOTDIR') return { file: 'mcp', field: null, message: 'mcp 应为目录' }
    if (code === 'EISDIR') return { file: FILE, field: null, message: '应为文件' }
    throw error
  }
}

function readServers(value: unknown, issues: InputIssue[]): McpServer[] {
  const issue = (field: string | null, message: string) =>
    issues.push({ file: FILE, field, message })
  if (!isRecord(value)) {
    issue(null, '顶层应为对象')
    return []
  }
  for (const key of Object.keys(value).filter(k => k !== 'mcpServers')) {
    issue(key, '未知字段，顶层只有 mcpServers')
  }
  const map = value.mcpServers
  if (!isRecord(map)) {
    issue('mcpServers', '应为服务器名到配置的映射')
    return []
  }
  const servers: McpServer[] = []
  for (const [name, config] of Object.entries(map)) {
    const server = readServer(name, config, issue)
    if (server !== null) servers.push(server)
  }
  return servers
}

type Issue = (field: string | null, message: string) => void

function readServer(name: string, config: unknown, issue: Issue): McpServer | null {
  const at = `mcpServers.${name}`
  if (!SERVER_NAME.test(name)) issue(at, '服务器名只能含字母、数字、_、-')
  if (!isRecord(config)) {
    issue(at, '应为对象')
    return null
  }
  const keys = Object.keys(config)
  for (const key of keys.filter(
    k => ![...LOCAL_FIELDS, ...REMOTE_FIELDS, ENV_VARS].includes(k),
  )) {
    issue(`${at}.${key}`, '未知字段')
  }
  const local = keys.some(k => LOCAL_FIELDS.includes(k))
  const remote = keys.some(k => REMOTE_FIELDS.includes(k))
  if (local && remote) {
    issue(at, '本地服务器（command、args、env）与远程服务器（url、headers）的字段混用')
    return null
  }
  return remote ? readRemote(name, config, issue) : readLocal(name, config, issue)
}

function readLocal(name: string, config: Fields, issue: Issue): McpServer | null {
  const at = `mcpServers.${name}`
  const { command, args, env, envVars } = config
  const ok = [
    isText(command, `${at}.command`, issue),
    args === undefined || isTextList(args, `${at}.args`, issue),
    env === undefined || isTextMap(env, `${at}.env`, issue),
    envVars === undefined || isEnvVarList(envVars, `${at}.envVars`, issue),
  ].every(Boolean)
  if (!ok) return null
  return {
    name,
    kind: 'local',
    command: command as string,
    ...(args === undefined ? {} : { args: [...(args as string[])] }),
    ...(env === undefined ? {} : { env: { ...(env as Record<string, string>) } }),
    ...(envVars === undefined ? {} : { envVars: [...(envVars as string[])] }),
  }
}

function readRemote(name: string, config: Fields, issue: Issue): McpServer | null {
  const at = `mcpServers.${name}`
  const { url, headers } = config
  if (config.envVars !== undefined) issue(`${at}.envVars`, '只用于本地服务器')
  const urlOk = isText(url, `${at}.url`, issue) && noPluginRoot(url, `${at}.url`, issue)
  let headersOk = headers === undefined || isTextMap(headers, `${at}.headers`, issue)
  if (headersOk && headers !== undefined) {
    // 逐个检查，每个引用插件根的请求头各记一条
    const checks = Object.entries(headers as Record<string, string>).map(
      ([key, text]) => noPluginRoot(text, `${at}.headers.${key}`, issue),
    )
    headersOk = checks.every(Boolean)
  }
  if (!urlOk || !headersOk || config.envVars !== undefined) return null
  return {
    name,
    kind: 'remote',
    url: url as string,
    ...(headers === undefined
      ? {}
      : { headers: { ...(headers as Record<string, string>) } }),
  }
}

function isText(value: unknown, field: string, issue: Issue): value is string {
  if (typeof value === 'string' && value.trim() !== '') return true
  issue(field, '应为非空字符串')
  return false
}

function isTextList(value: unknown, field: string, issue: Issue): boolean {
  if (!Array.isArray(value)) {
    issue(field, '应为字符串数组')
    return false
  }
  const bad = value.flatMap((item, index) => (typeof item === 'string' ? [] : [index]))
  for (const index of bad) issue(`${field}[${index}]`, '应为字符串')
  return bad.length === 0
}

function isTextMap(value: unknown, field: string, issue: Issue): boolean {
  if (!isRecord(value)) {
    issue(field, '应为字符串到字符串的映射')
    return false
  }
  const bad = Object.keys(value).filter(key => typeof value[key] !== 'string')
  for (const key of bad) issue(`${field}.${key}`, '应为字符串')
  return bad.length === 0
}

// 非空；每个元素为变量名且不重复，错误写到元素
function isEnvVarList(value: unknown, field: string, issue: Issue): boolean {
  if (!Array.isArray(value) || value.length === 0) {
    issue(field, '应为非空的字符串数组')
    return false
  }
  let ok = true
  for (const [index, item] of value.entries()) {
    const first = value.indexOf(item)
    if (typeof item !== 'string' || !ENV_VAR_NAME.test(item)) {
      issue(`${field}[${index}]`, '应为变量名：以字母或 _ 开头，只含字母、数字、_')
      ok = false
    } else if (first < index) {
      issue(`${field}[${index}]`, `与 ${field}[${first}] 重复`)
      ok = false
    }
  }
  return ok
}

// 远程服务器的地址与请求头不经插件目录解析，不能引用插件根
function noPluginRoot(text: string, field: string, issue: Issue): boolean {
  if (!text.includes(PLUGIN_ROOT)) return true
  issue(field, '远程服务器不能使用 {pluginRoot}')
  return false
}
