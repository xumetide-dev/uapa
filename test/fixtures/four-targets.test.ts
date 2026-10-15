// 四目标夹具的多次构建验收：产物确定性（TA-06）、合并布局不越权写入（TA-07）、比对模式不写
// 文件（TA-08）。逐字节比对期望产物由 fixtures.test.ts 完成，这里只核对跨次运行的性质。
import assert from 'node:assert/strict'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  FIXTURES_DIR,
  type FixtureRun,
  readCase,
  readTree,
  runCli,
  withFixtureRun,
} from './run.ts'

async function twice(
  name: string,
  inspect: (first: FixtureRun, second: FixtureRun) => Promise<void>,
): Promise<void> {
  const fixtureCase = await readCase(name)
  await withFixtureRun(name, fixtureCase, first =>
    withFixtureRun(name, fixtureCase, second => inspect(first, second)),
  )
}

const ISO_TIME = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

for (const name of ['full', 'merged']) {
  test(`${name}：在两个绝对路径下构建，产物与报告逐字节一致，不含本机路径与时间（TA-06）`, async () => {
    await twice(name, async (first, second) => {
      assert.notEqual(first.project, second.project)
      assert.deepEqual([...first.tree.keys()], [...second.tree.keys()])
      for (const [path, content] of first.tree) {
        assert.ok(second.tree.get(path)?.equals(content), path)
        const text = content.toString('utf8')
        for (const local of [first.project, tmpdir(), homedir()]) {
          assert.ok(!text.includes(local), `${path} 含本机路径`)
        }
        assert.ok(!ISO_TIME.test(text), `${path} 含时间`)
      }
    })
  })
}

test('merged：预置文件不被修改或删除；merged-conflict：冲突目录不写入任何文件（TA-07）', async () => {
  const notes = await readFile(join(FIXTURES_DIR, 'merged', 'source', 'notes.txt'))
  await withFixtureRun('merged', await readCase('merged'), async run => {
    assert.equal(run.exitCode, 0, run.stderr)
    assert.ok(run.tree.get('notes.txt')?.equals(notes))
  })
  const name = 'merged-conflict'
  const source = await readTree(join(FIXTURES_DIR, name, 'source'))
  await withFixtureRun(name, await readCase(name), async run => {
    assert.equal(run.exitCode, 1)
    const outside = [...run.tree.keys()].filter(path => !path.startsWith('dist/'))
    assert.deepEqual(outside, [...source.keys()])
    for (const path of outside) {
      assert.ok(run.tree.get(path)?.equals(source.get(path) as Buffer), path)
    }
    const conflict =
      '合并布局冲突：hooks/hooks.json 由 claude-code、codex 生成，内容不同；' +
      '设置 hosts.codex.hooksFile 改用独立的 hooks 文件'
    assert.equal(
      run.stderr,
      ['claude-code:in-process', 'claude-code:subprocess', 'codex:subprocess']
        .map(target => `uapa: ${target}: ${conflict}\n`)
        .join(''),
    )
  })
})

// --check 前后对整个源项目目录做快照
async function check(run: FixtureRun) {
  const before = await readTree(run.project)
  const result = runCli(run.project, ['build', '--check'])
  const after = await readTree(run.project)
  assert.deepEqual([...after.keys()], [...before.keys()], '--check 改变了文件集合')
  for (const [path, content] of before) {
    assert.ok(after.get(path)?.equals(content), `--check 改变了 ${path}`)
  }
  return result
}

test('full：构建后 --check 无差异；删除、修改、新建产物文件后列出差异并以 1 结束（TA-08）', async () => {
  await withFixtureRun('full', await readCase('full'), async run => {
    assert.equal(run.exitCode, 0, run.stderr)
    assert.deepEqual(await check(run), { exitCode: 0, stdout: '', stderr: '' })
    const dist = join(run.project, 'dist')
    await rm(join(dist, 'agy', 'plugin.json'))
    await writeFile(join(dist, 'codex', '.codex-plugin', 'plugin.json'), '{}\n')
    await writeFile(join(dist, 'claude-code', 'extra.txt'), 'extra\n')
    const changed = await check(run)
    assert.equal(changed.exitCode, 1)
    assert.equal(
      changed.stdout,
      'added dist/agy/plugin.json\n' +
        'removed dist/claude-code/extra.txt\n' +
        'modified dist/codex/.codex-plugin/plugin.json\n',
    )
  })
})

test('merged：构建后 --check 无差异；源项目根目录中新建的无关文件不产生差异（TA-08）', async () => {
  await withFixtureRun('merged', await readCase('merged'), async run => {
    assert.equal(run.exitCode, 0, run.stderr)
    assert.deepEqual(await check(run), { exitCode: 0, stdout: '', stderr: '' })
    await writeFile(join(run.project, 'unrelated.txt'), 'unrelated\n')
    assert.deepEqual(await check(run), { exitCode: 0, stdout: '', stderr: '' })
  })
})
