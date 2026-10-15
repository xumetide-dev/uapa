// 守卫公共类型（F-02-01、F-02-02、F-02-04、F-02-05）：包入口导出插件作者用到的类型；
// 类型不符时 tsc 报错，由 @ts-expect-error 在 pnpm check 中核对
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  AfterTool,
  BeforePrompt,
  BeforeStop,
  BeforeTool,
  Capability,
  GuardContext,
  GuardOption,
  GuardPlugin,
  PromptSubmit,
  ToolCall,
} from '../../src/index.ts'
import { CAPABILITIES } from '../../src/runtime/core/types.ts'

// 没有声明选项时入口传入的 GuardContext
const NO_OPTIONS: GuardContext = { options: {} }

test('Capability 含五项能力，与 CAPABILITIES 一致', () => {
  const all: readonly Capability[] = [
    'rewriteInput',
    'replaceOutput',
    'withholdOutput',
    'stopGate',
    'promptGate',
  ]
  assert.deepEqual(CAPABILITIES, all)
})

test('GuardPlugin 的三个检查方法按约定的返回值工作', async () => {
  const guard: GuardPlugin = {
    name: 'demo',
    requires: ['rewriteInput', 'promptGate'],
    beforeTool: (call: ToolCall): BeforeTool =>
      call.tool === 'shell'
        ? { kind: 'deny', reason: '禁止 shell' }
        : { kind: 'allow' },
    beforePrompt: async (p: PromptSubmit): Promise<BeforePrompt> =>
      p.prompt.includes('密钥')
        ? { kind: 'block', reason: '含密钥' }
        : { kind: 'allow' },
    beforeStop: (s): BeforeStop =>
      s.continuations < 1 ? { kind: 'continue', reason: '继续' } : { kind: 'stop' },
  }
  const call = { sessionId: 's', tool: 'shell', input: {} }
  assert.deepEqual(guard.beforeTool?.(call, NO_OPTIONS), {
    kind: 'deny',
    reason: '禁止 shell',
  })
  const prompt = { sessionId: 's', prompt: '含密钥的提示' }
  assert.deepEqual(await guard.beforePrompt?.(prompt, NO_OPTIONS), {
    kind: 'block',
    reason: '含密钥',
  })
  assert.deepEqual(
    guard.beforeStop?.({ sessionId: 's', continuations: 1 }, NO_OPTIONS),
    {
      kind: 'stop',
    },
  )
})

test('afterTool 接收调用与输出文本，返回 AfterTool（F-02-04）', async () => {
  const guard: GuardPlugin = {
    name: 'demo',
    requires: ['replaceOutput', 'withholdOutput'],
    afterTool: async (call: ToolCall, output: string): Promise<AfterTool> => {
      if (output.includes('密钥')) return { kind: 'replace', text: '[已隐去]' }
      return call.tool === 'web_fetch'
        ? { kind: 'withhold', reason: '不读取网页' }
        : { kind: 'keep' }
    },
  }
  const call = { sessionId: 's', tool: 'shell', input: {} }
  assert.deepEqual(await guard.afterTool?.(call, '含密钥', NO_OPTIONS), {
    kind: 'replace',
    text: '[已隐去]',
  })
  assert.deepEqual(await guard.afterTool?.(call, 'ok', NO_OPTIONS), { kind: 'keep' })
})

test('检查方法从最后一个参数 GuardContext 读取选项取值（F-02-05）', () => {
  const limit: GuardOption = {
    type: 'number',
    title: '上限',
    description: '命令长度上限',
    default: 10,
  }
  const guard: GuardPlugin = {
    name: 'demo',
    requires: [],
    options: { limit },
    beforeTool: (call, ctx) =>
      String(call.input.command).length > Number(ctx.options.limit)
        ? { kind: 'deny', reason: `超过 ${ctx.options.limit}` }
        : { kind: 'allow' },
  }
  const call = { sessionId: 's', tool: 'shell', input: { command: 'echo 12345' } }
  assert.deepEqual(guard.beforeTool?.(call, { options: { limit: 5 } }), {
    kind: 'deny',
    reason: '超过 5',
  })
  assert.deepEqual(guard.beforeTool?.(call, { options: { limit: 10 } }), {
    kind: 'allow',
  })
})

test('类型不符时 tsc 报错', () => {
  // @ts-expect-error afterTool 的返回值只有 keep、replace 与 withhold
  const after: GuardPlugin = { name: 'demo', requires: [], afterTool: () => undefined }
  // @ts-expect-error requires 只能写 Capability
  const unknown: GuardPlugin = { name: 'demo', requires: ['afterTool'] }
  // @ts-expect-error BeforePrompt 只有 allow 与 block
  const rewrite: BeforePrompt = { kind: 'rewrite', reason: 'x' }
  // @ts-expect-error replace 须带 text
  const replace: AfterTool = { kind: 'replace', reason: 'x' }
  // @ts-expect-error default 的类型须与 type 一致
  const mismatch: GuardOption = {
    type: 'number',
    title: 't',
    description: 'd',
    default: '1',
  }
  // @ts-expect-error 选项须有 default
  const noDefault: GuardOption = { type: 'string', title: 't', description: 'd' }
  assert.ok(after && unknown && rewrite && replace && mismatch && noDefault)
})
