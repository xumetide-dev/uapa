// TA-12：claude plugin test 运行的 hooks 模块测试，经覆盖文件复制进 Claude Code 产物。
// 测试代替 Claude Code 作答，不启动会话、不运行工具；命令只用无副作用的标记命令
import { expect, test } from 'claude-code/testing'

const SESSION = 'uapa-test-session'

test('拒绝含 uapa-deny-probe 的命令，工具不运行', async ($, on) => {
  const ran: string[] = []
  on('session.id', () => ({ value: SESSION }))
  on('tool.call', (_$, e) => {
    ran.push(e.command)
    return { result: 'ran' }
  })
  const out = await $.tool.call({ tool: 'Bash', command: 'echo uapa-deny-probe' })
  expect(out.deny).toBe('拒绝标记命令 uapa-deny-probe')
  expect(ran).toEqual([])
})

test('放行其他命令，工具收到原命令', async ($, on) => {
  const ran: string[] = []
  on('session.id', () => ({ value: SESSION }))
  on('tool.call', (_$, e) => {
    ran.push(e.command)
    return { result: 'uapa-allow-probe\n' }
  })
  const out = await $.tool.call({ tool: 'Bash', command: 'echo uapa-allow-probe' })
  expect(out.deny).toBeUndefined()
  expect(out.result).toBe('uapa-allow-probe\n')
  expect(ran).toEqual(['echo uapa-allow-probe'])
})

test('改写 echo uapa-rewrite-probe，工具收到改写后的命令', async ($, on) => {
  const ran: string[] = []
  on('session.id', () => ({ value: SESSION }))
  on('tool.call', (_$, e) => {
    ran.push(e.command)
    return { result: 'ran' }
  })
  await $.tool.call({ tool: 'Bash', command: 'echo uapa-rewrite-probe x' })
  expect(ran).toEqual(['echo uapa-rewritten x'])
})

test('停机前连续要求继续两次，第三次结束', async ($, on) => {
  on('session.id', () => ({ value: SESSION }))
  on('classic.Stop', () => ({}))
  const first = await $.classic.Stop({})
  const second = await $.classic.Stop({})
  const third = await $.classic.Stop({})
  expect(first.block).toBe('请先运行测试再结束')
  expect(second.block).toBe('请先运行测试再结束')
  expect(third.block).toBeUndefined()
})

test('阻断含疑似密钥的提示', async ($, on) => {
  on('session.id', () => ({ value: SESSION }))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  const blocked = await $.prompt.submit({ text: 'API_KEY=uapa-prompt-probe' })
  expect(blocked.drop).toBe('提示中含疑似密钥')
  const passed = await $.prompt.submit({ text: 'uapa-prompt-probe' })
  expect(passed.drop).toBeUndefined()
})
