// 两种入口向守卫传入选项（F-04-09、F-05-18）：以声明三个选项的 optioned 守卫打包测试用子进程
// 入口与 hooks 模块入口，断言各检查收到的取值，以及取值无效时按守卫出错收口
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { bundle } from '../../src/bundle/index.ts'
import { claudeCodeInProcess } from '../../src/capabilities/claude-code-in-process.ts'
import type {
  GuardCheck,
  RuntimeOption,
  TargetRuntimeData,
} from '../../src/runtime/core/types.ts'
import { runEntry } from '../helpers/entry.ts'
import {
  api,
  ENGINE_RESULT,
  nextOf,
  only,
  type Registered,
  record,
} from '../helpers/hooks-module.ts'

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const OPTIONED = here('./guards/optioned.ts')

const DECLARED: RuntimeOption[] = [
  { name: 'label', type: 'string', default: 'alpha beta' },
  { name: 'limit', type: 'number', default: 3 },
  { name: 'strict', type: 'boolean', default: true },
]

const DEFAULTS = '{"label":"alpha beta","limit":3,"strict":true}'
const INVALID_LIMIT = 'uapa: 守卫选项无效: limit'

function data(options: readonly RuntimeOption[]): TargetRuntimeData {
  return {
    pluginName: 'optioned',
    toolNames: { Bash: 'shell' },
    capabilities: {
      rewriteInput: true,
      replaceOutput: false,
      withholdOutput: true,
      stopGate: true,
      promptGate: true,
    },
    moduleSessionEnv: null,
    options,
  }
}

let dir = ''
let declared = ''
let undeclared = ''
let modules = 0

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'uapa-options-'))
  const entry = async (name: string, options: readonly RuntimeOption[]) => {
    const code = await bundle({
      entry: here('./entries/test-subprocess.ts'),
      guardModule: OPTIONED,
      data: data(options),
      external: 'node',
    })
    const file = join(dir, name)
    await writeFile(file, code)
    return file
  }
  declared = await entry('declared.mjs', DECLARED)
  undeclared = await entry('undeclared.mjs', [])
})

after(() => rm(dir, { recursive: true, force: true }))

const STDIN = {
  'before-tool': JSON.stringify({ session: 's1', tool: 'Bash', input: { cmd: 'ls' } }),
  'before-prompt': JSON.stringify({ session: 's1', prompt: 'hi' }),
  'after-tool': JSON.stringify({
    session: 's1',
    tool: 'Bash',
    input: { cmd: 'ls' },
    output: 'x',
  }),
  'before-stop': JSON.stringify({ session: 's1' }),
}

// 四个检查各运行一次；数据目录在每次调用时新建，停机计数从 0 开始
function runAll(file: string, options: Readonly<Record<string, string>>) {
  const env = Object.fromEntries(
    Object.entries(options).map(([name, value]) => [`TEST_OPTION_${name}`, value]),
  )
  return Object.fromEntries(
    Object.entries(STDIN).map(([check, stdin]) => [
      check,
      runEntry(file, [check], stdin, { ...env, TEST_DATA: join(dir, 'data') }),
    ]),
  )
}

function expectValues(file: string, options: Record<string, string>, shown: string) {
  const results = runAll(file, options)
  const deny = (reason: string) => ({ status: 2, stdout: '', stderr: `${reason}\n` })
  assert.deepEqual(results['before-tool'], deny(`before-tool ${shown}`))
  assert.deepEqual(results['before-prompt'], deny(`before-prompt ${shown}`))
  assert.deepEqual(results['after-tool'], {
    status: 0,
    stdout: `${JSON.stringify({ block: `after-tool ${shown}` })}\n`,
    stderr: '',
  })
  assert.equal(
    results['before-stop']?.stdout,
    `${JSON.stringify({ reason: `before-stop ${shown}` })}\n`,
  )
}

test('子进程入口：宿主没有给出取值时各检查收到 default', () => {
  expectValues(declared, {}, DEFAULTS)
})

test('子进程入口：按 type 解析 optionValue 的文本', () => {
  const options = { label: 'x y=z', limit: ' 7 ', strict: 'false' }
  expectValues(declared, options, '{"label":"x y=z","limit":7,"strict":false}')
})

