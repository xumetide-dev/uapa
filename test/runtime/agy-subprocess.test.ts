// agy:subprocess 的子进程协议（F-11-04）：以 agy 的能力数据与测试守卫打包真实入口后运行，
// 断言字段名、输出格式与停机计数目录。每个用例的 TMPDIR 指向临时目录，停机计数不写到别处
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { bundle, entryPath } from '../../src/bundle/index.ts'
import { agySubprocess } from '../../src/capabilities/agy-subprocess.ts'
import { runEntry } from '../helpers/entry.ts'

const GUARD = fileURLToPath(new URL('./guards/scripted.ts', import.meta.url))

let dir = ''
let entry = ''

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'uapa-agy-entry-'))
  const code = await bundle({
    entry: entryPath('agy-subprocess'),
    guardModule: GUARD,
    data: {
      pluginName: 'demo',
      toolNames: agySubprocess.toolNames,
      capabilities: agySubprocess.capabilities,
      moduleSessionEnv: null,
    },
    external: 'node',
  })
  entry = join(dir, 'uapa-agy.mjs')
  await writeFile(entry, code)
})

after(() => rm(dir, { recursive: true, force: true }))

// 每次调用新建一个临时目录作为 TMPDIR
async function freshTmp(): Promise<string> {
  return mkdtemp(join(dir, 'tmp-'))
}

function run(
  check: string,
  stdin: unknown,
  env: Readonly<Record<string, string>>,
): { status: number | null; stdout: string; stderr: string } {
  const text = typeof stdin === 'string' ? stdin : JSON.stringify(stdin)
  return runEntry(entry, [check], text, env)
}

const tool = (name: string, args: object, conversationId = 'c1') => ({
  conversationId,
  toolCall: { name, args },
})

const out = (value: unknown, stderr = '') => ({
  status: 0,
  stdout: `${JSON.stringify(value)}\n`,
  stderr,
})
const denied = (reason: string) => out({ decision: 'deny', reason })

test('stdin 字段缺失或类型不符时按宿主字段路径拒绝，退出码为 0', async () => {
  const env = { TMPDIR: await freshTmp() }
  const reason = (field: string) => denied(`uapa: 无法解析宿主输入: ${field}`)
  assert.deepEqual(run('before-tool', 'not json', env), reason('stdin'))
  assert.deepEqual(
    run('before-tool', { sessionId: 'c1' }, env),
    reason('conversationId'),
  )
  assert.deepEqual(
    run('before-tool', { conversationId: 'c1' }, env),
    reason('toolCall'),
  )
  const noName = { conversationId: 'c1', toolCall: { args: {} } }
  assert.deepEqual(run('before-tool', noName, env), reason('toolCall.name'))
  const noArgs = { conversationId: 'c1', toolCall: { name: 'run_command', args: 'ls' } }
  assert.deepEqual(run('before-tool', noArgs, env), reason('toolCall.args'))
  // run_command 缺少 CommandLine 时公共部分按 shell 命令缺失处理
  const noCommand = tool('run_command', { Cwd: '.' })
  assert.deepEqual(run('before-tool', noCommand, env), reason('tool.command'))
})

test('执行前检查：工具名按能力数据换算，放行输出 decision: "allow"', async () => {
  const env = { TMPDIR: await freshTmp() }
  const shell = tool('run_command', { CommandLine: 'echo', Cwd: '.' })
  assert.deepEqual(run('before-tool', shell, env), denied('shell {"command":"echo"}'))
  const view = tool('view_file', { action: 'echo', AbsolutePath: 'a.txt' })
  assert.deepEqual(
    run('before-tool', view, env),
    denied('read_file {"action":"echo","AbsolutePath":"a.txt"}'),
  )
  const unknown = tool('browser_click', { action: 'echo' })
  assert.deepEqual(
    run('before-tool', unknown, env),
    denied('host:browser_click {"action":"echo"}'),
  )
  const plain = tool('run_command', { CommandLine: 'ls' })
  assert.deepEqual(run('before-tool', plain, env), out({ decision: 'allow' }))
})

