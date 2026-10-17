// 按工具入参（shell 为命令，其余为 action）、提示文本、会话 id 与工具输出中的标记返回不同结果，
// 供入口用例使用
import type {
  AfterTool,
  BeforeTool,
  GuardPlugin,
  ToolCall,
} from '../../../src/index.ts'

function decide(
  action: unknown,
  tool: string,
  input: unknown,
  cwd: string | null = null,
): BeforeTool {
  if (action === 'throw') throw new Error('boom')
  if (action === 'invalid') return { kind: 'deny', reason: ' ' }
  if (action === 'deny') return { kind: 'deny', reason: '不允许' }
  if (action === 'cwd') return { kind: 'deny', reason: `cwd=${String(cwd)}` }
  if (action === 'echo')
    return { kind: 'deny', reason: `${tool} ${JSON.stringify(input)}` }
  if (action === 'rewrite') {
    const input = { command: 'echo safe' }
    return { kind: 'rewrite', input, fallbackReason: '请改用 echo safe' }
  }
  return { kind: 'allow' }
}

// uapa-echo-probe 把收到的调用与输出文本作为扣留原因交回，供断言文本的取法
function afterDecision(call: ToolCall, output: string): AfterTool {
  if (output.includes('uapa-throw-probe')) throw new Error('after boom')
  if (output.includes('uapa-invalid-probe')) return { kind: 'replace', text: ' ' }
  if (output.includes('uapa-replace-probe')) {
    return { kind: 'replace', text: 'uapa-replaced' }
  }
  if (output.includes('uapa-withhold-probe')) {
    return { kind: 'withhold', reason: 'uapa-withheld' }
  }
  if (output.includes('uapa-echo-probe')) {
    const reason = `${call.tool} ${JSON.stringify(call.input)} ${output}`
    return { kind: 'withhold', reason }
  }
  return { kind: 'keep' }
}

const guard: GuardPlugin = {
  name: 'scripted',
  requires: [],
  beforeTool: (call, ctx) =>
    decide(
      call.tool === 'shell' ? call.input.command : call.input.action,
      call.tool,
      call.input,
      ctx.cwd,
    ),
  beforePrompt(p) {
    if (p.prompt === 'throw') throw new Error('boom')
    return p.prompt.includes('密钥')
      ? { kind: 'block', reason: '含密钥' }
      : { kind: 'allow' }
  },
  afterTool: async (call, output) => afterDecision(call, output),
  async beforeStop(s) {
    if (s.sessionId === 'throw') throw new Error('stop boom')
    if (s.continuations >= 2) return { kind: 'stop' }
    return { kind: 'continue', reason: `继续 ${s.continuations}` }
  },
}

export default guard
