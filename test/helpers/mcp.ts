// MCP 服务器的规范形式（F-01-08）：与 components 夹具的 mcp/servers.json 相同的四个服务器，
// 按名称排序。只比对生成的配置，不启动服务器
import type { McpServer } from '../../src/source/types.ts'

export const SERVERS: readonly McpServer[] = [
  {
    name: 'docs',
    kind: 'local',
    command: 'node',
    args: ['{pluginRoot}/mcp/server.mjs'],
    env: { UAPA_DATA: '{pluginRoot}/data' },
  },
  { name: 'launcher', kind: 'local', command: '{pluginRoot}/mcp/run.sh' },
  { name: 'plain', kind: 'local', command: 'uapa-mcp-probe', args: ['--stdio'] },
  {
    name: 'remote',
    kind: 'remote',
    url: 'http://127.0.0.1:9/mcp',
    headers: { 'X-Uapa-Probe': 'uapa-header-probe' },
  },
]

export const REMOTE = {
  url: 'http://127.0.0.1:9/mcp',
  headers: { 'X-Uapa-Probe': 'uapa-header-probe' },
}
