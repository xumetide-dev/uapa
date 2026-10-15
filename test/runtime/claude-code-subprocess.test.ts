// claude-code:subprocess 的子进程协议（F-05-04、F-05-13）：以 Claude Code 的能力数据与测试守卫打包
// 真实入口后运行，断言字段名、输出格式与数据目录变量
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { bundle, entryPath } from '../../src/bundle/index.ts'
import { claudeCodeSubprocess } from '../../src/capabilities/claude-code-subprocess.ts'
import { runEntry } from '../helpers/entry.ts'

const GUARD = fileURLToPath(new URL('./guards/scripted.ts', import.meta.url))

let dir = ''
const entries = { plain: '', deduped: '' }

async function bundleTo(name: string, moduleSessionEnv: string | null) {
  const code = await bundle({
    entry: entryPath('claude-code-subprocess'),
    guardModule: GUARD,
    data: {
      pluginName: 'demo',
      toolNames: claudeCodeSubprocess.toolNames,
      capabilities: claudeCodeSubprocess.capabilities,
      moduleSessionEnv,
      options: [],
    },
    external: 'node',
  })
  const file = join(dir, name)
  await writeFile(file, code)
  return file
}

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'uapa-claude-entry-'))
  entries.plain = await bundleTo('plain.mjs', null)
  entries.deduped = await bundleTo('deduped.mjs', 'UAPA_MODULE_SESSION_DEMO')
})

after(() => rm(dir, { recursive: true, force: true }))

const tool = (name: string, input: object, session = 's1') =>
  JSON.stringify({
    session_id: session,
    hook_event_name: 'PreToolUse',
    tool_name: name,
    tool_input: input,
    tool_use_id: 'toolu_1',
  })

const denied = (reason: string) => ({ status: 2, stdout: '', stderr: `${reason}\n` })
const allowed = { status: 0, stdout: '', stderr: '' }

test('stdin 字段缺失或类型不符时按宿主字段路径拒绝', () => {
  const reason = (field: string) => denied(`uapa: 无法解析宿主输入: ${field}`)
  const run = (check: string, stdin: object) =>
    runEntry(entries.plain, [check], JSON.stringify(stdin))
  assert.deepEqual(run('before-tool', { session: 's1' }), reason('session_id'))
  assert.deepEqual(run('before-tool', { session_id: 's1' }), reason('tool_name'))
  const noInput = { session_id: 's1', tool_name: 'Bash', tool_input: 'ls' }
  assert.deepEqual(run('before-tool', noInput), reason('tool_input'))
  const noCommand = { session_id: 's1', tool_name: 'Bash', tool_input: {} }
  assert.deepEqual(run('before-tool', noCommand), reason('tool.command'))
  assert.deepEqual(run('before-prompt', { session_id: 's1' }), reason('prompt'))
})

test('执行前检查：工具名按能力数据换算，拒绝以退出码 2 与 stderr 输出', () => {
  const shell = tool('Bash', { command: 'echo', description: 'x' })
  assert.deepEqual(
    runEntry(entries.plain, ['before-tool'], shell),
    denied('shell {"command":"echo"}'),
  )
  const read = tool('Read', { action: 'echo', file_path: 'a.txt' })
  assert.deepEqual(
    runEntry(entries.plain, ['before-tool'], read),
    denied('read_file {"action":"echo","file_path":"a.txt"}'),
  )
  const plain = tool('Bash', { command: 'ls' })
  assert.deepEqual(runEntry(entries.plain, ['before-tool'], plain), allowed)
})

test('能力数据记为支持改写，入口实现 rewriteShell：只写 updatedInput，保留原入参其余字段', () => {
  assert.equal(claudeCodeSubprocess.capabilities.rewriteInput, true)
  const input = { command: 'rewrite', description: '改写', timeout: 5000 }
  const updatedInput = { command: 'echo safe', description: '改写', timeout: 5000 }
  const expected = { hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput } }
  assert.deepEqual(runEntry(entries.plain, ['before-tool'], tool('Bash', input)), {
    status: 0,
    stdout: `${JSON.stringify(expected)}\n`,
    stderr: '',
  })
  // 非 shell 工具的 rewrite 按 fallbackReason 拒绝（F-04-02）
  const read = tool('Read', { action: 'rewrite' })
  assert.deepEqual(
    runEntry(entries.plain, ['before-tool'], read),
    denied('请改用 echo safe'),
  )
})

test('提示提交前检查：block 以退出码 2 与 stderr 拦下提示', () => {
  assert.equal(claudeCodeSubprocess.capabilities.promptGate, true)
  const prompt = (text: string) =>
    JSON.stringify({
      session_id: 's1',
      hook_event_name: 'UserPromptSubmit',
      prompt: text,
    })
  assert.deepEqual(
    runEntry(entries.plain, ['before-prompt'], prompt('含密钥')),
    denied('含密钥'),
  )
  assert.deepEqual(runEntry(entries.plain, ['before-prompt'], prompt('你好')), allowed)
})

