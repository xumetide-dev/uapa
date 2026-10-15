// 合并布局（F-03-06）、覆盖文件（F-03-12）与比对模式（F-03-08）：以只返回固定文件的宿主模块
// 运行构建编排，断言磁盘上的结果与报告（TA-07、TA-08 的单元部分）
import assert from 'node:assert/strict'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import type { BuildOutcome } from '../../src/build/index.ts'
import type { UapaConfig } from '../../src/config/types.ts'
import { agy } from '../../src/targets/agy/index.ts'
import { claudeCode } from '../../src/targets/claude-code/index.ts'
import { codex } from '../../src/targets/codex/index.ts'
import type { HostModule } from '../../src/targets/types.ts'
import { readTree } from '../fixtures/run.ts'
import { buildAt, hostDeps, returning, SKILL } from '../helpers/build.ts'
import { tempProject } from '../helpers/project.ts'

const ALL = ['claude-code:subprocess', 'codex:subprocess', 'agy:subprocess'] as const

// claude-code 与 codex 写入 out/，agy 使用默认目录 dist/agy
const merged: Partial<UapaConfig> = {
  targets: ALL,
  hosts: { 'claude-code': { dir: 'out' }, codex: { dir: 'out' } },
}

const agyManifest = returning('agy', [{ path: 'plugin.json', content: '{}\n' }])

function done(outcome: BuildOutcome) {
  assert.equal(outcome.kind, 'done')
  return outcome as Extract<BuildOutcome, { kind: 'done' }>
}

function targetOf(outcome: BuildOutcome, target: string) {
  const entry = done(outcome).report.targets.find(t => t.target === target)
  assert.ok(entry !== undefined, target)
  return entry
}

async function inProject(
  files: Record<string, string>,
  run: (root: string) => Promise<void>,
): Promise<void> {
  const project = await tempProject(files)
  try {
    await run(project.root)
  } finally {
    await project.cleanup()
  }
}

test('合并布局只写入生成的文件：不删除无关文件，同名同内容只写一次', async () => {
  const files = { 'out/keep.txt': 'keep\n', 'skills/review/SKILL.md': SKILL() }
  await inProject(files, async root => {
    const modules = {
      'claude-code': returning('claude-code', [
        { path: 'a.json', content: 'A\n' },
        { path: 'same.txt', content: 'S\n' },
      ]),
      codex: returning('codex', [
        { path: 'b.json', content: 'B\n' },
        { path: 'same.txt', content: 'S\n' },
      ]),
      agy: agyManifest,
    }
    const outcome = await buildAt(root, hostDeps(modules), merged)
    const tree = await readTree(join(root, 'out'))
    assert.deepEqual(
      [...tree.keys()],
      ['a.json', 'b.json', 'keep.txt', 'same.txt', 'skills/review/SKILL.md'],
    )
    assert.equal(tree.get('keep.txt')?.toString(), 'keep\n')
    for (const target of ['claude-code:subprocess', 'codex:subprocess']) {
      assert.equal(targetOf(outcome, target).status, 'ok')
      assert.deepEqual(targetOf(outcome, target).units, [
        { kind: 'plugin', path: 'out' },
      ])
    }
    assert.deepEqual(targetOf(outcome, 'agy:subprocess').units, [
      { kind: 'plugin', path: 'dist/agy' },
    ])
  })
})

test('合并布局同名文件内容不同：该目录的目标全部失败、不写入，错误写明文件、宿主与提示', async () => {
  const files = { 'out/keep.txt': 'keep\n' }
  await inProject(files, async root => {
    const modules = {
      'claude-code': returning('claude-code', [
        { path: 'manifest.json', content: '{}\n' },
        { path: 'hooks/hooks.json', content: 'A\n' },
      ]),
      codex: returning('codex', [
        { path: 'hooks/hooks.json', content: 'B\n', conflictHint: '改用独立文件' },
      ]),
      agy: agyManifest,
    }
    const outcome = await buildAt(root, hostDeps(modules), merged)
    const message =
      '合并布局冲突：out/hooks/hooks.json 由 claude-code、codex 生成，内容不同；改用独立文件'
    for (const target of ['claude-code:subprocess', 'codex:subprocess']) {
      const entry = targetOf(outcome, target)
      assert.equal(entry.status, 'failed')
      assert.deepEqual(entry.errors, [message])
      assert.deepEqual(entry.units, [])
    }
    assert.deepEqual([...(await readTree(join(root, 'out'))).keys()], ['keep.txt'])
    // 其他插件目录不受影响
    assert.equal(targetOf(outcome, 'agy:subprocess').status, 'ok')
    assert.equal(await readFile(join(root, 'dist/agy/plugin.json'), 'utf8'), '{}\n')
  })
})

