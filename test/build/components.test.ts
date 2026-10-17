// rules 与 commands 的能力检查与放置（F-03-16，SD-32、SD-33）：以测试用的宿主模块与能力数据运行。
// commands 由构建编排原样复制，rules 交给宿主模块；读取失败不写任何文件（TA-21）。
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import type { BuildOutcome } from '../../src/build/index.ts'
import { claudeCodeSubprocess } from '../../src/capabilities/claude-code-subprocess.ts'
import type { TargetCapabilities } from '../../src/capabilities/types.ts'
import type { Rule } from '../../src/source/types.ts'
import { claudeCode } from '../../src/targets/claude-code/index.ts'
import { buildIn, deps, fakeHost, TARGET, writesManifest } from '../helpers/build.ts'

function done(outcome: BuildOutcome) {
  assert.equal(outcome.kind, 'done')
  return outcome as Extract<BuildOutcome, { kind: 'done' }>
}

const COMMAND = (extra = '') => `---\ndescription: 审查改动\n${extra}---\n\n审查 $1。\n`
const RULE = (extra = '') => `---\nactivation: always\n${extra}---\n\n使用中文。\n`

const withComponents = (
  components: Partial<TargetCapabilities['components']>,
): TargetCapabilities => ({
  ...claudeCodeSubprocess,
  components: { ...claudeCodeSubprocess.components, ...components },
})

test('commands 原样复制为插件目录的 commands/<name>.md', async () => {
  const text = COMMAND(`targets: [${TARGET}]\nallowed-tools: Read\n`)
  await buildIn({ 'commands/review.md': text }, deps(), async (root, outcome) => {
    const [entry] = done(outcome).report.targets
    assert.equal(entry?.status, 'ok')
    assert.deepEqual(entry?.skipped, [])
    const written = join(root, 'dist/claude-code/commands/review.md')
    assert.equal(await readFile(written, 'utf8'), text)
  })
})

test('不能承载 commands 时：未写 targets 的 command 跳过，显式写了本目标的使目标失败', async () => {
  const noCommands = withComponents({ commands: 'none' })
  await buildIn(
    { 'commands/review.md': COMMAND() },
    deps(writesManifest, noCommands),
    async (root, outcome) => {
      const [entry] = done(outcome).report.targets
      assert.equal(entry?.status, 'ok')
      assert.deepEqual(entry?.skipped, [
        { component: 'commands/review.md', reason: '本目标不能承载 commands' },
      ])
      assert.ok(!existsSync(join(root, 'dist/claude-code/commands')))
    },
  )
  const explicit = { 'commands/review.md': COMMAND(`targets: [${TARGET}]\n`) }
  await buildIn(explicit, deps(writesManifest, noCommands), async (root, outcome) => {
    const [entry] = done(outcome).report.targets
    assert.equal(entry?.status, 'failed')
    assert.deepEqual(entry?.errors, [
      'command review 显式限定了本目标，但本目标不能承载 commands',
    ])
    assert.ok(!existsSync(join(root, 'dist/claude-code')))
  })
})

test('不能承载 rules 时：未写 targets 的 rule 跳过，显式写了本目标的使目标失败', async () => {
  const noRules = deps(writesManifest, withComponents({ rules: 'none' }))
  await buildIn({ 'rules/style.md': RULE() }, noRules, async (root, outcome) => {
    const [entry] = done(outcome).report.targets
    assert.equal(entry?.status, 'ok')
    assert.deepEqual(entry?.skipped, [
      { component: 'rules/style.md', reason: '本目标不能承载 rules' },
    ])
    assert.ok(!existsSync(join(root, 'dist/claude-code/rules')))
  })
  const explicit = { 'rules/style.md': RULE(`targets: [${TARGET}]\n`) }
  await buildIn(explicit, noRules, async (_root, outcome) => {
    const [entry] = done(outcome).report.targets
    assert.equal(entry?.status, 'failed')
    assert.deepEqual(entry?.errors, [
      'rule style 显式限定了本目标，但本目标不能承载 rules',
    ])
  })
})

test('承载 rules 时交给宿主模块，构建编排不复制 rules/', async () => {
  let rules: readonly Rule[] | undefined
  const host = fakeHost(async input => {
    rules = input.plans[0]?.rules
    return { ok: true, files: [], skipped: [], residualRisks: [] }
  })
  const files = {
    'rules/style.md': RULE(),
    'rules/agy-only.md': RULE('targets: [agy:subprocess]\n'),
  }
  await buildIn(files, deps(host, withComponents({ rules: 'package' })), async root => {
    assert.deepEqual(
      rules?.map(rule => rule.name),
      ['style'],
    )
    assert.ok(!existsSync(join(root, 'dist/claude-code/rules')))
  })
})

