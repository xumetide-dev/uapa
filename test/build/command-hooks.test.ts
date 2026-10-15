// 命令 hooks 的事件承载检查（F-03-15）：按能力数据的 commandHookEvents 得出各目标的
// TargetPlan.commandHooks，不承载时失败或跳过
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { planTargets } from '../../src/build/plan.ts'
import { targetCapabilities } from '../../src/capabilities/index.ts'
import type { CommandHookDecl, UapaConfig } from '../../src/config/types.ts'
import { baseConfig } from '../helpers/project.ts'

const SOURCE = { root: '/work', skills: [], overrides: {} }

function plan(commandHooks: readonly CommandHookDecl[]) {
  const config = {
    ...baseConfig,
    targets: ['claude-code:subprocess', 'agy:subprocess'],
    commandHooks,
  } as UapaConfig
  const states = planTargets(config, SOURCE, null, targetCapabilities)
  const [claude, agy] = states
  assert.ok(claude !== undefined && agy !== undefined)
  return { claude, agy }
}

test('适用且承载的声明按声明顺序列入；不适用的声明不计', () => {
  const hooks: CommandHookDecl[] = [
    { event: 'Stop', command: 'echo stop' },
    { event: 'SessionStart', command: 'echo start', targets: ['agy:subprocess'] },
    { event: 'PreToolUse', command: 'echo tool' },
  ]
  const { claude, agy } = plan(hooks)
  assert.deepEqual(claude.plan?.commandHooks, [hooks[0], hooks[2]])
  assert.deepEqual(agy.plan?.commandHooks, hooks)
  assert.deepEqual([...claude.skipped, ...agy.skipped], [])
})

test('未显式列出的目标不承载事件时写入 skipped，目标照常成功', () => {
  const hooks: CommandHookDecl[] = [
    { event: 'PreToolUse', command: 'echo tool' },
    { event: 'UserPromptSubmit', command: 'echo prompt' },
    { event: 'SessionEnd', command: 'echo end' },
  ]
  const { claude, agy } = plan(hooks)
  assert.deepEqual(claude.plan?.commandHooks, hooks)
  assert.deepEqual(agy.errors, [])
  assert.deepEqual(agy.plan?.commandHooks, [hooks[0]])
  assert.deepEqual(agy.skipped, [
    { component: 'commandHooks[1]', reason: '本目标不承载 UserPromptSubmit 事件' },
    { component: 'commandHooks[2]', reason: '本目标不承载 SessionEnd 事件' },
  ])
})

test('targets 显式列出的目标不承载事件时该目标失败，其他目标不受影响', () => {
  const hooks: CommandHookDecl[] = [
    {
      event: 'SessionEnd',
      command: 'echo end',
      targets: ['claude-code:subprocess', 'agy:subprocess'],
    },
  ]
  const { claude, agy } = plan(hooks)
  assert.deepEqual(agy.errors, [
    'commandHooks[0] 显式限定了本目标，但本目标不承载 SessionEnd 事件',
  ])
  assert.equal(agy.plan, null)
  assert.deepEqual(claude.errors, [])
  assert.deepEqual(claude.plan?.commandHooks, hooks)
})
