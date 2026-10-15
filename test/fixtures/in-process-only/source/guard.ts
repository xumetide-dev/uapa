// 夹具守卫：只实现执行前检查，拒绝含 uapa-deny-probe 的命令。只匹配无副作用的标记命令，
// 守卫失效时也不会执行高危操作（见 AGENTS.md）
import type { GuardPlugin } from 'uapa'

const guard: GuardPlugin = {
  name: 'tool-guard',
  requires: [],
  beforeTool: call =>
    call.tool === 'shell' && String(call.input.command).includes('uapa-deny-probe')
      ? { kind: 'deny', reason: '拒绝标记命令 uapa-deny-probe' }
      : { kind: 'allow' },
}

export default guard
