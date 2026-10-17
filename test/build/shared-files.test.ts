// 共用文件的放置（F-03-17，SD-37）与同路径冲突：以只返回固定文件的宿主模块运行构建编排，
// 断言磁盘上的结果与报告
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { chmod, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import type { BuildOutcome } from '../../src/build/index.ts'
import type { UapaConfig } from '../../src/config/types.ts'
import type { OutputFile } from '../../src/targets/types.ts'
import { buildAt, hostDeps, returning, SKILL } from '../helpers/build.ts'
import { tempProject } from '../helpers/project.ts'

const TWO: Partial<UapaConfig> = {
  targets: ['claude-code:subprocess', 'agy:subprocess'],
}
const ROOT_MERGED: Partial<UapaConfig> = {
  targets: ['claude-code:subprocess', 'codex:subprocess'],
  hosts: { 'claude-code': { dir: '.' }, codex: { dir: '.' } },
}

function modules(claude: readonly OutputFile[] = []) {
  return hostDeps({
    'claude-code': returning('claude-code', [
      { path: 'manifest.json', content: '{}\n' },
      ...claude,
    ]),
    codex: returning('codex', [{ path: 'codex.json', content: '{}\n' }]),
    agy: returning('agy', [{ path: 'plugin.json', content: '{}\n' }]),
  })
}

function done(outcome: BuildOutcome) {
  assert.equal(outcome.kind, 'done')
  return outcome as Extract<BuildOutcome, { kind: 'done' }>
}

function errorsOf(outcome: BuildOutcome): string[][] {
  return done(outcome).report.targets.map(entry => [...entry.errors])
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

test('共用文件复制到每个写出文件的插件目录，保留文件权限，--check 一并比对', async () => {
  const files = { 'files/scripts/server.mjs': 'server\n', 'files/README.md': 'r\n' }
  await inProject(files, async root => {
    await chmod(join(root, 'files/scripts/server.mjs'), 0o755)
    const outcome = done(await buildAt(root, modules(), TWO))
    assert.deepEqual(
      outcome.report.targets.map(entry => entry.status),
      ['ok', 'ok'],
    )
    for (const dir of ['dist/claude-code', 'dist/agy']) {
      const server = join(root, dir, 'scripts/server.mjs')
      assert.equal(await readFile(server, 'utf8'), 'server\n')
      assert.equal((await stat(server)).mode & 0o777, 0o755)
      assert.equal(await readFile(join(root, dir, 'README.md'), 'utf8'), 'r\n')
    }
    await writeFile(join(root, 'dist/agy/README.md'), 'changed\n')
    const check = done(await buildAt(root, modules(), TWO, { check: true }))
    assert.deepEqual(check.changes, [
      { change: 'modified', path: 'dist/agy/README.md' },
    ])
  })
})

test('覆盖文件可以替换共用文件，记入 overridden', async () => {
  const files = {
    'files/README.md': 'shared\n',
    'overrides/claude-code/README.md': 'claude\n',
  }
  await inProject(files, async root => {
    const outcome = done(await buildAt(root, modules(), TWO))
    const [claude, agy] = outcome.report.targets
    assert.deepEqual(claude?.overridden, ['README.md'])
    assert.deepEqual(agy?.overridden, [])
    assert.equal(
      await readFile(join(root, 'dist/claude-code/README.md'), 'utf8'),
      'claude\n',
    )
    assert.equal(await readFile(join(root, 'dist/agy/README.md'), 'utf8'), 'shared\n')
  })
})

test('共用文件与生成文件同路径时写入该目录的全部目标失败，提示改用 overrides', async () => {
  await inProject({ 'files/manifest.json': '{"shared":true}\n' }, async root => {
    const outcome = await buildAt(root, modules(), TWO)
    assert.deepEqual(errorsOf(outcome), [
      [
        '同路径冲突：dist/claude-code/manifest.json 既由 claude-code 生成，又是共用文件 ' +
          'files/manifest.json；替换生成文件改用 overrides/claude-code/',
      ],
      [],
    ])
    assert.ok(!existsSync(join(root, 'dist/claude-code')))
    assert.ok(existsSync(join(root, 'dist/agy/manifest.json')))
  })
})

test('共用文件与复制的组件文件同路径时失败', async () => {
  const files = {
    'skills/review/SKILL.md': SKILL(),
    'files/skills/review/SKILL.md': SKILL(),
  }
  await inProject(files, async root => {
    const outcome = await buildAt(root, modules(), {
      targets: ['claude-code:subprocess'],
    })
    assert.deepEqual(errorsOf(outcome), [
      [
        '同路径冲突：dist/claude-code/skills/review/SKILL.md 既是复制的组件文件，又是共用文件 ' +
          'files/skills/review/SKILL.md；替换组件文件改用 overrides/claude-code/',
      ],
    ])
  })
})

test('生成文件与组件文件同路径时失败，附上宿主模块的 conflictHint', async () => {
  const generated: OutputFile = {
    path: 'skills/review/SKILL.md',
    content: 'generated\n',
    conflictHint: '规则 review 与 skill 同名',
  }
  await inProject({ 'skills/review/SKILL.md': SKILL() }, async root => {
    const outcome = await buildAt(root, modules([generated]), {
      targets: ['claude-code:subprocess'],
    })
    assert.deepEqual(errorsOf(outcome), [
      [
        '同路径冲突：dist/claude-code/skills/review/SKILL.md 既由 claude-code 生成，' +
          '又是复制的组件文件；规则 review 与 skill 同名',
      ],
    ])
  })
})

test('插件目录是源项目根目录时：files/ 非空则失败，生成文件与原位的组件文件同路径也失败', async () => {
  await inProject({ 'files/README.md': 'r\n' }, async root => {
    const outcome = await buildAt(root, modules(), ROOT_MERGED)
    const message =
      '共用文件：插件目录 . 是源项目根目录，files/ 中的文件不复制到这里；' +
      '把共用文件直接放在根目录，或改用默认布局'
    assert.deepEqual(errorsOf(outcome), [[message], [message]])
    assert.ok(!existsSync(join(root, 'manifest.json')))
    assert.ok(!existsSync(join(root, 'README.md')))
  })
  const generated: OutputFile = {
    path: 'skills/review/SKILL.md',
    content: 'generated\n',
  }
  await inProject({ 'skills/review/SKILL.md': SKILL() }, async root => {
    const outcome = await buildAt(root, modules([generated]), ROOT_MERGED)
    const message =
      '同路径冲突：skills/review/SKILL.md 既由 claude-code 生成，又是源项目中的组件文件'
    assert.deepEqual(errorsOf(outcome), [[message], [message]])
    assert.equal(await readFile(join(root, 'skills/review/SKILL.md'), 'utf8'), SKILL())
  })
})
