import type { UapaConfig } from 'uapa'

export default {
  name: 'unknown-override',
  version: '0.1.0',
  description: '只配置 claude-code:subprocess 却存在 overrides/codex/ 的夹具',
  author: { name: 'UAPA Fixtures' },
  targets: ['claude-code:subprocess'],
} satisfies UapaConfig
