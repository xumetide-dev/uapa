// 校验命令 hooks 声明（F-01-09）：每条失败分支给出字段路径
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { InputIssue } from '../../src/config/issues.ts'
import { validateConfig } from '../../src/config/validate.ts'
import { baseConfig } from '../helpers/project.ts'

const ROOT = '/work/project'
const targets = ['claude-code:subprocess', 'agy:subprocess']

function issues(commandHooks: unknown): InputIssue[] {
  const result = validateConfig(
    { ...baseConfig, targets, commandHooks },
    'uapa.config.ts',
    ROOT,
  )
  return result.ok ? [] : [...result.issues]
}

const at = (field: string, message: string) => ({
  file: 'uapa.config.ts',
  field,
  message,
})

test('合法声明通过：targets 可省略，command 可含 {pluginRoot}', () => {
  const hooks = [
    { event: 'SessionStart', command: 'node {pluginRoot}/scripts/start.mjs' },
    { event: 'PostToolUse', command: 'echo done', targets: ['agy:subprocess'] },
  ]
  assert.deepEqual(issues(hooks), [])
})

test('未知事件、空命令与含换行的命令', () => {
  assert.deepEqual(issues([{ event: 'Notification', command: 'echo' }]), [
    at('commandHooks[0].event', '未知事件 "Notification"'),
  ])
  assert.deepEqual(issues([{ event: 'Stop', command: '' }]), [
    at('commandHooks[0].command', '不能为空'),
  ])
  assert.deepEqual(issues([{ event: 'Stop', command: 'echo a\necho b' }]), [
    at('commandHooks[0].command', '应为单行，不能含换行'),
  ])
  assert.deepEqual(issues([{ event: 'Stop', command: 'echo a\r' }]), [
    at('commandHooks[0].command', '应为单行，不能含换行'),
  ])
})

test('targets 为空、重复、未知或未配置', () => {
  const hook = (hookTargets: unknown) => [
    { event: 'Stop', command: 'echo' },
    { event: 'Stop', command: 'echo', targets: hookTargets },
  ]
  assert.deepEqual(issues(hook([])), [
    at('commandHooks[1].targets', '至少列出一个目标'),
  ])
  assert.deepEqual(issues(hook(['agy:subprocess', 'agy:subprocess'])), [
    at('commandHooks[1].targets[1]', '重复的目标 agy:subprocess'),
  ])
  assert.deepEqual(issues(hook(['x:y'])), [
    at('commandHooks[1].targets[0]', '未知目标名 "x:y"'),
  ])
  assert.deepEqual(issues(hook(['agy:subprocess', 'codex:subprocess'])), [
    at('commandHooks[1].targets[1]', 'codex:subprocess 不在 targets 中'),
  ])
  assert.deepEqual(issues([{ event: 'Stop', command: 'echo', timeout: 10 }]), [])
})

test('timeout 须为正整数；matcher 等字段按未知字段拒绝；commandHooks 不是数组时报类型错误', () => {
  for (const timeout of [0, -1, 1.5, '10', null]) {
    assert.deepEqual(issues([{ event: 'Stop', command: 'echo', timeout }]), [
      at('commandHooks[0].timeout', '应为正整数'),
    ])
  }
  assert.deepEqual(
    issues([{ event: 'PreToolUse', command: 'echo', matcher: 'Bash', extra: 1 }]),
    [
      at('commandHooks[0].matcher', '未知字段'),
      at('commandHooks[0].extra', '未知字段'),
    ],
  )
  assert.deepEqual(
    issues({ event: 'Stop' }).map(issue => issue.field),
    ['commandHooks'],
  )
})
