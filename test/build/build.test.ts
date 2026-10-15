// 构建编排（F-03-02～F-03-05、F-03-09、F-03-11；agents 按 SD-30）：以测试用的宿主模块与能力数据运行，
// 不依赖宿主功能模块。
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import type { BuildOutcome } from '../../src/build/index.ts'
import { claudeCodeSubprocess } from '../../src/capabilities/claude-code-subprocess.ts'
import type { TargetCapabilities } from '../../src/capabilities/types.ts'
import type { UapaConfig } from '../../src/config/types.ts'
import type { HostModule, HostResult } from '../../src/targets/types.ts'
import {
  buildIn,
  deps,
  fakeHost,
  SKILL,
  TARGET,
  writesManifest,
} from '../helpers/build.ts'

function done(outcome: BuildOutcome) {
  assert.equal(outcome.kind, 'done')
  return outcome as Extract<BuildOutcome, { kind: 'done' }>
}

test('写出宿主文件与 skills，报告按目标记录', async () => {
  const files = { 'skills/review/SKILL.md': SKILL(), 'dist/claude-code/stale.txt': 'x' }
  await buildIn(files, deps(), async (root, outcome) => {
    const result = done(outcome)
    const plugin = join(root, 'dist/claude-code')
    assert.equal(await readFile(join(plugin, 'manifest.json'), 'utf8'), '{}\n')
    assert.equal(
      await readFile(join(plugin, 'skills/review/SKILL.md'), 'utf8'),
      SKILL(),
    )
    // 默认布局写入前清空目录
    assert.ok(!existsSync(join(plugin, 'stale.txt')))
    assert.equal(result.reportPath, 'dist/uapa-report.json')
    const report = JSON.parse(
      await readFile(join(root, 'dist/uapa-report.json'), 'utf8'),
    )
    assert.deepEqual(report, result.report)
    const [entry] = result.report.targets
    assert.equal(entry?.status, 'ok')
    assert.deepEqual(entry?.units, [{ kind: 'plugin', path: 'dist/claude-code' }])
    assert.deepEqual(entry?.residualRisks, ['宿主模块给出的风险'])
    assert.equal(entry?.host.checked, claudeCodeSubprocess.host.checked)
  })
})

test('不能承载 skills 时：未写 targets 的 skill 跳过，显式写了本目标的使目标失败（TA-04）', async () => {
  const noSkills: TargetCapabilities = {
    ...claudeCodeSubprocess,
    components: { ...claudeCodeSubprocess.components, skills: 'none' },
  }
  await buildIn(
    { 'skills/review/SKILL.md': SKILL() },
    deps(writesManifest, noSkills),
    async (root, outcome) => {
      const [entry] = done(outcome).report.targets
      assert.equal(entry?.status, 'ok')
      assert.deepEqual(entry?.skipped, [
        { component: 'skills/review', reason: '本目标不能承载 skills' },
      ])
      assert.ok(!existsSync(join(root, 'dist/claude-code/skills')))
    },
  )
  const explicit = { 'skills/review/SKILL.md': SKILL(`targets: [${TARGET}]\n`) }
  await buildIn(explicit, deps(writesManifest, noSkills), async (root, outcome) => {
    const [entry] = done(outcome).report.targets
    assert.equal(entry?.status, 'failed')
    assert.match(entry?.errors[0] ?? '', /显式限定了本目标/)
    assert.deepEqual(entry?.units, [])
    assert.ok(!existsSync(join(root, 'dist/claude-code')))
  })
})

const AGENT = (extra = '') =>
  `---\nname: reviewer\ndescription: 审查\n${extra}---\n\n你是审查者。\n`

test('agents 原样复制为插件目录的 agents/<name>.md', async () => {
  const text = AGENT(`targets: [${TARGET}]\n`)
  await buildIn({ 'agents/reviewer.md': text }, deps(), async (root, outcome) => {
    const [entry] = done(outcome).report.targets
    assert.equal(entry?.status, 'ok')
    assert.deepEqual(entry?.skipped, [])
    const written = join(root, 'dist/claude-code/agents/reviewer.md')
    assert.equal(await readFile(written, 'utf8'), text)
  })
})

