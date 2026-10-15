import type { UapaConfig } from 'uapa'

export default {
  name: 'guard-options',
  version: '0.1.0',
  description:
    '守卫选项：守卫声明 number、boolean、string 各一个选项，配置四个目标、默认布局的夹具',
  author: { name: 'UAPA Fixtures' },
  targets: [
    'claude-code:in-process',
    'claude-code:subprocess',
    'codex:subprocess',
    'agy:subprocess',
  ],
  guard: 'guard.ts',
} satisfies UapaConfig
