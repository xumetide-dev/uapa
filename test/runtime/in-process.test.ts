// hooks 模块的决策与异常收口（TA-17、TA-19，F-05-05～F-05-08、F-05-13）：以 node:module 的解析钩子把
// 'claude-code' 解析到 stubs/claude-code.ts，加载打包后的守卫文件，调用 register 后逐一调用
// 记录到的处理函数与 .catch 处理器。claude-both 夹具的产物覆盖决策；守卫抛错、返回值无效与
// 只计划部分检查的情况另以 scripted 守卫打包。
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { bundle } from '../../src/bundle/index.ts'
import { claudeCodeInProcess } from '../../src/capabilities/claude-code-in-process.ts'
import type { GuardCheck } from '../../src/runtime/core/types.ts'
import { readCase, withFixtureRun } from '../fixtures/run.ts'
import {
  api,
  ENGINE_RESULT,
  nextOf,
  only,
  type Registered,
  record,
} from '../helpers/hooks-module.ts'

const SCRIPTED = fileURLToPath(new URL('./guards/scripted.ts', import.meta.url))

let dir = ''
let both: Registered[] = []
let bothEnv = ''

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'uapa-in-process-'))
  const name = 'claude-both'
  both = await withFixtureRun(name, await readCase(name), async run => {
    assert.equal(run.exitCode, 0, run.stderr)
    const file = join(run.project, 'dist', 'claude-code', 'hooks', 'uapa-guard.mjs')
    const loaded = await import(pathToFileURL(file).href)
    return record(loaded.register)
  })
  bothEnv = 'UAPA_MODULE_SESSION_BOTH_GUARD'
})
after(() => rm(dir, { recursive: true, force: true }))

// 以 scripted 守卫打包入口并加载；每次写入不同的文件，模块各自独立
let bundles = 0
async function scripted(
  checks: readonly GuardCheck[],
  moduleSessionEnv: string | null,
): Promise<Registered[]> {
  const code = await bundle({
    entry: 'claude-code-in-process',
    guardModule: SCRIPTED,
    data: {
      pluginName: 'scripted-guard',
      toolNames: claudeCodeInProcess.toolNames,
      capabilities: claudeCodeInProcess.capabilities,
      moduleSessionEnv,
      options: [],
    },
    external: 'claude-code',
    checks,
  })
  bundles += 1
  const file = join(dir, `guard-${bundles}.mjs`)
  await writeFile(file, code)
  const loaded = await import(pathToFileURL(file).href)
  return record(loaded.register)
}