test('停机继续输出 decision: "block" 与 reason，计数写入 CLAUDE_PLUGIN_DATA', async () => {
  const data = await mkdtemp(join(dir, 'data-'))
  const stop = JSON.stringify({ session_id: 's1', stop_hook_active: false })
  const result = runEntry(entries.plain, ['before-stop'], stop, {
    CLAUDE_PLUGIN_DATA: data,
  })
  assert.deepEqual(result, {
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

test('只读取 CLAUDE_PLUGIN_DATA：设置其他宿主的数据目录变量时输出不变', async () => {
  const other = await mkdtemp(join(dir, 'other-'))
  const stop = JSON.stringify({ session_id: 's1' })
  const without = runEntry(entries.plain, ['before-stop'], stop)
  assert.deepEqual(without, {
    status: 0,
    stdout: '{"decision":"block","reason":"继续 0"}\n',
    stderr: 'uapa: 没有插件数据目录，停机计数按 0 处理\n',
  })
  const withOther = runEntry(entries.plain, ['before-stop'], stop, {
    PLUGIN_DATA: other,
    CLAUDE_PLUGIN_DATA: '',
  })
  assert.deepEqual(withOther, without)
  assert.deepEqual(await readdir(other), [])
  const shell = tool('Bash', { command: 'deny' })
  assert.deepEqual(
    runEntry(entries.plain, ['before-tool'], shell, { PLUGIN_DATA: other }),
    runEntry(entries.plain, ['before-tool'], shell),
  )
})

test('去重变量等于 session_id 时放行，不调用守卫；为 null 时不读取该变量', () => {
  const thrown = tool('Bash', { command: 'throw' })
  const env = { UAPA_MODULE_SESSION_DEMO: 's1' }
  assert.deepEqual(runEntry(entries.deduped, ['before-tool'], thrown, env), allowed)
  const other = { UAPA_MODULE_SESSION_DEMO: 's2' }
  assert.deepEqual(
    runEntry(entries.deduped, ['before-tool'], thrown, other),
    denied('uapa: 守卫出错: boom'),
  )
  assert.deepEqual(
    runEntry(entries.plain, ['before-tool'], thrown, env),
    denied('uapa: 守卫出错: boom'),
  )
})

// PostToolUse 的 stdin，字段取自本地实测「执行后检查」（2.1.296）
const ran = (name: string, input: object, response?: unknown) =>
  JSON.stringify({
    session_id: 's1',
    hook_event_name: 'PostToolUse',
    tool_name: name,
    tool_input: input,
    ...(response === undefined ? {} : { tool_response: response }),
    tool_use_id: 'toolu_1',
    duration_ms: 3,
  })

const updated = (output: unknown) => ({
  status: 0,
  stdout: `${JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', updatedToolOutput: output } })}\n`,
  stderr: '',
})
const blocked = (reason: string) => ({
  status: 0,
  stdout: `${JSON.stringify({ decision: 'block', reason })}\n`,
  stderr: '',
})

test('执行后检查：能力数据记为能替换与扣留，入口以 updatedToolOutput 替换 Bash 与 Read 的输出', () => {
  assert.equal(claudeCodeSubprocess.capabilities.replaceOutput, true)
  assert.equal(claudeCodeSubprocess.capabilities.withholdOutput, true)
  const after = (name: string, input: object, response: unknown) =>
    runEntry(entries.plain, ['after-tool'], ran(name, input, response))
  const bash = (stdout: string) => ({
    stdout,
    stderr: '',
    interrupted: false,
    isImage: false,
    noOutputExpected: false,
  })
  const read = (content: string) => ({
    type: 'text',
    file: { filePath: 'a.txt', content, numLines: 1, startLine: 1, totalLines: 1 },
  })
  const command = { command: 'echo uapa-after-tool-probe' }
  assert.deepEqual(after('Bash', command, bash('uapa-keep-probe')), allowed)
  assert.deepEqual(
    after('Bash', command, bash('uapa-replace-probe')),
    updated(bash('uapa-replaced')),
  )
  assert.deepEqual(
    after('Read', { file_path: 'a.txt' }, read('uapa-withhold-probe')),
    updated(read('uapa-withheld')),
  )
  // 其他形状只能以 decision: "block" 附加原因
  const glob = { filenames: ['uapa-replace-probe'], numFiles: 1 }
  assert.deepEqual(after('Glob', { pattern: '*' }, glob), blocked('uapa-replaced'))
})

test('执行后检查：守卫出错与 tool_response 缺失时扣留', () => {
  const command = { command: 'echo uapa-after-tool-probe' }
  const thrown = { stdout: 'uapa-throw-probe', stderr: '' }
  assert.deepEqual(
    runEntry(entries.plain, ['after-tool'], ran('Bash', command, thrown)),
    updated({ stdout: 'uapa: 守卫出错: after boom', stderr: '' }),
  )
  assert.deepEqual(
    runEntry(entries.plain, ['after-tool'], ran('Bash', command)),
    blocked('uapa: 无法解析宿主输入: tool_response'),
  )
  // 去重变量等于 session_id 时同样跳过执行后检查
  const env = { UAPA_MODULE_SESSION_DEMO: 's1' }
  const stdin = ran('Bash', command, thrown)
  assert.deepEqual(runEntry(entries.deduped, ['after-tool'], stdin, env), allowed)
})
