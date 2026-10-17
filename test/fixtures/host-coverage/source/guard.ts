// host-coverage 夹具的守卫：拒绝含 uapa-deny-probe 的命令（Bash 与 Monitor 都按 shell 检查），
// 拦截含疑似密钥的提示。拒绝只匹配无副作用的标记命令，守卫失效时也不会执行高危操作（见 AGENTS.md）
import type { GuardPlugin } from 'uapa'

const guard: GuardPlugin = {
  name: 'host-coverage-guard',
  requires: [],
  beforeTool: call =>
    call.tool === 'shell' && String(call.input.command).includes('uapa-deny-probe')
      ? { kind: 'deny', reason: '拒绝标记命令 uapa-deny-probe' }
      : { kind: 'allow' },
  beforePrompt: p =>
    p.prompt.includes('API_KEY=')
      ? { kind: 'block', reason: '提示中含疑似密钥' }
      : { kind: 'allow' },
}

export default guard
