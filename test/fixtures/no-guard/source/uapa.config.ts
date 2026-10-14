import type { UapaConfig } from 'uapa'

export default {
  name: 'no-guard',
  version: '0.1.0',
  description: '只有一个 skill、不配守卫的夹具',
  author: { name: 'UAPA Fixtures' },
  targets: ['claude-code:subprocess'],
} satisfies UapaConfig
