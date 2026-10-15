import type { UapaConfig } from 'uapa'

export default {
  name: 'full-guard',
  version: '0.1.0',
  description: 'skills 与守卫，配置四个目标、默认布局的夹具',
  author: { name: 'UAPA Fixtures' },
  targets: [
    'claude-code:in-process',
    'claude-code:subprocess',
    'codex:subprocess',
    'agy:subprocess',
  ],
  guard: 'guard.ts',
} satisfies UapaConfig
