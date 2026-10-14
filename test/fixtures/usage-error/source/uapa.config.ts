import type { UapaConfig } from 'uapa'

// 配置本身有效；命令行用法错误时不读取配置
export default {
  name: 'usage-error',
  version: '0.1.0',
  description: '命令行用法错误的夹具',
  author: { name: 'UAPA Fixtures' },
  targets: ['claude-code:subprocess'],
} satisfies UapaConfig
