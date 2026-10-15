// 守卫选项夹具（TA-23）：声明 number、boolean、string 各一个选项；beforeTool 拒绝标记命令，
// 原因中写出三个选项的取值，其他调用放行
import type { GuardPlugin } from 'uapa'

export default {
  name: 'guard-options',
  requires: [],
  options: {
    maxLength: {
      type: 'number',
      title: '命令长度上限',
      description: '写入拒绝原因的数值选项',
      default: 200,
    },
    strict_mode: {
      type: 'boolean',
      title: '严格模式',
      description: '写入拒绝原因的布尔选项',
      default: true,
    },
    label: {
      type: 'string',
      title: '原因前缀',
      description: '写入拒绝原因的字符串选项',
      default: 'uapa-guard',
    },
  },
  beforeTool(call, ctx) {
    const command = call.tool === 'shell' ? String(call.input.command) : ''
    if (!command.includes('uapa-deny-probe')) return { kind: 'allow' }
    const { label, maxLength, strict_mode: strict } = ctx.options
    return {
      kind: 'deny',
      reason: `${label}: 拒绝标记命令 uapa-deny-probe（maxLength=${maxLength}，strict_mode=${strict}）`,
    }
  },
} satisfies GuardPlugin
