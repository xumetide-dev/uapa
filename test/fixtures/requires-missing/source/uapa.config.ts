import type { UapaConfig } from 'uapa'

export default {
  name: 'requires-missing',
  version: '0.1.0',
  description: '守卫 requires promptGate，配置三个子进程目标的夹具（TA-04）',
  author: { name: 'UAPA Fixtures' },
  targets: ['claude-code:subprocess', 'codex:subprocess', 'agy:subprocess'],
  guard: 'guard.ts',
} satisfies UapaConfig
