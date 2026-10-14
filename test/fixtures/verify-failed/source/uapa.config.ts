import type { UapaConfig } from 'uapa'

export default {
  name: 'verify-failed',
  version: '0.1.0',
  description: '与 full 相同的 skills 与守卫，PATH 中的 claude 校验失败的夹具',
  author: { name: 'UAPA Fixtures' },
  targets: ['claude-code:subprocess'],
  guard: 'guard.ts',
} satisfies UapaConfig
