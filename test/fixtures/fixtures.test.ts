// 目标比对夹具（F-10-02）：逐个运行 test/fixtures/ 下的夹具，与期望产物逐字节比对。
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { FIXTURES_DIR, fixtureNames, readCase, readTree, runFixture } from './run.ts'

for (const name of fixtureNames()) {
  test(`夹具 ${name}`, async () => {
    const fixtureCase = await readCase(name)
    const result = await runFixture(name, fixtureCase)
    const expectedDir = join(FIXTURES_DIR, name, 'expected')
    assert.equal(
      result.exitCode,
      fixtureCase.exitCode,
      `退出码；stderr：${result.stderr}`,
    )
    assert.equal(result.stdout, await readFile(join(expectedDir, 'stdout.txt'), 'utf8'))
    assert.equal(result.stderr, await readFile(join(expectedDir, 'stderr.txt'), 'utf8'))
    const expected = await readTree(join(expectedDir, 'tree'))
    assert.deepEqual([...result.tree.keys()], [...expected.keys()], '文件集合')
    for (const [path, content] of expected) {
      const actual = result.tree.get(path)
      // 先按文本比对以便看到差异，再逐字节确认
      assert.equal(actual?.toString('utf8'), content.toString('utf8'), path)
      assert.ok(actual?.equals(content), `${path} 与期望内容不一致`)
    }
  })
}
