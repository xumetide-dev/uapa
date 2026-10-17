// codex:subprocess 的子进程协议（F-06-04、F-06-07）：以 Codex 的能力数据与测试守卫打包真实入口后运行，
// 断言字段名、输出格式与数据目录变量
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { bundle, entryPath } from '../../src/bundle/index.ts'
import { codexSubprocess } from '../../src/capabilities/codex-subprocess.ts'
import { runEntry } from '../helpers/entry.ts'

const GUARD = fileURLToPath(new URL('./guards/scripted.ts', import.meta.url))

let dir = ''
let entry = ''

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'uapa-codex-entry-'))
  const code = await bundle({
    entry: entryPath('codex-subprocess'),
    guardModule: GUARD,
    data: {
      pluginName: 'demo',
      toolNames: codexSubprocess.toolNames,
      capabilities: codexSubprocess.capabilities,
      moduleSessionEnv: null,
      options: [],
    },
    external: 'node',
  })
  entry = join(dir, 'uapa-codex.mjs')
  await writeFile(entry, code)
})

after(() => rm(dir, { recursive: true, force: true }))

function run(check: string, stdin: unknown, env: Record<string, string> = {}) {
  const text = typeof stdin === 'string' ? stdin : JSON.stringify(stdin)
  return runEntry(entry, [check], text, env)
}

// stdin 的形状取自 Codex 源码核对（rust-v0.162.1）的 PreToolUseCommandInput
const tool = (name: string, input: unknown, session = 's1') => ({
  session_id: session,
  turn_id: 't1',
  transcript_path: null,
  cwd: '/work',
  hook_event_name: 'PreToolUse',
  model: 'm',
  permission_mode: 'default',
  tool_name: name,
  tool_input: input,
  tool_use_id: 'call_1',
})

const denied = (reason: string) => ({ status: 2, stdout: '', stderr: `${reason}\n` })
const allowed = { status: 0, stdout: '', stderr: '' }

test('stdin 字段缺失或类型不符时按宿主字段路径拒绝，stderr 非空', () => {
  const reason = (field: string) => denied(`uapa: 无法解析宿主输入: ${field}`)
  assert.deepEqual(run('before-tool', 'not json'), reason('stdin'))
  assert.deepEqual(run('before-tool', { sessionId: 's1' }), reason('session_id'))
  assert.deepEqual(run('before-tool', { session_id: 's1' }), reason('tool_name'))
  assert.deepEqual(run('before-tool', tool('Bash', 'ls')), reason('tool_input'))
  assert.deepEqual(run('before-tool', tool('Bash', {})), reason('tool.command'))
  assert.deepEqual(run('before-prompt', { session_id: 's1' }), reason('prompt'))
})

test('执行前检查：工具名按能力数据换算，放行时退出码 0 且无输出', () => {
  assert.deepEqual(
    run('before-tool', tool('Bash', { command: 'echo' })),
    denied('shell {"command":"echo"}'),
  )
  assert.deepEqual(
    run('before-tool', tool('apply_patch', { action: 'echo' })),
    denied('edit_file {"action":"echo"}'),
  )
  assert.deepEqual(
    run('before-tool', tool('mcp__docs__search', { action: 'echo' })),
    denied('host:mcp__docs__search {"action":"echo"}'),
  )
  assert.deepEqual(run('before-tool', tool('Bash', { command: 'ls' })), allowed)
})

test('拒绝与守卫出错都以退出码 2 与非空 stderr 输出', () => {
  assert.deepEqual(
    run('before-tool', tool('Bash', { command: 'deny' })),
    denied('不允许'),
  )
  assert.deepEqual(
    run('before-tool', tool('Bash', { command: 'throw' })),
    denied('uapa: 守卫出错: boom'),
  )
})

test('改写输出 permissionDecision: "allow" 与 updatedInput；非 shell 工具按 fallbackReason 拒绝', () => {
  assert.equal(codexSubprocess.capabilities.rewriteInput, true)
  const expected = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      updatedInput: { command: 'echo safe' },
    },
  }
  assert.deepEqual(run('before-tool', tool('Bash', { command: 'rewrite' })), {
    status: 0,
    stdout: `${JSON.stringify(expected)}\n`,
    stderr: '',
  })
  assert.deepEqual(
    run('before-tool', tool('apply_patch', { action: 'rewrite' })),
    denied('请改用 echo safe'),
  )
})

