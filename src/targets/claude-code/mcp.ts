// .mcp.json（F-05-12，SD-30）：插件根的 MCP 配置。宿主展开 command、args 与 env 中的
// ${CLAUDE_PLUGIN_ROOT}，远程服务器须写 type: "http"（claude-code-local-tests.md「MCP 服务器与
// agents」，2.1.296 实测）。本地服务器继承会话环境，envVars 不写，其他 ${…} 由宿主展开
// （F-05-26，SD-40；同文「v0.4.0 覆盖审查（2.1.296，容器）」）。
import type { McpServer } from '../../source/types.ts'

export const MCP_FILE = '.mcp.json'

const PLUGIN_ROOT = `\${CLAUDE_PLUGIN_ROOT}`

function withRoot(text: string): string {
  return text.split('{pluginRoot}').join(PLUGIN_ROOT)
}

// 键序固定：本地服务器为 command、args、env，远程服务器为 type、url、headers；未写的字段不写
function entry(server: McpServer): Record<string, unknown> {
  if (server.kind === 'remote') {
    const { url, headers } = server
    return { type: 'http', url, ...(headers === undefined ? {} : { headers }) }
  }
  const { command, args, env } = server
  return {
    command: withRoot(command),
    ...(args === undefined ? {} : { args: args.map(withRoot) }),
    ...(env === undefined
      ? {}
      : {
          env: Object.fromEntries(
            Object.entries(env).map(([key, value]) => [key, withRoot(value)]),
          ),
        }),
  }
}

// servers 已按名称排序；没有服务器时为 null，不生成该文件
export function mcpConfig(
  servers: readonly McpServer[],
): { mcpServers: Record<string, unknown> } | null {
  if (servers.length === 0) return null
  return { mcpServers: Object.fromEntries(servers.map(s => [s.name, entry(s)])) }
}
