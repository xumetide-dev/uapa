import type { UapaConfig } from 'uapa'

export default {
  name: 'components',
  version: '0.1.0',
  description: 'agents 与 MCP 服务器、不配守卫，配置四个目标、默认布局的夹具',
  author: { name: 'UAPA Fixtures' },
  targets: [
    'claude-code:in-process',
    'claude-code:subprocess',
    'codex:subprocess',
    'agy:subprocess',
  ],
} satisfies UapaConfig