test('合并布局的目录为源项目根目录时不复制 skills，不适用的 skill 记为残余风险', async () => {
  const only = SKILL('targets: [claude-code:subprocess]\n')
  await inProject({ 'skills/review/SKILL.md': only }, async root => {
    const modules = {
      'claude-code': returning('claude-code', [{ path: 'a.json', content: 'A\n' }]),
      codex: returning('codex', [{ path: 'b.json', content: 'B\n' }]),
      agy: agyManifest,
    }
    const config: Partial<UapaConfig> = {
      targets: ['claude-code:subprocess', 'codex:subprocess'],
      hosts: { 'claude-code': { dir: '.' }, codex: { dir: '.' } },
    }
    const outcome = await buildAt(root, hostDeps(modules), config)
    const tree = await readTree(root)
    assert.deepEqual(
      [...tree.keys()].filter(path => !path.startsWith('dist/')),
      ['a.json', 'b.json', 'skills/review/SKILL.md'],
    )
    assert.deepEqual(targetOf(outcome, 'claude-code:subprocess').residualRisks, [])
    assert.deepEqual(targetOf(outcome, 'codex:subprocess').residualRisks, [
      'skill review 不适用于本目标，但与其他目标共用插件目录，宿主仍会加载',
    ])
    assert.deepEqual(targetOf(outcome, 'codex:subprocess').units, [
      { kind: 'plugin', path: '.' },
    ])
  })
})

test('覆盖文件替换生成文件与 skill 文件、新增文件，按字典序记入 overridden', async () => {
  const files = {
    'skills/review/SKILL.md': SKILL(),
    'overrides/claude-code/manifest.json': '{"overridden":true}\n',
    'overrides/claude-code/extra/README.md': '新增\n',
    'overrides/claude-code/skills/review/SKILL.md': 'replaced\n',
  }
  await inProject(files, async root => {
    const modules = {
      'claude-code': returning('claude-code', [
        { path: 'manifest.json', content: '{}\n' },
      ]),
      codex: returning('codex', []),
      agy: agyManifest,
    }
    const outcome = await buildAt(root, hostDeps(modules), {})
    const tree = await readTree(join(root, 'dist/claude-code'))
    assert.deepEqual(Object.fromEntries([...tree].map(([p, c]) => [p, c.toString()])), {
      'extra/README.md': '新增\n',
      'manifest.json': '{"overridden":true}\n',
      'skills/review/SKILL.md': 'replaced\n',
    })
    assert.deepEqual(targetOf(outcome, 'claude-code:subprocess').overridden, [
      'extra/README.md',
      'manifest.json',
      'skills/review/SKILL.md',
    ])
  })
})

test('覆盖生成文件时继承其 conflictHint', async () => {
  const files = { 'overrides/codex/hooks/hooks.json': 'C\n' }
  await inProject(files, async root => {
    const modules = {
      'claude-code': returning('claude-code', [
        { path: 'hooks/hooks.json', content: 'A\n' },
      ]),
      codex: returning('codex', [
        { path: 'hooks/hooks.json', content: 'A\n', conflictHint: '改用独立文件' },
      ]),
      agy: agyManifest,
    }
    const outcome = await buildAt(root, hostDeps(modules), merged)
    assert.deepEqual(targetOf(outcome, 'codex:subprocess').errors, [
      '合并布局冲突：out/hooks/hooks.json 由 claude-code、codex 生成，内容不同；改用独立文件',
    ])
    assert.deepEqual(targetOf(outcome, 'codex:subprocess').overridden, [
      'hooks/hooks.json',
    ])
  })
})

function counting(): { module: HostModule; calls: () => number } {
  let calls = 0
  const module: HostModule = {
    host: 'claude-code',
    generate: async () => ({
      ok: true,
      files: [
        { path: 'manifest.json', content: '{}\n' },
        { path: 'hooks/hooks.json', content: 'H\n' },
      ],
      residualRisks: [],
    }),
    verify: async () => {
      calls += 1
      return { status: 'passed' }
    },
  }
  return { module, calls: () => calls }
}

test('比对：列出 added、modified、removed，按路径排序；前后目录快照一致，不调用 verify', async () => {
  await inProject({ 'skills/review/SKILL.md': SKILL() }, async root => {
    const host = counting()
    const modules = {
      'claude-code': host.module,
      codex: returning('codex', []),
      agy: agyManifest,
    }
    const buildDeps = hostDeps(modules)
    const fresh = done(await buildAt(root, buildDeps, {}, { check: true }))
    assert.deepEqual(fresh.changes, [
      { change: 'added', path: 'dist/claude-code/hooks/hooks.json' },
      { change: 'added', path: 'dist/claude-code/manifest.json' },
      { change: 'added', path: 'dist/claude-code/skills/review/SKILL.md' },
    ])
    assert.equal(fresh.reportPath, null)
    await buildAt(root, buildDeps, {})
    assert.equal(host.calls(), 1)
    const plugin = join(root, 'dist/claude-code')
    await rm(join(plugin, 'manifest.json'))
    await writeFile(join(plugin, 'hooks/hooks.json'), 'changed\n')
    await writeFile(join(plugin, 'extra.txt'), 'x\n')
    const before = await readTree(root)
    const outcome = done(await buildAt(root, buildDeps, {}, { check: true }))
    assert.deepEqual(await readTree(root), before)
    assert.deepEqual(outcome.changes, [
      { change: 'removed', path: 'dist/claude-code/extra.txt' },
      { change: 'modified', path: 'dist/claude-code/hooks/hooks.json' },
      { change: 'added', path: 'dist/claude-code/manifest.json' },
    ])
    assert.equal(outcome.reportPath, null)
    // 承接 M1-03 验收 §7 第 1 行：--check 不调用 verify
    assert.equal(host.calls(), 1)
    assert.equal(targetOf(outcome, 'claude-code:subprocess').hostValidation, 'none')
  })
})

