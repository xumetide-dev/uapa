// 子进程入口的公共部分（F-04-03～F-04-05）：以 test/ 下的最小入口与守卫打包后，
// 用 process.execPath 运行
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { bundle } from '../../src/bundle/index.ts'
import type { Capability, TargetRuntimeData } from '../../src/runtime/core/types.ts'
import { runEntry } from '../helpers/entry.ts'

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const ENTRY = here('./entries/test-subprocess.ts')

function data(
  capabilities: Partial<Record<Capability, boolean>>,
  moduleSessionEnv: string | null,
): TargetRuntimeData {
  return {
    pluginName: 'demo',
    toolNames: { Bash: 'shell', Read: 'read_file' },
    capabilities: {
      rewriteInput: true,
      replaceOutput: false,
      withholdOutput: false,
      stopGate: true,
      promptGate: true,
      ...capabilities,
    },
    moduleSessionEnv,
  }
}

let dir = ''
const entries = { full: '', limited: '', toolOnly: '' }

async function bundleTo(name: string, guard: string, runtime: TargetRuntimeData) {
  const code = await bundle({
    entry: ENTRY,
    guardModule: here(`./guards/${guard}.ts`),
    data: runtime,
    external: 'node',
  })
  const file = join(dir, name)
  await writeFile(file, code)
  return file
}

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'uapa-entry-'))
  entries.full = await bundleTo('full.mjs', 'scripted', data({}, 'TEST_SKIP'))
  const limited = data({ rewriteInput: false, promptGate: false }, null)
  entries.limited = await bundleTo('limited.mjs', 'scripted', limited)
  entries.toolOnly = await bundleTo('tool-only.mjs', 'tool-only', data({}, null))
})

after(() => rm(dir, { recursive: true, force: true }))

const call = (tool: string, input: object, session = 's1') =>
  JSON.stringify({ session, tool, input })

function expectDeny(result: ReturnType<typeof runEntry>, reason: string) {
  assert.deepEqual(result, { status: 2, stdout: '', stderr: `${reason}\n` })
}

const allowed = { status: 0, stdout: '', stderr: '' }

test('检查名缺失或无效时以 1 结束，不读取 stdin', async () => {
  for (const args of [[], ['after-tool']]) {
    // stdin 保持打开：入口若读取 stdin 会一直等待，超时后用例失败
    const child = spawn(process.execPath, [entries.full, ...args], { env: {} })
    let stderr = ''
    child.stderr.on('data', chunk => {
      stderr += chunk
    })
    const timer = setTimeout(() => child.kill(), 10_000)
    const status = await new Promise(resolve => child.on('close', resolve))
    clearTimeout(timer)
    child.stdin.destroy()
    assert.equal(status, 1)
    assert.match(stderr, /before-tool、before-prompt 或 before-stop/)
    assert.match(stderr, args.length === 0 ? /（缺失）/ : /after-tool/)
  }
})

test('执行前检查：放行、拒绝，守卫收到换算后的工具名与入参', () => {
  assert.deepEqual(
    runEntry(entries.full, ['before-tool'], call('Bash', { cmd: 'ls' })),
    allowed,
  )
  expectDeny(
    runEntry(entries.full, ['before-tool'], call('Bash', { cmd: 'deny' })),
    '不允许',
  )
  const shell = runEntry(
    entries.full,
    ['before-tool'],
    call('Bash', { cmd: 'echo', t: 1 }),
  )
  expectDeny(shell, 'shell {"command":"echo"}')
  const other = call('NotebookEdit', { action: 'echo', cell: 2 })
  expectDeny(
    runEntry(entries.full, ['before-tool'], other),
    'host:NotebookEdit {"action":"echo","cell":2}',
  )
})

test('输入无法解析时执行前与提示提交前检查拒绝，停机前检查放行并写原因', () => {
  const reason = (field: string) => `uapa: 无法解析宿主输入: ${field}`
  expectDeny(runEntry(entries.full, ['before-tool'], 'not json'), reason('stdin'))
  expectDeny(runEntry(entries.full, ['before-tool'], '{}'), reason('session'))
  const noTool = JSON.stringify({ session: 's1' })
  expectDeny(runEntry(entries.full, ['before-tool'], noTool), reason('tool'))
  const noCommand = call('Bash', { description: 'x' })
  expectDeny(runEntry(entries.full, ['before-tool'], noCommand), reason('tool.command'))
  expectDeny(runEntry(entries.full, ['before-prompt'], noTool), reason('prompt'))
  assert.deepEqual(runEntry(entries.full, ['before-stop'], '['), {
    status: 0,
    stdout: '',
    stderr: `${reason('stdin')}\n`,
  })
})

test('守卫抛错或返回值无效时执行前与提示提交前检查拒绝，停机前检查放行并写原因', async () => {
  const thrown = call('Bash', { cmd: 'throw' })
  expectDeny(runEntry(entries.full, ['before-tool'], thrown), 'uapa: 守卫出错: boom')
  const invalid = call('Bash', { cmd: 'invalid' })
  expectDeny(runEntry(entries.full, ['before-tool'], invalid), 'uapa: 守卫返回值无效')
  const prompt = JSON.stringify({ session: 's1', prompt: 'throw' })
  expectDeny(runEntry(entries.full, ['before-prompt'], prompt), 'uapa: 守卫出错: boom')
  const data = await mkdtemp(join(dir, 'data-'))
  const stop = runEntry(
    entries.full,
    ['before-stop'],
    JSON.stringify({ session: 'throw' }),
    {
      TEST_DATA: data,
    },
  )
  assert.deepEqual(stop, {
    status: 0,
    stdout: '',
    stderr: 'uapa: 守卫出错: stop boom\n',
  })
})