test('不能承载 agents 时：未写 targets 的 agent 跳过，显式写了本目标的使目标失败（TA-04）', async () => {
  const noAgents: TargetCapabilities = {
    ...claudeCodeSubprocess,
    components: { ...claudeCodeSubprocess.components, agents: 'none' },
  }
  await buildIn(
    { 'agents/reviewer.md': AGENT() },
    deps(writesManifest, noAgents),
    async (root, outcome) => {
      const [entry] = done(outcome).report.targets
      assert.equal(entry?.status, 'ok')
      assert.deepEqual(entry?.skipped, [
        { component: 'agents/reviewer.md', reason: '本目标不能承载 agents' },
      ])
      assert.ok(!existsSync(join(root, 'dist/claude-code/agents')))
    },
  )
  const explicit = { 'agents/reviewer.md': AGENT(`targets: [${TARGET}]\n`) }
  await buildIn(explicit, deps(writesManifest, noAgents), async (root, outcome) => {
    const [entry] = done(outcome).report.targets
    assert.equal(entry?.status, 'failed')
    assert.deepEqual(entry?.errors, [
      'agent reviewer 显式限定了本目标，但本目标不能承载 agents',
    ])
    assert.ok(!existsSync(join(root, 'dist/claude-code')))
  })
})

test('共用插件目录中不适用于某目标的 agent 记为该目标的残余风险；不承载 agents 的目标不记', async () => {
  const text = AGENT(`targets: [${TARGET}]\n`)
  const targets = ['claude-code:in-process', TARGET] as const
  await buildIn(
    { 'agents/reviewer.md': text },
    deps(),
    async (_root, outcome) => {
      const [inProcess, subprocess] = done(outcome).report.targets
      assert.deepEqual(inProcess?.residualRisks, [
        'agent reviewer 不适用于本目标，但与其他目标共用插件目录，宿主仍会加载',
      ])
      assert.deepEqual(subprocess?.residualRisks, ['宿主模块给出的风险'])
    },
    { targets: [...targets] },
  )
  const shared = {
    targets: [TARGET, 'codex:subprocess'] as UapaConfig['targets'],
    hosts: { 'claude-code': { dir: 'shared' }, codex: { dir: 'shared' } },
  }
  await buildIn(
    { 'agents/reviewer.md': AGENT() },
    deps(),
    async (root, outcome) => {
      const [claude, codex] = done(outcome).report.targets
      assert.equal(codex?.status, 'ok')
      assert.deepEqual(codex?.skipped, [
        { component: 'agents/reviewer.md', reason: '本目标不能承载 agents' },
      ])
      assert.ok(!codex?.residualRisks.some(risk => risk.startsWith('agent ')))
      assert.ok(!claude?.residualRisks.some(risk => risk.startsWith('agent ')))
      assert.equal(
        await readFile(join(root, 'shared/agents/reviewer.md'), 'utf8'),
        AGENT(),
      )
    },
    shared,
  )
})

const MCP = JSON.stringify({
  mcpServers: { zeta: { url: 'http://127.0.0.1:9/mcp' }, alpha: { command: 'x' } },
})

test('MCP 服务器按名称排序交给宿主模块；宿主模块的跳过项排在能力检查的跳过项之后', async () => {
  const seen: string[][] = []
  const host = fakeHost(async input => {
    seen.push(input.plans.flatMap(plan => plan.mcpServers.map(s => s.name)))
    return {
      ok: true,
      files: [{ path: 'manifest.json', content: '{}\n' }],
      skipped: [
        { target: TARGET, component: 'mcpServers.zeta', reason: '宿主模块跳过' },
        { target: 'claude-code:in-process', component: 'other', reason: '其他目标' },
      ],
      residualRisks: [],
    }
  })
  const noSkills: TargetCapabilities = {
    ...claudeCodeSubprocess,
    components: { ...claudeCodeSubprocess.components, skills: 'none' },
  }
  const files = { 'skills/review/SKILL.md': SKILL(), 'mcp/servers.json': MCP }
  await buildIn(files, deps(host, noSkills), async (_root, outcome) => {
    const [entry] = done(outcome).report.targets
    assert.deepEqual(seen, [['alpha', 'zeta']])
    assert.deepEqual(entry?.skipped, [
      { component: 'skills/review', reason: '本目标不能承载 skills' },
      { component: 'mcpServers.zeta', reason: '宿主模块跳过' },
    ])
  })
})

