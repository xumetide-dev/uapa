// 夹具守卫（与 full 相同）：拒绝含 uapa-deny-probe 的命令，把 echo uapa-rewrite-probe
// 改写为 echo uapa-rewritten，拦截含疑似密钥的提示，停机前要求连续继续两次后才结束。
// 拒绝与改写只匹配无副作用的标记命令，守卫失效时也不会执行高危操作（见 AGENTS.md）
import type { BeforeTool, GuardPlugin } from 'uapa'

function shellDecision(command: string): BeforeTool {
  if (command.includes('uapa-deny-probe')) {
    return { kind: 'deny', reason: '拒绝标记命令 uapa-deny-probe' }
  }
  if (command.startsWith('echo uapa-rewrite-probe ')) {
    return {
      kind: 'rewrite',
      input: { command: command.replace('uapa-rewrite-probe ', 'uapa-rewritten ') },
      fallbackReason: '请改用 echo uapa-rewritten',
    }
  }
  return { kind: 'allow' }
}

const guard: GuardPlugin = {
  name: 'fixture-guard',
  requires: [],
  beforeTool: call =>
    call.tool === 'shell'
      ? shellDecision(String(call.input.command))
      : { kind: 'allow' },
  beforePrompt: p =>
    p.prompt.includes('API_KEY=')
      ? { kind: 'block', reason: '提示中含疑似密钥' }
      : { kind: 'allow' },
  beforeStop: s =>
    s.continuations < 2
      ? { kind: 'continue', reason: '请先运行测试再结束' }
      : { kind: 'stop' },
}

export default guard