test('rewrite：shell 且目标能改写时改写入参，其余按 fallbackReason 拒绝（F-04-02）', () => {
  const rewrite = call('Bash', { cmd: 'rewrite', timeout: 5 })
  assert.deepEqual(runEntry(entries.full, ['before-tool'], rewrite), {
    status: 0,
    stdout: '{"cmd":"echo safe","timeout":5}\n',
    stderr: '',
  })
  expectDeny(runEntry(entries.limited, ['before-tool'], rewrite), '请改用 echo safe')
  const read = call('Read', { action: 'rewrite' })
  expectDeny(runEntry(entries.full, ['before-tool'], read), '请改用 echo safe')
})

test('提示提交前检查；promptGate 为 false 或守卫未实现该检查时放行，不调用守卫', () => {
  const prompt = (text: string) => JSON.stringify({ session: 's1', prompt: text })
  expectDeny(runEntry(entries.full, ['before-prompt'], prompt('含密钥')), '含密钥')
  assert.deepEqual(runEntry(entries.full, ['before-prompt'], prompt('你好')), allowed)
  assert.deepEqual(
    runEntry(entries.limited, ['before-prompt'], prompt('throw')),
    allowed,
  )
  assert.deepEqual(
    runEntry(entries.toolOnly, ['before-prompt'], prompt('含密钥')),
    allowed,
  )
  // 守卫未实现停机前检查：不读写数据目录
  const stop = runEntry(
    entries.toolOnly,
    ['before-stop'],
    JSON.stringify({ session: 's1' }),
  )
  assert.deepEqual(stop, allowed)
})

test('skip 返回 true 时放行，不调用守卫', () => {
  const thrown = call('Bash', { cmd: 'throw' })
  const skipped = runEntry(entries.full, ['before-tool'], thrown, { TEST_SKIP: 's1' })
  assert.deepEqual(skipped, allowed)
  const other = runEntry(entries.full, ['before-tool'], thrown, { TEST_SKIP: 's2' })
  expectDeny(other, 'uapa: 守卫出错: boom')
})

test('停机计数按会话保存：先写临时文件再重命名，目录不存在时递归创建（F-04-05）', async () => {
  const data = join(await mkdtemp(join(dir, 'data-')), 'nested')
  const stop = (session: string) =>
    runEntry(entries.full, ['before-stop'], JSON.stringify({ session }), {
      TEST_DATA: data,
    })
  const file = (session: string) =>
    join(data, 'demo', `uapa-stop-${encodeURIComponent(session)}.json`)
  const outputs: string[] = []
  const counts: string[] = []
  for (const session of ['a', 'b', 'a', 'a', 'a']) {
    const result = stop(session)
    assert.equal(result.status, 0)
    assert.equal(result.stderr, '')
    outputs.push(`${session}:${result.stdout.trim()}`)
    counts.push(`${session}:${(await readFile(file(session), 'utf8')).trim()}`)
  }
  assert.deepEqual(outputs, [
    'a:{"reason":"继续 0"}',
    'b:{"reason":"继续 0"}',
    'a:{"reason":"继续 1"}',
    'a:',
    'a:{"reason":"继续 0"}',
  ])
  assert.deepEqual(counts, [
    'a:{"continuations":1}',
    'b:{"continuations":1}',
    'a:{"continuations":2}',
    'a:{"continuations":0}',
    'a:{"continuations":1}',
  ])
  stop('x/../y')
  assert.deepEqual((await readdir(join(data, 'demo'))).sort(), [
    'uapa-stop-a.json',
    'uapa-stop-b.json',
    'uapa-stop-x%2F..%2Fy.json',
  ])
})

test('数据目录为 null、不可写或计数文件无效时按 0 计，并在 stderr 写原因', async () => {
  const input = JSON.stringify({ session: 'a' })
  const none = runEntry(entries.full, ['before-stop'], input)
  assert.deepEqual(none, {
    status: 0,
    stdout: '{"reason":"继续 0"}\n',
    stderr: 'uapa: 没有插件数据目录，停机计数按 0 处理\n',
  })
  const readonly = await mkdtemp(join(dir, 'readonly-'))
  await mkdir(join(readonly, 'demo'))
  await writeFile(join(readonly, 'demo', 'uapa-stop-a.json'), '{"continuations":1}\n')
  await chmod(join(readonly, 'demo'), 0o500)
  try {
    const result = runEntry(entries.full, ['before-stop'], input, {
      TEST_DATA: readonly,
    })
    assert.equal(result.stdout, '{"reason":"继续 0"}\n')
    assert.match(result.stderr, /^uapa: 插件数据目录不可写，停机计数按 0 处理: /)
  } finally {
    await chmod(join(readonly, 'demo'), 0o700)
  }
  const corrupt = await mkdtemp(join(dir, 'corrupt-'))
  await mkdir(join(corrupt, 'demo'))
  await writeFile(join(corrupt, 'demo', 'uapa-stop-a.json'), '{"continuations":-1}\n')
  const result = runEntry(entries.full, ['before-stop'], input, { TEST_DATA: corrupt })
  assert.equal(result.stdout, '{"reason":"继续 0"}\n')
  assert.match(result.stderr, /^uapa: 停机计数文件内容无效，按 0 处理: /)
  const content = await readFile(join(corrupt, 'demo', 'uapa-stop-a.json'), 'utf8')
  assert.equal(content, '{"continuations":1}\n')
})
