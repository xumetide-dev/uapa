// 按命名空间合并共用的 JSON 文件（F-03-07，TA-22）：两个测试用宿主模块在合并布局中返回标
// merge: 'json-extensions' 的同名 plugin.json，断言合并结果、冲突与 --check 的比对
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import type { BuildOutcome } from '../../src/build/index.ts'
import type { UapaConfig } from '../../src/config/types.ts'
import type { HostModule, OutputFile } from '../../src/targets/types.ts'
import { buildAt, hostDeps, returning } from '../helpers/build.ts'
import { tempProject } from '../helpers/project.ts'

const TARGETS = ['claude-code:subprocess', 'codex:subprocess'] as const

// claude-code 与 codex 写入同一插件目录 shared/
const shared: Partial<UapaConfig> = {
  targets: TARGETS,
  hosts: { 'claude-code': { dir: 'shared' }, codex: { dir: 'shared' } },
}

const PATH = 'plugin.json'

function marked(value: unknown): OutputFile {
  return { path: PATH, content: JSON.stringify(value), merge: 'json-extensions' }
}

function modules(
  claude: readonly OutputFile[],
  codex: readonly OutputFile[],
): Readonly<Record<'claude-code' | 'codex' | 'agy', HostModule>> {
  return {
    'claude-code': returning('claude-code', claude),
    codex: returning('codex', codex),
    agy: returning('agy', []),
  }
}

function done(outcome: BuildOutcome) {
  assert.equal(outcome.kind, 'done')
  return outcome as Extract<BuildOutcome, { kind: 'done' }>
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

const CLAUDE = {
  name: 'demo',
  version: '0.1.0',
  author: { name: 'A', email: 'a@example.com' },
  extensions: { 'claude-code': { mode: 'plugin' } },
}
// 字段相同而键序不同，命名空间不同
const CODEX = {
  extensions: { codex: { trust: true } },
  author: { email: 'a@example.com', name: 'A' },
  version: '0.1.0',
  name: 'demo',
}

test('字段相同而键序不同时合并：以先登记宿主的键序写出，命名空间按字典序', async () => {
  await inProject({}, async root => {
    const deps = hostDeps(modules([marked(CLAUDE)], [marked(CODEX)]))
    const outcome = done(await buildAt(root, deps, shared))
    for (const entry of outcome.report.targets) {
      assert.equal(entry.status, 'ok', entry.target)
    }
    assert.equal(
      await readFile(join(root, 'shared', PATH), 'utf8'),
      `${JSON.stringify(
        {
          name: 'demo',
          version: '0.1.0',
          author: { name: 'A', email: 'a@example.com' },
          extensions: { 'claude-code': { mode: 'plugin' }, codex: { trust: true } },
        },
        null,
        2,
      )}\n`,
    )
  })
})

test('合并结果与命名空间在输入中的顺序无关；同一命名空间内容相同时合并', async () => {
  const twoNamespaces = (order: readonly string[]) => ({
    ...CODEX,
    extensions: Object.fromEntries(
      order.map(name => [name, name === 'claude-code' ? { mode: 'plugin' } : { x: 1 }]),
    ),
  })
  const results: string[] = []
  for (const order of [
    ['zeta', 'claude-code'],
    ['claude-code', 'zeta'],
  ]) {
    await inProject({}, async root => {
      const deps = hostDeps(modules([marked(CLAUDE)], [marked(twoNamespaces(order))]))
      const outcome = done(await buildAt(root, deps, shared))
      assert.ok(outcome.report.targets.every(entry => entry.status === 'ok'))
      results.push(await readFile(join(root, 'shared', PATH), 'utf8'))
    })
  }
  assert.equal(results[0], results[1])
  assert.deepEqual(Object.keys(JSON.parse(results[0] ?? '').extensions), [
    'claude-code',
    'zeta',
  ])
})

test('不能合并时按同名文件冲突处理：目标全部失败，该目录不写入', async () => {
  const cases: [string, OutputFile, OutputFile][] = [
    [
      'extensions 以外的字段不同',
      marked(CLAUDE),
      marked({ ...CODEX, version: '0.2.0' }),
    ],
    [
      '同一命名空间内容不同',
      marked(CLAUDE),
      marked({ ...CODEX, extensions: { 'claude-code': { mode: 'other' } } }),
    ],
    ['只有一方标合并', marked(CLAUDE), { path: PATH, content: JSON.stringify(CODEX) }],
    ['文件不是 JSON 对象', marked(CLAUDE), { ...marked(CODEX), content: '[1, 2]\n' }],
    ['文件不是 JSON', marked(CLAUDE), { ...marked(CODEX), content: '{name: demo}\n' }],
    [
      'extensions 不是对象',
      marked(CLAUDE),
      marked({ ...CODEX, extensions: ['codex'] }),
    ],
  ]
  for (const [label, claude, codex] of cases) {
    await inProject({}, async root => {
      const outcome = done(
        await buildAt(root, hostDeps(modules([claude], [codex])), shared),
      )
      for (const entry of outcome.report.targets) {
        assert.equal(entry.status, 'failed', label)
        assert.deepEqual(
          entry.errors,
          ['合并布局冲突：shared/plugin.json 由 claude-code、codex 生成，内容不同'],
          label,
        )
      }
      assert.ok(!existsSync(join(root, 'shared')), label)
    })
  }
})

test('覆盖文件替换带标记的生成文件时继承标记，参与合并', async () => {
  const override = { ...CODEX, extensions: { codex: { trust: false } } }
  const files = { 'overrides/codex/plugin.json': `${JSON.stringify(override)}\n` }
  await inProject(files, async root => {
    const deps = hostDeps(modules([marked(CLAUDE)], [marked(CODEX)]))
    const outcome = done(await buildAt(root, deps, shared))
    const codex = outcome.report.targets.find(t => t.target === 'codex:subprocess')
    assert.equal(codex?.status, 'ok')
    assert.deepEqual(codex?.overridden, [PATH])
    const written = JSON.parse(await readFile(join(root, 'shared', PATH), 'utf8'))
    assert.deepEqual(written.extensions, {
      'claude-code': { mode: 'plugin' },
      codex: { trust: false },
    })
  })
})

test('--check 的比对结果与实际写出一致', async () => {
  await inProject({}, async root => {
    const deps = hostDeps(modules([marked(CLAUDE)], [marked(CODEX)]))
    const before = done(await buildAt(root, deps, shared, { check: true }))
    assert.deepEqual(before.changes, [{ change: 'added', path: 'shared/plugin.json' }])
    assert.ok(!existsSync(join(root, 'shared')))
    await buildAt(root, deps, shared)
    const after = done(await buildAt(root, deps, shared, { check: true }))
    assert.deepEqual(after.changes, [])
    await writeFile(join(root, 'shared', PATH), `${JSON.stringify(CLAUDE, null, 2)}\n`)
    const drifted = done(await buildAt(root, deps, shared, { check: true }))
    assert.deepEqual(drifted.changes, [
      { change: 'modified', path: 'shared/plugin.json' },
    ])
  })
})