test('不能承载 MCP 时全部服务器列为跳过，宿主模块收到空列表', async () => {
  const seen: number[] = []
  const host = fakeHost(async input => {
    seen.push(...input.plans.map(plan => plan.mcpServers.length))
    return writesManifest.generate(input)
  })
  const noMcp: TargetCapabilities = {
    ...claudeCodeSubprocess,
    components: { ...claudeCodeSubprocess.components, mcp: 'none' },
  }
  await buildIn(
    { 'mcp/servers.json': MCP },
    deps(host, noMcp),
    async (_root, outcome) => {
      const [entry] = done(outcome).report.targets
      assert.equal(entry?.status, 'ok')
      assert.deepEqual(seen, [0])
      assert.deepEqual(entry?.skipped, [
        { component: 'mcpServers.alpha', reason: '本目标不能承载 MCP 服务器' },
        { component: 'mcpServers.zeta', reason: '本目标不能承载 MCP 服务器' },
      ])
    },
  )
})

test('宿主模块失败时该宿主的目标失败，插件目录保持原状', async () => {
  const cases: [HostModule['generate'], string][] = [
    [
      async () => ({ ok: false, errors: [{ target: TARGET, message: '名称不合规' }] }),
      '名称不合规',
    ],
    [
      async (): Promise<HostResult> => ({ ok: false, errors: [] }),
      '同一宿主的生成失败',
    ],
    [
      async () => {
        throw new Error('boom')
      },
      '同一宿主的生成失败: boom',
    ],
  ]
  for (const [generate, error] of cases) {
    const files = { 'dist/claude-code/keep.txt': 'keep' }
    await buildIn(files, deps(fakeHost(generate)), async (root, outcome) => {
      const [entry] = done(outcome).report.targets
      assert.equal(entry?.status, 'failed')
      assert.deepEqual(entry?.errors, [error])
      assert.equal(
        await readFile(join(root, 'dist/claude-code/keep.txt'), 'utf8'),
        'keep',
      )
    })
  }
})

// 登记第二个宿主后才能构造（M1-02 验收 §7 第 1 行）
test('一个宿主的宿主模块失败时，另一宿主的目标仍成功并写出', async () => {
  const failingAgy: HostModule = {
    host: 'agy',
    generate: async () => ({
      ok: false,
      errors: [{ target: 'agy:subprocess', message: '名称不合规' }],
    }),
  }
  const failingClaude = fakeHost(async () => {
    throw new Error('boom')
  })
  const config = { targets: [TARGET, 'agy:subprocess'] } as Partial<UapaConfig>
  const files = { 'skills/review/SKILL.md': SKILL(), 'dist/agy/keep.txt': 'keep' }
  await buildIn(
    files,
    deps(writesManifest, claudeCodeSubprocess, failingAgy),
    async (root, outcome) => {
      const [claude, agy] = done(outcome).report.targets
      assert.equal(claude?.status, 'ok')
      assert.equal(
        await readFile(join(root, 'dist/claude-code/manifest.json'), 'utf8'),
        '{}\n',
      )
      assert.ok(existsSync(join(root, 'dist/claude-code/skills/review/SKILL.md')))
      assert.equal(agy?.status, 'failed')
      assert.deepEqual(agy?.errors, ['名称不合规'])
      assert.equal(await readFile(join(root, 'dist/agy/keep.txt'), 'utf8'), 'keep')
    },
    config,
  )
  // 反向：Claude Code 的宿主模块抛错，agy 以真实宿主模块写出
  await buildIn(
    { 'skills/review/SKILL.md': SKILL() },
    deps(failingClaude),
    async (root, outcome) => {
      const [claude, agy] = done(outcome).report.targets
      assert.equal(claude?.status, 'failed')
      assert.deepEqual(claude?.errors, ['同一宿主的生成失败: boom'])
      assert.ok(!existsSync(join(root, 'dist/claude-code')))
      assert.equal(agy?.status, 'ok')
      assert.deepEqual(agy?.units, [{ kind: 'plugin', path: 'dist/agy' }])
      assert.ok(existsSync(join(root, 'dist/agy/plugin.json')))
      assert.ok(existsSync(join(root, 'dist/agy/skills/review/SKILL.md')))
    },
    config,
  )
})

test('源项目读取失败时返回 input-error，不写任何文件', async () => {
  await buildIn({ 'skills/review/other.md': 'x' }, deps(), async (root, outcome) => {
    assert.equal(outcome.kind, 'input-error')
    assert.ok(!existsSync(join(root, 'dist')))
  })
})

test('未配置守卫时 TargetPlan.checks 为空', async () => {
  let checks: readonly string[] | undefined
  const host = fakeHost(async input => {
    checks = input.plans[0]?.checks
    return { ok: true, files: [], skipped: [], residualRisks: [] }
  })
  await buildIn({}, deps(host), async () => {
    assert.deepEqual(checks, [])
  })
})
