import type { UapaConfig } from 'uapa'

export default {
  name: 'host-coverage',
  version: '0.1.0',
  description: 'v0.4.0 补齐的宿主能力，配置四个目标、默认布局的夹具',
  author: { name: 'UAPA Fixtures' },
  targets: [
    'claude-code:in-process',
    'claude-code:subprocess',
    'codex:subprocess',
    'agy:subprocess',
  ],
  hosts: {
    'claude-code': {
      manifest: { homepage: 'https://example.com/host-coverage', license: 'MIT' },
    },
  },
} satisfies UapaConfig