test('提示提交前检查：block 以退出码 2 与 stderr 拦下提示', () => {
  assert.equal(codexSubprocess.capabilities.promptGate, true)
  const prompt = (text: string) => ({
    session_id: 's1',
    hook_event_name: 'UserPromptSubmit',
    prompt: text,
  })
  assert.deepEqual(run('before-prompt', prompt('含密钥')), denied('含密钥'))
  assert.deepEqual(run('before-prompt', prompt('你好')), allowed)
})

test('停机继续输出 decision: "block" 与 reason，计数写入 PLUGIN_DATA（目录不存在时创建）', async () => {
  const data = join(await mkdtemp(join(dir, 'data-')), 'demo-local')
  const stop = { session_id: 's1', hook_event_name: 'Stop', stop_hook_active: false }
  assert.deepEqual(run('before-stop', stop, { PLUGIN_DATA: data }), {
    status: 0,
    stdout: '{"decision":"block","reason":"继续 0"}\n',
    stderr: '',
  })
  assert.deepEqual(await readdir(data), ['uapa-stop-s1.json'])
  assert.equal(
    await readFile(join(data, 'uapa-stop-s1.json'), 'utf8'),
    '{"continuations":1}\n',
  )
})

test('只读取 PLUGIN_DATA：设置 Claude Code 的数据目录变量时输出不变', async () => {
  const other = await mkdtemp(join(dir, 'other-'))
  const stop = { session_id: 's1' }
  const without = run('before-stop', stop)
  assert.deepEqual(without, {
    status: 0,
    stdout: '{"decision":"block","reason":"继续 0"}\n',
    stderr: 'uapa: 没有插件数据目录，停机计数按 0 处理\n',
  })
  assert.deepEqual(run('before-stop', stop, { CLAUDE_PLUGIN_DATA: other }), without)
  assert.deepEqual(await readdir(other), [])
  const shell = tool('Bash', { command: 'deny' })
  assert.deepEqual(
    run('before-tool', shell, { CLAUDE_PLUGIN_DATA: other }),
    run('before-tool', shell),
  )
})

// stdin 的形状取自源码核对的 PostToolUseCommandInput
const ran = (name: string, input: unknown, response?: unknown) => ({
  ...tool(name, input),
  hook_event_name: 'PostToolUse',
  ...(response === undefined ? {} : { tool_response: response }),
})

const blocked = (reason: string) => ({
  status: 0,
  stdout: `${JSON.stringify({ decision: 'block', reason })}\n`,
  stderr: '',
})

test('执行后检查：能力数据记为只能扣留，replace 与 withhold 都输出 decision: "block"', () => {
  assert.equal(codexSubprocess.capabilities.replaceOutput, false)
  assert.equal(codexSubprocess.capabilities.withholdOutput, true)
  const command = { command: 'echo uapa-after-tool-probe' }
  assert.deepEqual(run('after-tool', ran('Bash', command, 'uapa-keep-probe')), allowed)
  assert.deepEqual(
    run('after-tool', ran('Bash', command, 'uapa-replace-probe')),
    blocked('uapa-replaced'),
  )
  const patch = 'Exit code: 0\nuapa-withhold-probe'
  assert.deepEqual(
    run('after-tool', ran('apply_patch', { action: 'x' }, patch)),
    blocked('uapa-withheld'),
  )
  const mcp = { content: [{ type: 'text', text: 'uapa-echo-probe' }], isError: false }
  assert.deepEqual(
    run('after-tool', ran('mcp__docs__search', {}, mcp)),
    blocked(`host:mcp__docs__search {} ${JSON.stringify(mcp)}`),
  )
})

test('执行后检查：守卫出错、返回值无效与 tool_response 缺失时扣留', () => {
  const command = { command: 'echo uapa-after-tool-probe' }
  assert.deepEqual(
    run('after-tool', ran('Bash', command, 'uapa-throw-probe')),
    blocked('uapa: 守卫出错: after boom'),
  )
  assert.deepEqual(
    run('after-tool', ran('Bash', command, 'uapa-invalid-probe')),
    blocked('uapa: 守卫返回值无效'),
  )
  assert.deepEqual(
    run('after-tool', ran('Bash', command)),
    blocked('uapa: 无法解析宿主输入: tool_response'),
  )
})

test('从 stdin.cwd 提取工作目录，缺失、空串或非字符串时退化为 null（F-06-17）', () => {
  assert.deepEqual(
    run('before-tool', { ...tool('Bash', { command: 'cwd' }), cwd: '/work/codex' }),
    denied('cwd=/work/codex'),
  )
  for (const invalid of [undefined, '', 42, null]) {
    const payload = { ...tool('Bash', { command: 'cwd' }), cwd: invalid }
    assert.deepEqual(run('before-tool', payload), denied('cwd=null'))
  }
})