test('比对：合并布局中的无关文件不产生差异；一致时没有差异', async () => {
  await inProject({ 'out/keep.txt': 'keep\n' }, async root => {
    const modules = {
      'claude-code': returning('claude-code', [{ path: 'a.json', content: 'A\n' }]),
      codex: returning('codex', [{ path: 'b.json', content: 'B\n' }]),
      agy: agyManifest,
    }
    await buildAt(root, hostDeps(modules), merged)
    await writeFile(join(root, 'out/unrelated.txt'), 'u\n')
    const outcome = done(
      await buildAt(root, hostDeps(modules), merged, { check: true }),
    )
    assert.deepEqual(outcome.changes, [])
  })
})

test('比对：失败的目标不产生差异，默认布局中目标全部失败的目录不比对', async () => {
  const files = { 'dist/claude-code/stale.txt': 'x\n', 'out/keep.txt': 'k\n' }
  await inProject(files, async root => {
    const failing: HostModule = {
      host: 'claude-code',
      generate: async () => ({ ok: false, errors: [] }),
    }
    const modules = {
      'claude-code': failing,
      codex: returning('codex', []),
      agy: agyManifest,
    }
    const config = { targets: ['claude-code:subprocess', 'agy:subprocess'] } as const
    const outcome = done(
      await buildAt(root, hostDeps(modules), config, { check: true }),
    )
    assert.deepEqual(outcome.changes, [
      { change: 'added', path: 'dist/agy/plugin.json' },
    ])
    assert.equal(targetOf(outcome, 'claude-code:subprocess').status, 'failed')
    // 合并冲突的目录同样不比对
    const conflicting = {
      'claude-code': returning('claude-code', [{ path: 'x', content: 'A' }]),
      codex: returning('codex', [{ path: 'x', content: 'B' }]),
      agy: agyManifest,
    }
    const conflict = done(
      await buildAt(root, hostDeps(conflicting), merged, { check: true }),
    )
    assert.deepEqual(conflict.changes, [
      { change: 'added', path: 'dist/agy/plugin.json' },
    ])
  })
})

// 承接 M1-02 验收 §7 第 3 行（同一宿主有两个目标）。真实的 Claude Code 宿主模块，不调用宿主校验
test('同一宿主两个目标：skill 只限定 claude-code:subprocess 时 claude-code:in-process 记残余风险；一个目标失败时另一目标照常写出', async () => {
  const files = {
    'skills/review/SKILL.md': SKILL('targets: [claude-code:subprocess]\n'),
  }
  const modules = {
    'claude-code': { host: 'claude-code', generate: claudeCode.generate } as const,
    codex,
    agy,
  }
  const both: Partial<UapaConfig> = {
    targets: ['claude-code:in-process', 'claude-code:subprocess'],
  }
  await inProject(files, async root => {
    const outcome = await buildAt(root, hostDeps(modules), both)
    assert.deepEqual(targetOf(outcome, 'claude-code:in-process').residualRisks, [
      'skill review 不适用于本目标，但与其他目标共用插件目录，宿主仍会加载',
    ])
    assert.deepEqual(targetOf(outcome, 'claude-code:subprocess').residualRisks, [])
    // 显式限定 claude-code:in-process 的 SessionStart 声明使该目标失败
    const failing: Partial<UapaConfig> = {
      ...both,
      commandHooks: [
        {
          event: 'SessionStart',
          command: 'echo uapa-session-probe',
          targets: ['claude-code:in-process'],
        },
      ],
    }
    const second = await buildAt(root, hostDeps(modules), failing)
    const inProcess = targetOf(second, 'claude-code:in-process')
    assert.deepEqual([inProcess.status, inProcess.units], ['failed', []])
    const subprocess = targetOf(second, 'claude-code:subprocess')
    assert.equal(subprocess.status, 'ok')
    assert.deepEqual(subprocess.units, [{ kind: 'plugin', path: 'dist/claude-code' }])
    const tree = await readTree(join(root, 'dist', 'claude-code'))
    assert.deepEqual(
      [...tree.keys()],
      ['.claude-plugin/plugin.json', 'skills/review/SKILL.md'],
    )
  })
})