test('拒绝与守卫出错都以退出码 0 输出 decision: "deny" 与原因', async () => {
  const env = { TMPDIR: await freshTmp() }
  const deny = tool('run_command', { CommandLine: 'deny' })
  assert.deepEqual(run('before-tool', deny, env), denied('不允许'))
  const thrown = tool('run_command', { CommandLine: 'throw' })
  assert.deepEqual(run('before-tool', thrown, env), denied('uapa: 守卫出错: boom'))
})

test('改写只输出 overwrite.CommandLine；非 shell 工具的改写按 fallbackReason 拒绝', async () => {
  assert.equal(agySubprocess.capabilities.rewriteInput, true)
  const env = { TMPDIR: await freshTmp() }
  const shell = tool('run_command', { CommandLine: 'rewrite', Cwd: '.' })
  assert.deepEqual(
    run('before-tool', shell, env),
    out({ decision: 'allow', overwrite: { CommandLine: 'echo safe' } }),
  )
  const view = tool('view_file', { action: 'rewrite' })
  assert.deepEqual(run('before-tool', view, env), denied('请改用 echo safe'))
})

test('提示提交前检查不调用守卫，输出 {}', async () => {
  assert.equal(agySubprocess.capabilities.promptGate, false)
  const env = { TMPDIR: await freshTmp() }
  assert.deepEqual(run('before-prompt', 'not json', env), out({}))
})

test('停机继续输出 decision: "continue"，计数写入 TMPDIR 下的 uapa-<插件名>/', async () => {
  const tmp = await freshTmp()
  const env = { TMPDIR: tmp }
  const stop = { conversationId: 'c/1' }
  const counter = join(tmp, 'uapa-demo', 'uapa-stop-c%2F1.json')
  assert.deepEqual(
    run('before-stop', stop, env),
    out({ decision: 'continue', reason: '继续 0' }),
  )
  assert.deepEqual(await readdir(tmp), ['uapa-demo'])
  assert.equal(await readFile(counter, 'utf8'), '{"continuations":1}\n')
  assert.deepEqual(
    run('before-stop', stop, env),
    out({ decision: 'continue', reason: '继续 1' }),
  )
  // 守卫返回 stop 时放行输出 {}，计数归零
  assert.deepEqual(run('before-stop', stop, env), out({}))
  assert.equal(await readFile(counter, 'utf8'), '{"continuations":0}\n')
})

test('停机前检查无法解析或守卫出错时不阻止结束，原因写到 stderr', async () => {
  const env = { TMPDIR: await freshTmp() }
  assert.deepEqual(
    run('before-stop', {}, env),
    out({}, 'uapa: 无法解析宿主输入: conversationId\n'),
  )
  assert.deepEqual(
    run('before-stop', { conversationId: 'throw' }, env),
    out({}, 'uapa: 守卫出错: stop boom\n'),
  )
})

test('不读取宿主变量：设置 agy 与其他宿主的变量时输出与写入位置不变', async () => {
  const tmp = await freshTmp()
  const other = await freshTmp()
  const hostVars = {
    ANTIGRAVITY_CONVERSATION_ID: 'c9',
    CLAUDE_PLUGIN_DATA: other,
    PLUGIN_DATA: other,
  }
  const shell = tool('run_command', { CommandLine: 'echo' })
  assert.deepEqual(
    run('before-tool', shell, { TMPDIR: tmp, ...hostVars }),
    run('before-tool', shell, { TMPDIR: tmp }),
  )
  const stop = { conversationId: 'c1' }
  assert.deepEqual(
    run('before-stop', stop, { TMPDIR: tmp, ...hostVars }),
    out({ decision: 'continue', reason: '继续 0' }),
  )
  assert.deepEqual(await readdir(other), [])
  assert.deepEqual(await readdir(join(tmp, 'uapa-demo')), ['uapa-stop-c1.json'])
})
