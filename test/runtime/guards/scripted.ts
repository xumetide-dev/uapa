// 按工具入参（shell 为命令，其余为 action）、提示文本与会话 id 返回不同结果，供入口用例使用
import type { BeforeTool, GuardPlugin } from '../../../src/index.ts'

function decide(action: unknown, tool: string, input: unknown): BeforeTool {
  if (action === 'throw') throw new Error('boom')
  if (action === 'invalid') return { kind: 'deny', reason: ' ' }
  if (action === 'deny') return { kind: 'deny', reason: '不允许' }
  if (action === 'echo')
    return { kind: 'deny', reason: `${tool} ${JSON.stringify(input)}` }
  if (action === 'rewrite') {
    const input = { command: 'echo safe' }
    return { kind: 'rewrite', input, fallbackReason: '请改用 echo safe' }
  }
  return { kind: 'allow' }
}

const guard: GuardPlugin = {
  name: 'scripted',
  requires: [],
  beforeTool: call =>
    decide(
      call.tool === 'shell' ? call.input.command : call.input.action,
      call.tool,
      call.input,
    ),
  beforePrompt(p) {
    if (p.prompt === 'throw') throw new Error('boom')
    return p.prompt.includes('密钥')
      ? { kind: 'block', reason: '含密钥' }
      : { kind: 'allow' }
  },
  async beforeStop(s) {
    if (s.sessionId === 'throw') throw new Error('stop boom')
    if (s.continuations >= 2) return { kind: 'stop' }
    return { kind: 'continue', reason: `继续 ${s.continuations}` }
  },
}

export default guard
