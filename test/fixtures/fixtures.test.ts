// 目标比对夹具（F-10-02）：逐个运行 test/fixtures/ 下的夹具，与期望产物逐字节比对；
// 在同一份产物上运行入口用例，并检查产物入口的导入（TA-01）。
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { importsOf } from '../helpers/imports.ts'
import {
  FIXTURES_DIR,
  type FixtureRun,
  fixtureNames,
  readCase,
  readEntryCases,
  readTree,
  runEntryCase,
  withFixtureRun,
} from './run.ts'

async function compareTree(name: string, run: FixtureRun): Promise<void> {
  const expectedDir = join(FIXTURES_DIR, name, 'expected')
  assert.equal(run.stdout, await readFile(join(expectedDir, 'stdout.txt'), 'utf8'))
  assert.equal(run.stderr, await readFile(join(expectedDir, 'stderr.txt'), 'utf8'))
  const expected = await readTree(join(expectedDir, 'tree'))
  assert.deepEqual([...run.tree.keys()], [...expected.keys()], '文件集合')
  for (const [path, content] of expected) {
    const actual = run.tree.get(path)
    // 先按文本比对以便看到差异，再逐字节确认
    assert.equal(actual?.toString('utf8'), content.toString('utf8'), path)
    assert.ok(actual?.equals(content), `${path} 与期望内容不一致`)
  }
}

// 子进程入口只导入 node: 内置模块；hooks 模块的守卫文件只导入 'claude-code'，
// hooks/register.ts 只导入 ./uapa-guard.mjs（类型导入不计；rolldown 把外部的相对导入记为去掉
// ./ 的形式）
async function checkImports(run: FixtureRun): Promise<void> {
  const entries = [...run.tree.keys()].filter(
    p => p.endsWith('.mjs') || p.endsWith('hooks/register.ts'),
  )
  for (const path of entries) {
    const imports = await importsOf(join(run.project, ...path.split('/')))
    const allowed = path.endsWith('/uapa-guard.mjs')
      ? (id: string) => id === 'claude-code'
      : path.endsWith('register.ts')
        ? (id: string) => id.replace(/^\.\//, '') === 'uapa-guard.mjs'
        : (id: string) => id.startsWith('node:')
    assert.ok(imports.every(allowed), `${path} 的导入：${imports.join(', ')}`)
  }
}

for (const name of fixtureNames()) {
  test(`夹具 ${name}`, async () => {
    const fixtureCase = await readCase(name)
    const entryCases = await readEntryCases(name)
    await withFixtureRun(name, fixtureCase, async run => {
      assert.equal(run.exitCode, fixtureCase.exitCode, `退出码；stderr：${run.stderr}`)
      await compareTree(name, run)
      await checkImports(run)
      for (const entryCase of entryCases) {
        const { result, expected } = await runEntryCase(run, entryCase)
        assert.deepEqual(
          result,
          expected,
          `入口用例 ${entryCase.target}/${entryCase.name}`,
        )
      }
    })
  })
}
