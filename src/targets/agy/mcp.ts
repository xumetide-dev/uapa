// mcp_config.json（F-11-08，SD-30）：插件根的 MCP 配置，顶层为 mcpServers。服务器以插件目录为
// 工作目录，参数与环境变量中的插件根写作 .；远程服务器的地址字段为 serverUrl，不支持 url
// （agy-plugins.md「组件」与 agy-local-tests.md「agents 与 MCP 服务器（1.3.5，容器）」）。
// command 中的 ${extensionPath} 与 ${PLUGIN_ROOT} 都不展开，本地服务器继承会话环境，envVars
// 不写（F-11-12，SD-40；agy-local-tests.md「v0.4.0 覆盖审查（1.3.5，容器）」）。
import type { McpServer } from '../../source/types.ts'
import type { TargetSkip } from '../types.ts'

export const MCP_FILE = 'mcp_config.json'

const TARGET = 'agy:subprocess'
const PLUGIN_ROOT = '{pluginRoot}'
const SKIP_REASON =
  'agy 不展开 MCP 配置中的插件根，command 的相对路径按哪个目录解析依赖平台，' +
  'command 中的 {pluginRoot} 不能换算'
const LITERAL_RISK = '含 ${：agy 不展开 MCP 配置中的变量，按字面传递'
const USER_CONFIG_PREFIX = '${user_config.'
const USER_CONFIG_RISK = '含 ${user_config.：agy 不展开用户配置占位符，已从 env 中剥离'

function withRoot(text: string): string {
  return text.split(PLUGIN_ROOT).join('.')
}

// 剥离含 ${user_config. 的 env 项（F-11-15，SD-49）
function retainedEnv(
  env: Readonly<Record<string, string>> | undefined,
): [string, string][] {
  return Object.entries(env ?? {}).filter(
    ([, value]) => !value.includes(USER_CONFIG_PREFIX),
  )
}

// 键序固定：本地服务器为 command、args、env，远程服务器为 serverUrl、headers
function entry(server: McpServer): Record<string, unknown> {
  if (server.kind === 'remote') {
    const { url, headers } = server
    return { serverUrl: url, ...(headers === undefined ? {} : { headers }) }
  }
  const { command, args, env } = server
  const retained = retainedEnv(env)
  return {
    command,
    ...(args === undefined ? {} : { args: args.map(withRoot) }),
    ...(retained.length === 0
      ? {}
      : {
          env: Object.fromEntries(
            retained.map(([key, value]) => [key, withRoot(value)]),
          ),
        }),
  }
}

export interface McpOutput {
  readonly config: { mcpServers: Record<string, unknown> } | null // 没有可写的服务器时为 null
  readonly skipped: readonly TargetSkip[]
  readonly risks: readonly string[] // 只针对写入的服务器
}

// servers 已按名称排序；command 含 {pluginRoot} 的服务器不写入，列为跳过
export function mcpConfig(servers: readonly McpServer[]): McpOutput {
  const skipped: TargetSkip[] = []
  const written: McpServer[] = []
  for (const server of servers) {
    if (server.kind === 'local' && server.command.includes(PLUGIN_ROOT)) {
      const component = `mcpServers.${server.name}`
      skipped.push({ target: TARGET, component, reason: SKIP_REASON })
    } else {
      written.push(server)
    }
  }
  const config =
    written.length === 0
      ? null
      : { mcpServers: Object.fromEntries(written.map(s => [s.name, entry(s)])) }
  return { config, skipped, risks: risks(written) }
}

function risks(written: readonly McpServer[]): string[] {
  const messages: string[] = []
  const stripped = written.flatMap(strippedFields)
  if (stripped.length > 0) {
    messages.push(`MCP 服务器的字段 ${stripped.join('、')} ${USER_CONFIG_RISK}`)
  }
  const literal = written.flatMap(literalFields)
  if (literal.length > 0) {
    messages.push(`MCP 服务器的字段 ${literal.join('、')} ${LITERAL_RISK}`)
  }
  return messages
}

function strippedFields(server: McpServer): string[] {
  if (server.kind !== 'local') return []
  return Object.entries(server.env ?? {})
    .filter(([, text]) => text.includes(USER_CONFIG_PREFIX))
    .map(([key]) => `mcpServers.${server.name}.env.${key}`)
}

// 含 ${ 的保留字段，路径与读取 mcp/servers.json 时的错误相同，如 mcpServers.docs.args[0]
function literalFields(server: McpServer): string[] {
  const at = `mcpServers.${server.name}`
  const map = (field: string, values: Readonly<Record<string, string>> = {}) =>
    Object.entries(values).map(
      ([key, text]) => [`${at}.${field}.${key}`, text] as const,
    )
  const fields =
    server.kind === 'remote'
      ? [[`${at}.url`, server.url] as const, ...map('headers', server.headers)]
      : [
          [`${at}.command`, server.command] as const,
          ...(server.args ?? []).map((text, i) => [`${at}.args[${i}]`, text] as const),
          ...retainedEnv(server.env).map(
            ([key, text]) => [`${at}.env.${key}`, text] as const,
          ),
        ]
  return fields.filter(([, text]) => text.includes('${')).map(([field]) => field)
}
