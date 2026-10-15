import type { UapaConfig } from 'uapa'

export default {
  name: 'after-tool-guard',
  version: '0.1.0',
  description:
    '执行后检查：守卫实现 beforeTool 与 afterTool，配置四个目标、默认布局的夹具',
  author: { name: 'UAPA Fixtures' },
  targets: [
    'claude-code:in-process',
    'claude-code:subprocess',
    'codex:subprocess',
    'agy:subprocess',
  ],
  guard: 'guard.ts',
} satisfies UapaConfig
