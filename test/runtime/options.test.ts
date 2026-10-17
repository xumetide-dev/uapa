// 守卫选项的取值（F-04-09）：文本的解析、hooks 模块取值的检查，以及传给检查方法的
// GuardContext
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  guardContext,
  optionsFromText,
  optionsFromValues,
} from '../../src/runtime/core/options.ts'
import type { RuntimeOption } from '../../src/runtime/core/types.ts'

// 按 name 排序，与 TargetRuntimeData.options 一致
const DECLARED: RuntimeOption[] = [
  { name: 'label', type: 'string', default: 'alpha beta' },
  { name: 'limit', type: 'number', default: 3 },
  { name: 'strict', type: 'boolean', default: true },
]

const DEFAULTS = { label: 'alpha beta', limit: 3, strict: true }

const fromText = (values: Readonly<Record<string, string>>) =>
  optionsFromText(DECLARED, name => values[name])

test('文本：没有给出时取 default，string 原样取用，number 与 boolean 按 type 解析', () => {
  assert.deepEqual(fromText({}), { ok: true, options: DEFAULTS })
  assert.deepEqual(fromText({ label: '', limit: ' 7 ', strict: 'false' }), {
    ok: true,
    options: { label: '', limit: 7, strict: false },
  })
  assert.deepEqual(fromText({ label: 'x y=z', limit: '-1.5e2', strict: 'true' }), {
    ok: true,
    options: { label: 'x y=z', limit: -150, strict: true },
  })
})

test('文本：number 为空、非数或非有限数，boolean 不是 true 或 false 时无效', () => {
  for (const limit of ['', '  ', 'abc', 'Infinity', '1e400', 'NaN']) {
    assert.deepEqual(fromText({ limit }), { ok: false, name: 'limit' }, limit)
  }
  for (const strict of ['TRUE', 'False', '1', '', 'yes']) {
    assert.deepEqual(fromText({ strict }), { ok: false, name: 'strict' }, strict)
  }
  // 多个无效时返回按 name 顺序的第一个
  assert.deepEqual(fromText({ strict: 'x', limit: 'x' }), { ok: false, name: 'limit' })
})

test('取值：不是对象、缺少该键或为 undefined 时取 default', () => {
  for (const values of [undefined, null, 'x', 1, [], {}, { limit: undefined }]) {
    assert.deepEqual(
      optionsFromValues(DECLARED, values),
      { ok: true, options: DEFAULTS },
      JSON.stringify(values),
    )
  }
  // 原型链上的键不算给出
  const inherited = Object.create({ limit: 9 })
  assert.deepEqual(optionsFromValues(DECLARED, inherited), {
    ok: true,
    options: DEFAULTS,
  })
  const values = { label: 'x', limit: 7, strict: false, extra: 1 }
  assert.deepEqual(optionsFromValues(DECLARED, values), {
    ok: true,
    options: { label: 'x', limit: 7, strict: false },
  })
})

test('取值：类型与声明不一致或 number 不是有限数时无效', () => {
  const cases: [Record<string, unknown>, string][] = [
    [{ limit: '7' }, 'limit'],
    [{ limit: Number.NaN }, 'limit'],
    [{ limit: Number.POSITIVE_INFINITY }, 'limit'],
    [{ strict: 'false' }, 'strict'],
    [{ label: 1 }, 'label'],
    [{ label: null }, 'label'],
  ]
  for (const [values, name] of cases) {
    assert.deepEqual(
      optionsFromValues(DECLARED, values),
      { ok: false, name },
      JSON.stringify(values),
    )
  }
})

test('没有声明选项时 options 为空对象；无效时 GuardContext 为守卫出错的原因', () => {
  assert.deepEqual(
    optionsFromText([], () => 'x'),
    { ok: true, options: {} },
  )
  assert.deepEqual(optionsFromValues([], { limit: 1 }), { ok: true, options: {} })
  assert.deepEqual(guardContext({ ok: true, options: { limit: 1 } }), {
    ok: true,
    value: { options: { limit: 1 }, cwd: null },
  })
  assert.deepEqual(guardContext({ ok: true, options: { limit: 1 } }, '/work/dir'), {
    ok: true,
    value: { options: { limit: 1 }, cwd: '/work/dir' },
  })
  assert.deepEqual(guardContext({ ok: false, name: 'limit' }, '/work/dir'), {
    ok: false,
    reason: 'uapa: 守卫选项无效: limit',
  })
})