test('换算承载（converted）的组件交给宿主模块，构建编排不原样复制', async () => {
  let commands: readonly string[] | undefined
  const host = fakeHost(async input => {
    commands = input.plans[0]?.commands.map(command => command.name)
    return { ok: true, files: [], skipped: [], residualRisks: [] }
  })
  const converted = withComponents({ commands: 'converted' })
  await buildIn(
    { 'commands/review.md': COMMAND() },
    deps(host, converted),
    async (root, outcome) => {
      const [entry] = done(outcome).report.targets
      assert.equal(entry?.status, 'ok')
      assert.deepEqual(entry?.skipped, [])
      assert.deepEqual(commands, ['review'])
      assert.ok(!existsSync(join(root, 'dist/claude-code/commands')))
    },
  )
  // 同一插件目录中另有目标原样承载（claude-code:in-process 的 commands 为 package）时照常复制
  await buildIn(
    { 'commands/review.md': COMMAND() },
    deps(host, converted),
    async root => {
      assert.ok(existsSync(join(root, 'dist/claude-code/commands/review.md')))
    },
    { targets: ['claude-code:in-process', TARGET] },
  )
})

test('跳过项依次为 skills、agents、rules、commands、MCP 服务器', async () => {
  const none = withComponents({
    skills: 'none',
    agents: 'none',
    rules: 'none',
    commands: 'none',
    mcp: 'none',
  })
  const files = {
    'skills/review/SKILL.md': '---\nname: review\ndescription: d\n---\n',
    'agents/helper.md': '---\nname: helper\ndescription: d\n---\n',
    'rules/style.md': RULE(),
    'commands/review.md': COMMAND(),
    'mcp/servers.json': JSON.stringify({ mcpServers: { docs: { command: 'x' } } }),
  }
  await buildIn(files, deps(writesManifest, none), async (_root, outcome) => {
    const [entry] = done(outcome).report.targets
    assert.deepEqual(
      entry?.skipped.map(item => item.component),
      [
        'skills/review',
        'agents/helper.md',
        'rules/style.md',
        'commands/review.md',
        'mcpServers.docs',
      ],
    )
  })
})

test('共用插件目录中不适用于某目标的 command 记为该目标的残余风险', async () => {
  const text = COMMAND(`targets: [${TARGET}]\n`)
  await buildIn(
    { 'commands/review.md': text },
    deps(),
    async (_root, outcome) => {
      const [inProcess, subprocess] = done(outcome).report.targets
      assert.deepEqual(inProcess?.residualRisks, [
        'command review 不适用于本目标，但与其他目标共用插件目录，宿主仍会加载',
      ])
      assert.deepEqual(subprocess?.residualRisks, ['宿主模块给出的风险'])
    },
    { targets: ['claude-code:in-process', TARGET] },
  )
})

test('rules 或 commands 读取失败时返回 input-error，不写任何文件', async () => {
  const sources: Record<string, string>[] = [
    { 'rules/style.md': '---\nactivation: sometimes\n---\n' },
    { 'commands/review.md': '---\nargument-hint: x\n---\n' },
  ]
  for (const files of sources) {
    await buildIn(files, deps(), async (root, outcome) => {
      assert.equal(outcome.kind, 'input-error')
      assert.ok(!existsSync(join(root, 'dist')))
    })
  }
})

test('rules 换算的技能与源项目 skill 同名时写入该目录的全部目标失败', async () => {
  const files = {
    'skills/style/SKILL.md': '---\nname: style\ndescription: d\n---\n',
    'rules/style.md':
      '---\nactivation: model\ndescription: 写代码时\n---\n\n使用中文。\n',
  }
  await buildIn(files, deps(claudeCode), async (root, outcome) => {
    const [entry] = done(outcome).report.targets
    assert.equal(entry?.status, 'failed')
    assert.deepEqual(entry?.errors, [
      '同路径冲突：dist/claude-code/skills/style/SKILL.md 既由 claude-code 生成，' +
        '又是复制的组件文件；rule style 写为同名技能，改名 rule 或 skill 之一',
    ])
    assert.ok(!existsSync(join(root, 'dist/claude-code')))
  })
})

test('agy 原样复制 commands，不列为跳过，写模型自动选用的残余风险', async () => {
  await buildIn(
    { 'commands/review.md': COMMAND() },
    deps(),
    async (root, outcome) => {
      const [entry] = done(outcome).report.targets
      assert.equal(entry?.status, 'ok')
      assert.deepEqual(entry?.skipped, [])
      assert.ok(
        entry?.residualRisks.includes(
          'agy 安装时把 commands 转换为技能，以 /<插件名>:<命令名> 调用；转换后的技能也会被' +
            '模型按 description 自动选用',
        ),
      )
      const written = join(root, 'dist/agy/commands/review.md')
      assert.equal(await readFile(written, 'utf8'), COMMAND())
    },
    { targets: ['agy:subprocess'] },
  )
})
