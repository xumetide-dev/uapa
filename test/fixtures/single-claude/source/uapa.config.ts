import type { UapaConfig } from 'uapa'

export default {
  name: 'single-guard', // 以 - 分隔的段为 claude 时 validate --strict 失败
  version: '0.1.0',
  description: '与 full 相同的 skills 与守卫，只配置 claude-code:subprocess 的夹具',
  author: { name: 'UAPA Fixtures' },
  targets: ['claude-code:subprocess'],
  guard: 'guard.ts',
} satisfies UapaConfig
