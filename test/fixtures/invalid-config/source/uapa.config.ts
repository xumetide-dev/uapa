// 第二个目标名未登记；配置不经 UapaConfig 检查，由构建时校验报错（TA-04）
export default {
  name: 'invalid-config',
  version: '0.1.0',
  description: '含未知目标名的夹具',
  author: { name: 'UAPA Fixtures' },
  targets: ['claude-code:subprocess', 'cursor:subprocess'],
}
