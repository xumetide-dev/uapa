// 构建编排（F-03-02～F-03-05、F-03-09、F-03-11）：以测试用的宿主模块与能力数据运行，
// 不依赖宿主功能模块。
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import type { BuildOutcome } from '../../src/build/index.ts'
import { type BuildDeps, runBuild } from '../../src/build/run.ts'
import { claudeCodeSubprocess } from '../../src/capabilities/claude-code-subprocess.ts'
import type { TargetCapabilities } from '../../src/capabilities/types.ts'
import type { UapaConfig } from '../../src/config/types.ts'
import type { HostModule, HostResult } from '../../src/targets/types.ts'
import { baseConfig, tempProject } from '../helpers/project.ts'

const TARGET = 'claude-code:subprocess'
const SKILL = (extra = '') => `---\nname: review\ndescription: d\n${extra}---\n`

function fakeHost(generate: HostModule['generate']): HostModule {
  return { host: 'claude-code', generate }
}

const writesManifest = fakeHost(async () => ({
  ok: true,
  files: [{ path: 'manifest.json', content: '{}\n' }],
  residualRisks: [{ target: TARGET, message: '宿主模块给出的风险' }],
}))

function deps(
  host: HostModule = writesManifest,
  capabilities: TargetCapabilities = claudeCodeSubprocess,
): BuildDeps {
  return {
    hostModules: { 'claude-code': host },
    targetCapabilities: { [TARGET]: capabilities },
    bundle: async () => {
      throw new Error('测试中不打包')
    },
  }
}

async function buildIn(
  files: Record<string, string>,
  buildDeps: BuildDeps,
  inspect: (root: string, outcome: BuildOutcome) => Promise<void>,
): Promise<void> {
  const project = await tempProject(files)
  try {
    const outcome = await runBuild(
      baseConfig as UapaConfig,
      project.root,
      { check: false },
      buildDeps,
    )
    await inspect(project.root, outcome)
  } finally {
    await project.cleanup()
  }
}

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
    return { ok: true, files: [], residualRisks: [] }
  })
  await buildIn({}, deps(host), async () => {
    assert.deepEqual(checks, [])
  })
})
