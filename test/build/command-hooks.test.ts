// 命令 hooks 的事件承载检查（F-03-15）：按能力数据的 commandHookEvents 得出各目标的
// TargetPlan.commandHooks，不承载时失败或跳过
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { planTargets } from '../../src/build/plan.ts'
import { targetCapabilities } from '../../src/capabilities/index.ts'
import type { CommandHookDecl, UapaConfig } from '../../src/config/types.ts'
import { baseConfig } from '../helpers/project.ts'

const SOURCE = {
  root: '/work',
  skills: [],
  agents: [],
  mcpServers: [],
  rules: [],
  commands: [],
  overrides: {},
  files: [],
}

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

// 承接 M1-06 验收 §7 第 1 行：同一宿主的另一目标承载该事件时不写 skipped
test('两个 Claude Code 目标：声明列入 claude-code:subprocess，claude-code:in-process 不承载也不写 skipped', () => {
  const config = {
    ...baseConfig,
    targets: ['claude-code:in-process', 'claude-code:subprocess'],
    commandHooks: [{ event: 'SessionEnd', command: 'echo uapa-session-probe' }],
  } as UapaConfig
  const [inProcess, subprocess] = planTargets(config, SOURCE, null, targetCapabilities)
  assert.ok(inProcess !== undefined && subprocess !== undefined)
  assert.deepEqual(subprocess.plan?.commandHooks, config.commandHooks)
  assert.deepEqual(inProcess.plan?.commandHooks, [])
  assert.deepEqual([...inProcess.skipped, ...inProcess.errors], [])
  // 只配置 claude-code:in-process 时没有承载该事件的同宿主目标，写入 skipped
  const alone = { ...config, targets: ['claude-code:in-process'] } as UapaConfig
  const [only] = planTargets(alone, SOURCE, null, targetCapabilities)
  assert.deepEqual(only?.skipped, [
    { component: 'commandHooks[0]', reason: '本目标不承载 SessionEnd 事件' },
  ])
})
