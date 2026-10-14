// 共享运行时不引用 Node（TA-02）：runtime-core 配置通过；继承该配置、只包含一个引用
// process 的文件时 tsc 报错
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const TSC = join(root, 'node_modules', '.bin', 'tsc')

function tsc(project: string) {
  return spawnSync(TSC, ['-p', project], { encoding: 'utf8', timeout: 120_000 })
}

test('runtime-core 配置通过，引用 process 的文件在该配置下报错', async () => {
  const own = tsc(join(root, 'tsconfig.runtime-core.json'))
  assert.equal(own.status, 0, own.stdout)
  const dir = await mkdtemp(join(tmpdir(), 'uapa-ta02-'))
  try {
    const config = join(dir, 'tsconfig.json')
    await writeFile(
      config,
      JSON.stringify({
        extends: join(root, 'tsconfig.runtime-core.json'),
        include: [join(root, 'test/runtime/core-isolation/uses-process.ts')],
      }),
    )
    const result = tsc(config)
    assert.notEqual(result.status, 0)
    assert.match(result.stdout, /uses-process\.ts.*process/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
