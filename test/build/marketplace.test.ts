// marketplace 文件的生成、写出、冲突检查与比对（F-03-18、F-05-24、F-06-15）
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import type { BuildOutcome } from '../../src/build/index.ts'
import type { UapaConfig } from '../../src/config/types.ts'
import { claudeCode } from '../../src/targets/claude-code/index.ts'
import { buildAt, buildIn, deps, fakeHost, TARGET } from '../helpers/build.ts'
import { tempProject } from '../helpers/project.ts'

function done(outcome: BuildOutcome) {
  assert.equal(outcome.kind, 'done')
  return outcome as Extract<BuildOutcome, { kind: 'done' }>
}

const MARKET: NonNullable<UapaConfig['marketplace']> = {
  name: 'team-market',
  owner: { name: 'Team', email: 'team@example.com' },
}

test('相对路径：插件目录位于 marketplace.dir 子目录时 source 为 ./<子目录>，不清空所在目录', async () => {
  const files = { 'dist/keep.txt': 'stay\n' }
  const config: Partial<UapaConfig> = {
    targets: [TARGET, 'codex:subprocess'],
    marketplace: MARKET,
  }
  await buildIn(
    files,
    deps(claudeCode),
    async (root, outcome) => {
      const [claude, codexEntry] = done(outcome).report.targets
      assert.equal(claude?.status, 'ok')
      assert.deepEqual(claude?.units, [
        { kind: 'plugin', path: 'dist/claude-code' },
        { kind: 'marketplace', path: 'dist/.claude-plugin/marketplace.json' },
      ])
      assert.deepEqual(codexEntry?.units, [
        { kind: 'plugin', path: 'dist/codex' },
        { kind: 'marketplace', path: 'dist/.agents/plugins/marketplace.json' },
      ])
      assert.equal(await readFile(join(root, 'dist/keep.txt'), 'utf8'), 'stay\n')
      const claudeMarket = JSON.parse(
        await readFile(join(root, 'dist/.claude-plugin/marketplace.json'), 'utf8'),
      )
      assert.deepEqual(claudeMarket, {
        name: 'team-market',
        owner: { name: 'Team', email: 'team@example.com' },
        metadata: { description: '测试用插件' },
        plugins: [{ name: 'demo', source: './claude-code', description: '测试用插件' }],
      })
      const codexMarket = JSON.parse(
        await readFile(join(root, 'dist/.agents/plugins/marketplace.json'), 'utf8'),
      )
      assert.deepEqual(codexMarket, {
        name: 'team-market',
        plugins: [{ name: 'demo', source: './codex' }],
      })
    },
    config,
  )
})

test('相对路径：插件目录与 marketplace.dir 相同时 source 为 ./', async () => {
  const config: Partial<UapaConfig> = {
    targets: [TARGET, 'codex:subprocess'],
    hosts: { 'claude-code': { dir: '.' }, codex: { dir: '.' } },
    marketplace: { name: 'team-market', owner: { name: 'Team' }, dir: '.' },
  }
  await buildIn(
    {},
    deps(claudeCode),
    async (root, outcome) => {
      const [claude, codexEntry] = done(outcome).report.targets
      assert.equal(claude?.status, 'ok')
      assert.equal(codexEntry?.status, 'ok')
      const claudeMarket = JSON.parse(
        await readFile(join(root, '.claude-plugin/marketplace.json'), 'utf8'),
      )
      assert.equal(claudeMarket.plugins[0]?.source, './')
      assert.deepEqual(claudeMarket.owner, { name: 'Team' })
      const codexMarket = JSON.parse(
        await readFile(join(root, '.agents/plugins/marketplace.json'), 'utf8'),
      )
      assert.equal(codexMarket.plugins[0]?.source, './')
    },
    config,
  )
})

