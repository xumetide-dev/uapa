// 守卫公共类型（F-02-01、F-02-02）：包入口导出插件作者用到的类型，GuardPlugin 不含
// afterTool；类型不符时 tsc 报错，由 @ts-expect-error 在 pnpm check 中核对
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  BeforePrompt,
  BeforeStop,
  BeforeTool,
  Capability,
  GuardPlugin,
  PromptSubmit,
  ToolCall,
} from '../../src/index.ts'
import { CAPABILITIES } from '../../src/runtime/core/types.ts'

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
  assert.deepEqual(guard.beforeTool?.(call), { kind: 'deny', reason: '禁止 shell' })
  const prompt = { sessionId: 's', prompt: '含密钥的提示' }
  assert.deepEqual(await guard.beforePrompt?.(prompt), {
    kind: 'block',
    reason: '含密钥',
  })
  assert.deepEqual(guard.beforeStop?.({ sessionId: 's', continuations: 1 }), {
    kind: 'stop',
  })
})

test('GuardPlugin 不含 afterTool（SD-20），类型不符时 tsc 报错', () => {
  // @ts-expect-error v0.1.0 没有执行后检查
  const after: GuardPlugin = { name: 'demo', requires: [], afterTool: () => undefined }
  // @ts-expect-error requires 只能写 Capability
  const unknown: GuardPlugin = { name: 'demo', requires: ['afterTool'] }
  // @ts-expect-error BeforePrompt 只有 allow 与 block
  const rewrite: BeforePrompt = { kind: 'rewrite', reason: 'x' }
  assert.ok(after && unknown && rewrite)
})
