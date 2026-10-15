// mcp.json（F-06-06，SD-30）：manifest 的 mcpServers 指向它。Codex 不展开 MCP 配置中的占位符，
// 本地服务器不经 shell 启动；相对的 cwd 拼到插件目录下；请求头字段为 http_headers
// （codex-source-review.md「插件中的 MCP 服务器」，rust-v0.162.1）。
import type { McpServer } from '../../source/types.ts'
import type { TargetSkip } from '../types.ts'

export const MCP_FILE = 'mcp.json'

const TARGET = 'codex:subprocess'
const PLUGIN_ROOT = '{pluginRoot}'
const SKIP_REASON =
  'Codex 不展开 MCP 配置中的插件根，command 中的 {pluginRoot} 不能换算'

// 以插件目录为工作目录（cwd 为 .）时，参数与环境变量中的插件根写作 .
function withRoot(text: string): string {
  return text.split(PLUGIN_ROOT).join('.')
}

// 键序固定：type 在前；本地服务器为 command、args、env、cwd，远程服务器为 url、http_headers
function entry(server: McpServer): Record<string, unknown> {
  if (server.kind === 'remote') {
    const { url, headers } = server
    return {
      type: 'http',
      url,
      ...(headers === undefined ? {} : { http_headers: headers }),
    }
  }
  const { command, args, env } = server
  const values = [...(args ?? []), ...Object.values(env ?? {})]
  const usesRoot = values.some(value => value.includes(PLUGIN_ROOT))
  return {
    type: 'stdio',
    command,
    ...(args === undefined ? {} : { args: args.map(withRoot) }),
    ...(env === undefined
      ? {}
      : {
          env: Object.fromEntries(
            Object.entries(env).map(([key, value]) => [key, withRoot(value)]),
          ),
        }),
    ...(usesRoot ? { cwd: '.' } : {}),
  }
}

export interface McpOutput {
  readonly config: { mcpServers: Record<string, unknown> } | null // 没有可写的服务器时为 null
  readonly skipped: readonly TargetSkip[]
}

// servers 已按名称排序；command 含 {pluginRoot} 的服务器不写入，列为跳过
export function mcpConfig(servers: readonly McpServer[]): McpOutput {
  const skipped: TargetSkip[] = []
  const entries: [string, Record<string, unknown>][] = []
  for (const server of servers) {
    if (server.kind === 'local' && server.command.includes(PLUGIN_ROOT)) {
      const component = `mcpServers.${server.name}`
      skipped.push({ target: TARGET, component, reason: SKIP_REASON })
    } else {
      entries.push([server.name, entry(server)])
    }
  }
  const config =
    entries.length === 0 ? null : { mcpServers: Object.fromEntries(entries) }
  return { config, skipped }
}