test('宿主全部失败（生成失败或宿主校验失败）时不写该宿主的 marketplace 文件', async () => {
  const failingGenerate = fakeHost(async () => ({
    ok: false,
    errors: [{ target: TARGET, message: '生成报错' }],
  }))
  const config: Partial<UapaConfig> = {
    targets: [TARGET, 'codex:subprocess'],
    marketplace: MARKET,
  }
  await buildIn(
    {},
    deps(failingGenerate),
    async (root, outcome) => {
      const [claude, codexEntry] = done(outcome).report.targets
      assert.equal(claude?.status, 'failed')
      assert.deepEqual(claude?.units, [])
      assert.ok(!existsSync(join(root, 'dist/.claude-plugin/marketplace.json')))
      assert.equal(codexEntry?.status, 'ok')
      assert.ok(existsSync(join(root, 'dist/.agents/plugins/marketplace.json')))
    },
    config,
  )
  const failingVerify = fakeHost(
    async input => claudeCode.generate(input),
    async () => ({ status: 'failed', errors: ['校验未通过'] }),
  )
  await buildIn(
    {},
    deps(failingVerify),
    async (root, outcome) => {
      const [claude] = done(outcome).report.targets
      assert.equal(claude?.status, 'failed')
      assert.deepEqual(claude?.units, [{ kind: 'plugin', path: 'dist/claude-code' }])
      assert.ok(!existsSync(join(root, 'dist/.claude-plugin/marketplace.json')))
    },
    config,
  )
})

test('--check 报告 marketplace 文件的 added 与 modified，不写磁盘且不把其他文件列为 removed', async () => {
  const project = await tempProject({ 'dist/unrelated.txt': 'keep\n' })
  try {
    const config: Partial<UapaConfig> = {
      targets: [TARGET, 'codex:subprocess'],
      marketplace: MARKET,
    }
    const firstCheck = done(
      await buildAt(project.root, deps(claudeCode), config, { check: true }),
    )
    assert.deepEqual(firstCheck.changes, [
      { change: 'added', path: 'dist/.agents/plugins/marketplace.json' },
      { change: 'added', path: 'dist/.claude-plugin/marketplace.json' },
      { change: 'added', path: 'dist/claude-code/.claude-plugin/plugin.json' },
      { change: 'added', path: 'dist/codex/.codex-plugin/plugin.json' },
    ])
    assert.ok(!existsSync(join(project.root, 'dist/.claude-plugin/marketplace.json')))
    await buildAt(project.root, deps(claudeCode), config, { check: false })
    const cleanCheck = done(
      await buildAt(project.root, deps(claudeCode), config, { check: true }),
    )
    assert.deepEqual(cleanCheck.changes, [])
    await mkdir(join(project.root, 'dist/.claude-plugin'), { recursive: true })
    await writeFile(
      join(project.root, 'dist/.claude-plugin/marketplace.json'),
      '{"changed":true}\n',
    )
    const modCheck = done(
      await buildAt(project.root, deps(claudeCode), config, { check: true }),
    )
    assert.deepEqual(modCheck.changes, [
      { change: 'modified', path: 'dist/.claude-plugin/marketplace.json' },
    ])
    assert.equal(
      await readFile(
        join(project.root, 'dist/.claude-plugin/marketplace.json'),
        'utf8',
      ),
      '{"changed":true}\n',
    )
  } finally {
    await project.cleanup()
  }
})

test('marketplace 文件与插件目录中的文件同路径时该宿主失败，其插件目录不写入', async () => {
  const files = {
    'overrides/claude-code/.claude-plugin/marketplace.json': '{"custom":true}\n',
  }
  const config: Partial<UapaConfig> = {
    targets: [TARGET, 'codex:subprocess'],
    hosts: { 'claude-code': { dir: 'dist/shared' }, codex: { dir: 'dist/codex' } },
    marketplace: { ...MARKET, dir: 'dist/shared' },
  }
  await buildIn(
    files,
    deps(claudeCode),
    async (root, outcome) => {
      const [claude, codexEntry] = done(outcome).report.targets
      assert.equal(claude?.status, 'failed')
      assert.deepEqual(claude?.errors, [
        'marketplace 文件 dist/shared/.claude-plugin/marketplace.json 与插件目录中的文件同路径',
      ])
      assert.deepEqual(claude?.units, [])
      assert.ok(!existsSync(join(root, 'dist/shared/.claude-plugin')))
      assert.equal(codexEntry?.status, 'ok')
      assert.ok(existsSync(join(root, 'dist/shared/.agents/plugins/marketplace.json')))
    },
    config,
  )
})
