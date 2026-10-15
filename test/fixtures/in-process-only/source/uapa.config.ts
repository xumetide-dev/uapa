import type { UapaConfig } from 'uapa'

export default {
  name: 'module-guard',
  version: '0.1.0',
  description: '只配置 claude-code:in-process、守卫只实现执行前检查的夹具',
  author: { name: 'UAPA Fixtures' },
  targets: ['claude-code:in-process'],
  guard: 'guard.ts',
} satisfies UapaConfig
