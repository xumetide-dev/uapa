import type { UapaConfig } from 'uapa'

export default {
  name: 'both-guard',
  version: '0.1.0',
  description: '与 full 相同的 skills 与守卫，配置两个 Claude Code 目标的夹具',
  author: { name: 'UAPA Fixtures' },
  targets: ['claude-code:in-process', 'claude-code:subprocess'],
  guard: 'guard.ts',
} satisfies UapaConfig