test('claude-both：按计划的检查注册处理函数，执行前与提示提交前检查带 .catch', () => {
  assert.deepEqual(
    both.map(r => [r.event, r.matcher, r.catchHandler !== null]),
    [
      ['session.start', null, false],
      ['classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, false],
      ['tool.call', null, true],
      ['prompt.submit', null, true],
      ['classic.Stop', null, false],
    ],
  )
})

test('session.start 与 classic.SessionStart 以 UAPA_MODULE_SESSION_<插件名> 写入会话 id', async () => {
  for (const event of ['session.start', 'classic.SessionStart']) {
    const $ = api('fixture-session')
    const { next, calls } = nextOf()
    const e = { source: 'clear' }
    const result = await only(both, event).hook($, e, next)
    assert.deepEqual($.envCalls, [[bothEnv, 'fixture-session']])
    assert.deepEqual([result, calls], [ENGINE_RESULT, [e]])
  }
})

test('classic.SessionStart 优先写事件的 session_id：/branch 与 /resume 之后 $.session.id() 仍为旧会话 id', async () => {
  const hook = only(both, 'classic.SessionStart').hook
  for (const [e, written] of [
    [{ source: 'fork', session_id: 'fixture-branched' }, 'fixture-branched'],
    [{ source: 'resume', session_id: 'fixture-resumed' }, 'fixture-resumed'],
    [{ source: 'clear', session_id: '' }, 'fixture-previous'],
    [{ source: 'clear', session_id: 7 }, 'fixture-previous'],
  ] as const) {
    const $ = api('fixture-previous')
    const { next } = nextOf()
    await hook($, e, next)
    assert.deepEqual($.envCalls, [[bothEnv, written]], JSON.stringify(e))
  }
})

test('tool.call：放行调用 next，拒绝返回 { deny }，Bash 改写以 next 写回，非 Bash 改写按 fallbackReason 拒绝', async () => {
  const hook = only(both, 'tool.call').hook
  const call = async (e: Record<string, unknown>) => {
    const { next, calls } = nextOf()
    return { result: await hook(api('s'), e, next), calls }
  }
  const bash = (command: string) => ({
    tool: 'Bash',
    tool_use_id: 'toolu_fixture',
    command,
    description: '夹具',
  })
  const allowed = bash('echo hello')
  assert.deepEqual(await call(allowed), { result: ENGINE_RESULT, calls: [allowed] })
  assert.deepEqual(await call(bash('echo uapa-deny-probe')), {
    result: { deny: '拒绝标记命令 uapa-deny-probe' },
    calls: [],
  })
  const rewrite = bash('echo uapa-rewrite-probe hello')
  assert.deepEqual(await call(rewrite), {
    result: ENGINE_RESULT,
    calls: [{ ...rewrite, command: 'echo uapa-rewritten hello' }],
  })
  const powershell = { ...rewrite, tool: 'PowerShell' }
  assert.deepEqual(await call(powershell), {
    result: { deny: '请改用 echo uapa-rewritten' },
    calls: [],
  })
  const read = { tool: 'Read', tool_use_id: 't', file_path: 'a.md' }
  assert.deepEqual(await call(read), { result: ENGINE_RESULT, calls: [read] })
})

test('prompt.submit：阻断返回 { drop }，放行调用 next', async () => {
  const hook = only(both, 'prompt.submit').hook
  const blocked = nextOf()
  const e = { text: '部署 API_KEY=abc', context: [], attachments: [] }
  assert.deepEqual(await hook(api('s'), e, blocked.next), { drop: '提示中含疑似密钥' })
  assert.deepEqual(blocked.calls, [])
  const allowed = nextOf()
  const plain = { text: '你好' }
  assert.equal(await hook(api('s'), plain, allowed.next), ENGINE_RESULT)
  assert.deepEqual(allowed.calls, [plain])
})

test('classic.Stop：继续返回 { block } 并加 1，结束调用 next 并清零', async () => {
  const hook = only(both, 'classic.Stop').hook
  const $ = api('s')
  const counts: unknown[] = []
  const results: unknown[] = []
  for (let i = 0; i < 4; i++) {
    const { next } = nextOf()
    results.push(await hook($, { stop_hook_active: i > 0 }, next))
    counts.push($.stateValues.get('both-guard/uapaStopContinuations'))
  }
  const block = { block: '请先运行测试再结束' }
  assert.deepEqual(results, [block, block, ENGINE_RESULT, block])
  assert.deepEqual(counts, [1, 2, 0, 1])
})

test('.catch：next 未调用时返回 { deny }、{ drop }，已调用时重放 next', async () => {
  const tool = only(both, 'tool.call').catchHandler
  const prompt = only(both, 'prompt.submit').catchHandler
  assert.ok(tool !== null && prompt !== null)
  const e = { tool: 'Bash', tool_use_id: 't', command: 'echo hello' }
  const fresh = nextOf(false)
  assert.deepEqual(await tool(api('s'), e, fresh.next), {
    deny: 'uapa: hooks 模块出错',
  })
  assert.deepEqual(await prompt(api('s'), { text: 'x' }, fresh.next), {
    drop: 'uapa: hooks 模块出错',
  })
  assert.deepEqual(fresh.calls, [])
  const called = nextOf(true)
  assert.equal(await tool(api('s'), e, called.next), ENGINE_RESULT)
  assert.deepEqual(called.calls, [e])
})

test('守卫抛错或返回值无效：执行前检查拒绝，提示提交前检查丢弃，停机前检查不阻止结束且计数不变', async () => {
  const registered = await scripted(['beforeTool', 'beforePrompt', 'beforeStop'], null)
  const tool = only(registered, 'tool.call').hook
  const shell = (command: string) => ({ tool: 'Bash', tool_use_id: 't', command })
  assert.deepEqual(await tool(api('s'), shell('throw'), nextOf().next), {
    deny: 'uapa: 守卫出错: boom',
  })
  assert.deepEqual(await tool(api('s'), shell('invalid'), nextOf().next), {
    deny: 'uapa: 守卫返回值无效',
  })
  assert.deepEqual(
    await tool(api('s'), { tool: 'Bash', tool_use_id: 't' }, nextOf().next),
    { deny: 'uapa: 无法解析宿主输入: tool.command' },
  )
  const prompt = only(registered, 'prompt.submit').hook
  assert.deepEqual(await prompt(api('s'), { text: 'throw' }, nextOf().next), {
    drop: 'uapa: 守卫出错: boom',
  })
  assert.deepEqual(await prompt(api('s'), { text: 1 }, nextOf().next), {
    drop: 'uapa: 无法解析宿主输入: text',
  })
  const stop = only(registered, 'classic.Stop').hook
  const $ = api('throw')
  const { next, calls } = nextOf()
  assert.equal(await stop($, {}, next), ENGINE_RESULT)
  assert.equal(calls.length, 1)
  assert.equal($.stateValues.size, 0)
})

test('去重变量为 null 时不注册会话事件；只计划的检查才注册处理函数', async () => {
  const registered = await scripted(['beforeTool'], null)
  assert.deepEqual(
    registered.map(r => r.event),
    ['tool.call'],
  )
  const withEnv = await scripted(['beforePrompt'], 'UAPA_MODULE_SESSION_SCRIPTED_GUARD')
  assert.deepEqual(
    withEnv.map(r => r.event),
    ['session.start', 'classic.SessionStart', 'prompt.submit'],
  )
})

// next 返回给定的结果，记录收到的事件
function ranWith(result: unknown, called = false) {
  const calls: unknown[] = []
  const next = Object.assign(
    async (e: unknown) => {
      calls.push(e)
      return result
    },
    { called },
  )
  return { next, calls }
}

test('执行后检查：只计划 afterTool 时也只注册一个不带 matcher 的 tool.call，带 .catch', async () => {
  const registered = await scripted(['afterTool'], null)
  assert.deepEqual(
    registered.map(r => [r.event, r.matcher, r.catchHandler !== null]),
    [['tool.call', null, true]],
  )
  const combined = await scripted(['beforeTool', 'afterTool'], null)
  assert.deepEqual(
    combined.map(r => r.event),
    ['tool.call'],
  )
})

test('执行后检查：keep 原样返回，Bash 与 Read 以 { ...ran, result } 替换，其余返回 { deny }', async () => {
  const hook = only(await scripted(['afterTool'], null), 'tool.call').hook
  const bashCall = {
    tool: 'Bash',
    tool_use_id: 't',
    command: 'echo uapa-after-tool-probe',
  }
  const run = async (e: object, ran: unknown) => hook(api('s'), e, ranWith(ran).next)
  const bash = (stdout: string) => ({
    ref: 'r1',
    result: { stdout, stderr: 'w', interrupted: false },
    text: stdout,
    isReadOnly: false,
  })
  const kept = bash('uapa-keep-probe')
  assert.equal(await run(bashCall, kept), kept)
  const replaced = bash('uapa-replace-probe')
  assert.deepEqual(await run(bashCall, replaced), {
    ...replaced,
    result: { stdout: 'uapa-replaced', stderr: '', interrupted: false },
  })
  const readCall = { tool: 'Read', tool_use_id: 't', file_path: 'a.txt' }
  const read = {
    ref: 'r2',
    result: {
      type: 'text',
      file: { filePath: 'a.txt', content: 'uapa-replace-probe' },
    },
    text: '1\tuapa-replace-probe',
  }
  assert.deepEqual(await run(readCall, read), {
    ...read,
    result: { type: 'text', file: { filePath: 'a.txt', content: 'uapa-replaced' } },
  })
  // withhold 与不可替换形状的 replace 返回 { deny }；报错的结果同样检查
  assert.deepEqual(await run(bashCall, bash('uapa-withhold-probe')), {
    deny: 'uapa-withheld',
  })
  const globCall = { tool: 'Glob', tool_use_id: 't', pattern: '*' }
  const glob = { ref: 'r3', result: { filenames: ['uapa-replace-probe'] }, text: 'x' }
  assert.deepEqual(await run(globCall, glob), { deny: 'uapa-replaced' })
  const failed = { ref: 'r4', result: 'Error: uapa-withhold-probe', isError: true }
  assert.deepEqual(await run(bashCall, failed), { deny: 'uapa-withheld' })
  // next 的结果含 deny 时原样返回，不调用守卫
  const denied = { deny: '下层拒绝', result: 'uapa-throw-probe' }
  assert.equal(await run(bashCall, denied), denied)
})

test('执行后检查：守卫抛错与返回值无效时返回 { deny }（F-04-08）', async () => {
  const hook = only(await scripted(['afterTool'], null), 'tool.call').hook
  const e = { tool: 'Bash', tool_use_id: 't', command: 'echo uapa-after-tool-probe' }
  const result = (stdout: string) => ({ result: { stdout, stderr: '' } })
  assert.deepEqual(await hook(api('s'), e, ranWith(result('uapa-throw-probe')).next), {
    deny: 'uapa: 守卫出错: after boom',
  })
  assert.deepEqual(
    await hook(api('s'), e, ranWith(result('uapa-invalid-probe')).next),
    { deny: 'uapa: 守卫返回值无效' },
  )
})

test('执行前与执行后检查在同一处理函数中：拒绝时不调用 next，改写后执行后检查看到新命令', async () => {
  const hook = only(await scripted(['beforeTool', 'afterTool'], null), 'tool.call').hook
  const shell = (command: string) => ({ tool: 'Bash', tool_use_id: 't', command })
  const denied = ranWith({ result: { stdout: 'uapa-keep-probe', stderr: '' } })
  assert.deepEqual(await hook(api('s'), shell('deny'), denied.next), { deny: '不允许' })
  assert.deepEqual(denied.calls, [])
  const echoed = ranWith({ result: { stdout: 'uapa-echo-probe', stderr: '' } })
  assert.deepEqual(await hook(api('s'), shell('rewrite'), echoed.next), {
    deny: 'shell {"command":"echo safe"} uapa-echo-probe',
  })
  assert.deepEqual(echoed.calls, [shell('echo safe')])
})

test('.catch：计划了执行后检查时，next 已调用也返回 { deny }，不重放原输出', async () => {
  for (const checks of [['afterTool'], ['beforeTool', 'afterTool']] as const) {
    const handler = only(await scripted(checks, null), 'tool.call').catchHandler
    assert.ok(handler !== null)
    const e = { tool: 'Bash', tool_use_id: 't', command: 'echo uapa-after-tool-probe' }
    for (const called of [false, true]) {
      const { next, calls } = nextOf(called)
      assert.deepEqual(await handler(api('s'), e, next), {
        deny: 'uapa: hooks 模块出错',
      })
      assert.deepEqual(calls, [])
    }
  }
})

// TA-19：以桩加载 after-tool 夹具产物中的 hooks/uapa-guard.mjs
test('after-tool 夹具的 hooks 模块：保留、替换、扣留、出错与 next 结果含 deny（TA-19）', async () => {
  const name = 'after-tool'
  const registered = await withFixtureRun(name, await readCase(name), async run => {
    assert.equal(run.exitCode, 0, run.stderr)
    const file = join(run.project, 'dist', 'claude-code', 'hooks', 'uapa-guard.mjs')
    return record((await import(pathToFileURL(file).href)).register)
  })
  const entry = only(registered, 'tool.call')
  const e = { tool: 'Bash', tool_use_id: 't', command: 'echo uapa-after-tool-probe' }
  const run = async (ran: unknown) => entry.hook(api('s'), e, ranWith(ran).next)
  const bash = (stdout: string) => ({
    ref: 'r',
    result: { stdout, stderr: '' },
    text: stdout,
  })
  const kept = bash('uapa-keep-probe\n')
  assert.equal(await run(kept), kept)
  const replaced = bash('uapa-replace-probe\n')
  assert.deepEqual(await run(replaced), {
    ...replaced,
    result: { stdout: 'uapa-replaced\n', stderr: '' },
  })
  assert.deepEqual(await run(bash('uapa-withhold-probe')), {
    deny: '扣留标记输出 uapa-withhold-probe',
  })
  assert.deepEqual(await run(bash('uapa-throw-probe')), {
    deny: 'uapa: 守卫出错: 标记输出 uapa-throw-probe',
  })
  assert.deepEqual(await run(bash('uapa-invalid-probe')), {
    deny: 'uapa: 守卫返回值无效',
  })
  const failed = { ref: 'r', result: 'Error: uapa-replace-probe', isError: true }
  assert.deepEqual(await run(failed), { deny: 'Error: uapa-replaced' })
  const denied = { deny: '下层拒绝', result: 'uapa-throw-probe' }
  assert.equal(await run(denied), denied)
  assert.ok(entry.catchHandler !== null)
  const called = nextOf(true)
  assert.deepEqual(await entry.catchHandler(api('s'), e, called.next), {
    deny: 'uapa: hooks 模块出错',
  })
  assert.deepEqual(called.calls, [])
})
