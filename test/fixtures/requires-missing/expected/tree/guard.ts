// 夹具守卫（TA-04）：requires 声明 promptGate，缺少该能力的目标（agy:subprocess）构建失败。
// 拒绝只匹配无副作用的标记命令（见 AGENTS.md）
import type { GuardPlugin } from 'uapa'

const guard: GuardPlugin = {
  name: 'requires-missing',
  requires: ['promptGate'],
  beforeTool: call =>
    call.tool === 'shell' && String(call.input.command).includes('uapa-deny-probe')
      ? { kind: 'deny', reason: '拒绝标记命令 uapa-deny-probe' }
      : { kind: 'allow' },
  beforePrompt: p =>
    p.prompt.includes('API_KEY=')
      ? { kind: 'block', reason: '提示中含疑似密钥' }
      : { kind: 'allow' },
  beforeStop: () => ({ kind: 'stop' }),
}

export default guard
