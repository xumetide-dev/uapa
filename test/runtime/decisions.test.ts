// 守卫返回值检查（F-04-04、F-04-08，入口与打包接口第 4 节）：每个失败分支
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  checkAfterTool,
  checkBeforePrompt,
  checkBeforeStop,
  checkBeforeTool,
  guardErrorReason,
  INVALID_RESULT_REASON,
} from '../../src/runtime/core/decisions.ts'

const invalid = { ok: false, reason: INVALID_RESULT_REASON }

test('checkBeforeTool：合法返回值原样通过，多余字段去掉', () => {
  assert.deepEqual(checkBeforeTool({ kind: 'allow', extra: 1 }, 'shell'), {
    ok: true,
    value: { kind: 'allow' },
  })
  assert.deepEqual(checkBeforeTool({ kind: 'deny', reason: '不允许' }, 'shell'), {
    ok: true,
    value: { kind: 'deny', reason: '不允许' },
  })
  const rewrite = { kind: 'rewrite', input: { command: 'ls' }, fallbackReason: 'f' }
  assert.deepEqual(checkBeforeTool(rewrite, 'shell'), { ok: true, value: rewrite })
  // 非 shell 工具的 rewrite 不要求 command，由 F-04-02 按 fallbackReason 拒绝
  const other = { kind: 'rewrite', input: {}, fallbackReason: 'f' }
  assert.deepEqual(checkBeforeTool(other, 'read_file'), { ok: true, value: other })
})

test('checkBeforeTool：形状不符、原因空白、shell 改写缺命令时无效', () => {
  const cases: unknown[] = [
    undefined,
    null,
    'allow',
    [],
    { kind: 'ask' },
    { kind: 'deny' },
    { kind: 'deny', reason: '  ' },
    { kind: 'rewrite', input: { command: 'ls' } },
    { kind: 'rewrite', input: { command: 'ls' }, fallbackReason: '' },
    { kind: 'rewrite', input: null, fallbackReason: 'f' },
    { kind: 'rewrite', input: {}, fallbackReason: 'f' },
    { kind: 'rewrite', input: { command: '' }, fallbackReason: 'f' },
    { kind: 'rewrite', input: { command: 1 }, fallbackReason: 'f' },
  ]
  for (const value of cases) {
    assert.deepEqual(checkBeforeTool(value, 'shell'), invalid, JSON.stringify(value))
  }
})

test('checkBeforePrompt 与 checkBeforeStop', () => {
  assert.deepEqual(checkBeforePrompt({ kind: 'allow' }), {
    ok: true,
    value: { kind: 'allow' },
  })
  assert.deepEqual(checkBeforePrompt({ kind: 'block', reason: '含密钥' }), {
    ok: true,
    value: { kind: 'block', reason: '含密钥' },
  })
  for (const value of [null, { kind: 'block' }, { kind: 'block', reason: ' ' }, {}]) {
    assert.deepEqual(checkBeforePrompt(value), invalid)
  }
  assert.deepEqual(checkBeforeStop({ kind: 'stop' }), {
    ok: true,
    value: { kind: 'stop' },
  })
  assert.deepEqual(checkBeforeStop({ kind: 'continue', reason: '继续' }), {
    ok: true,
    value: { kind: 'continue', reason: '继续' },
  })
  for (const value of [
    undefined,
    { kind: 'continue' },
    { kind: 'continue', reason: '' },
  ]) {
    assert.deepEqual(checkBeforeStop(value), invalid)
  }
})

test('checkAfterTool：keep、replace、withhold 通过，多余字段去掉；text 或 reason 空白时无效', () => {
  assert.deepEqual(checkAfterTool({ kind: 'keep', text: 'x' }), {
    ok: true,
    value: { kind: 'keep' },
  })
  assert.deepEqual(checkAfterTool({ kind: 'replace', text: '新', reason: 'r' }), {
    ok: true,
    value: { kind: 'replace', text: '新' },
  })
  assert.deepEqual(checkAfterTool({ kind: 'withhold', reason: '扣留' }), {
    ok: true,
    value: { kind: 'withhold', reason: '扣留' },
  })
  const cases: unknown[] = [
    undefined,
    'keep',
    [],
    { kind: 'allow' },
    { kind: 'replace' },
    { kind: 'replace', text: ' ' },
    { kind: 'replace', text: 1 },
    { kind: 'replace', reason: '新' },
    { kind: 'withhold' },
    { kind: 'withhold', reason: '' },
    { kind: 'withhold', text: '扣留' },
  ]
  for (const value of cases) assert.deepEqual(checkAfterTool(value), invalid)
})

test('guardErrorReason 写明错误消息', () => {
  assert.equal(guardErrorReason(new Error('boom')), 'uapa: 守卫出错: boom')
  assert.equal(guardErrorReason('text'), 'uapa: 守卫出错: text')
})