test('子进程入口：没有声明选项时 options 为空对象，optionValue 不被读取', () => {
  expectValues(undeclared, { limit: 'abc' }, '{}')
})

test('子进程入口：取值无效时按守卫出错收口，不调用守卫', async () => {
  const results = runAll(declared, { limit: 'abc', strict: 'TRUE' })
  const denied = { status: 2, stdout: '', stderr: `${INVALID_LIMIT}\n` }
  assert.deepEqual(results['before-tool'], denied)
  assert.deepEqual(results['before-prompt'], denied)
  // 执行后检查交出原因，与守卫抛错相同
  assert.deepEqual(results['after-tool'], {
    status: 0,
    stdout: `${JSON.stringify({ block: INVALID_LIMIT })}\n`,
    stderr: '',
  })
  // 停机前检查不阻止结束，在 stderr 写原因
  assert.deepEqual(results['before-stop'], {
    status: 0,
    stdout: '',
    stderr: `${INVALID_LIMIT}\n`,
  })
})

// hooks 模块入口：values 省略时 register 只收到 on
async function inProcess(checks: readonly GuardCheck[], ...values: [unknown?]) {
  const code = await bundle({
    entry: 'claude-code-in-process',
    guardModule: OPTIONED,
    data: {
      pluginName: 'optioned',
      toolNames: claudeCodeInProcess.toolNames,
      capabilities: claudeCodeInProcess.capabilities,
      moduleSessionEnv: null,
      options: DECLARED,
    },
    external: 'claude-code',
    checks,
  })
  modules += 1
  const file = join(dir, `module-${modules}.mjs`)
  await writeFile(file, code)
  const loaded = await import(pathToFileURL(file).href)
  return record(loaded.register, ...values)
}

const ALL: GuardCheck[] = ['beforeTool', 'beforePrompt', 'beforeStop']
const BASH = { tool: 'Bash', tool_use_id: 't', command: 'ls' }

async function decisions(registered: readonly Registered[]) {
  const tool = nextOf()
  const prompt = nextOf()
  const stop = nextOf()
  const $ = api('s1')
  return {
    tool: await only(registered, 'tool.call').hook($, BASH, tool.next),
    toolNext: tool.calls.length,
    prompt: await only(registered, 'prompt.submit').hook(
      $,
      { text: 'hi' },
      prompt.next,
    ),
    stop: await only(registered, 'classic.Stop').hook($, {}, stop.next),
    stopState: [...$.stateValues.values()],
  }
}

test('hooks 模块入口：register 未收到取值或取值不是对象时取 default', async () => {
  for (const values of [[], [undefined], ['x'], [{}], [{ limit: undefined }]] as [
    unknown?,
  ][]) {
    assert.deepEqual(await decisions(await inProcess(ALL, ...values)), {
      tool: { deny: `before-tool ${DEFAULTS}` },
      toolNext: 0,
      prompt: { drop: `before-prompt ${DEFAULTS}` },
      stop: { block: `before-stop ${DEFAULTS}` },
      stopState: [1],
    })
  }
})

test('hooks 模块入口：按 register 收到的带类型取值调用守卫', async () => {
  const values = { label: 'x', limit: 7, strict: false }
  const shown = '{"label":"x","limit":7,"strict":false}'
  assert.deepEqual(await decisions(await inProcess(ALL, values)), {
    tool: { deny: `before-tool ${shown}` },
    toolNext: 0,
    prompt: { drop: `before-prompt ${shown}` },
    stop: { block: `before-stop ${shown}` },
    stopState: [1],
  })
})

test('hooks 模块入口：类型不一致时按守卫出错收口，停机计数不变', async () => {
  assert.deepEqual(await decisions(await inProcess(ALL, { limit: '7' })), {
    tool: { deny: INVALID_LIMIT },
    toolNext: 0,
    prompt: { drop: INVALID_LIMIT },
    stop: ENGINE_RESULT,
    stopState: [],
  })
  // 只计划执行后检查时工具照常执行，输出按扣留处理
  const registered = await inProcess(['afterTool'], { limit: Number.NaN })
  const { next, calls } = nextOf()
  const result = await only(registered, 'tool.call').hook(api('s1'), BASH, next)
  assert.deepEqual([result, calls], [{ deny: INVALID_LIMIT }, [BASH]])
})
