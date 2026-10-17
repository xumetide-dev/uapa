// MCP 服务器配置的字段校验（F-01-08、F-01-13、F-01-15，SD-30、SD-40、SD-49）：
// 字符串、字符串数组、映射、环境变量名列表、{pluginRoot} 检查与服务器级 targets。
import { isTargetName, type TargetName } from '../config/targets.ts'

const PLUGIN_ROOT = '{pluginRoot}'
const ENV_VAR_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

export type Fields = Readonly<Record<string, unknown>>
export type Issue = (field: string | null, message: string) => void

export function isRecord(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isText(value: unknown, field: string, issue: Issue): value is string {
  if (typeof value === 'string' && value.trim() !== '') return true
  issue(field, '应为非空字符串')
  return false
}

export function isTextList(value: unknown, field: string, issue: Issue): boolean {
  if (!Array.isArray(value)) {
    issue(field, '应为字符串数组')
    return false
  }
  const bad = value.flatMap((item, index) => (typeof item === 'string' ? [] : [index]))
  for (const index of bad) issue(`${field}[${index}]`, '应为字符串')
  return bad.length === 0
}

export function isTextMap(value: unknown, field: string, issue: Issue): boolean {
  if (!isRecord(value)) {
    issue(field, '应为字符串到字符串的映射')
    return false
  }
  const bad = Object.keys(value).filter(key => typeof value[key] !== 'string')
  for (const key of bad) issue(`${field}.${key}`, '应为字符串')
  return bad.length === 0
}

// 非空；每个元素为变量名且不重复，错误写到元素
export function isEnvVarList(value: unknown, field: string, issue: Issue): boolean {
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
export function noPluginRoot(text: string, field: string, issue: Issue): boolean {
  if (!text.includes(PLUGIN_ROOT)) return true
  issue(field, '远程服务器不能使用 {pluginRoot}')
  return false
}

// mcp/servers.json 的服务器级 targets（F-01-15，SD-49）：非空、不重复、只含已登记目标名；
// 未写为 null，校验不通过为 false
export function readMcpTargets(
  value: unknown,
  field: string,
  issue: (field: string, message: string) => void,
): readonly TargetName[] | null | false {
  if (value === undefined) return null
  if (!Array.isArray(value) || value.length === 0) {
    issue(field, '应为非空的目标名列表')
    return false
  }
  let ok = true
  value.forEach((target, index) => {
    const first = value.indexOf(target)
    if (!isTargetName(target)) {
      issue(`${field}[${index}]`, `未知目标名 ${JSON.stringify(target)}`)
      ok = false
    } else if (first < index) {
      issue(`${field}[${index}]`, `与 ${field}[${first}] 重复`)
      ok = false
    }
  })
  return ok ? (value as TargetName[]) : false
}
