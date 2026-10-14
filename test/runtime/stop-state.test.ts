// 停机门禁的计数序列（TA-16）：在 single-claude 夹具的产物上多次运行停机前检查，
// 核对每次的输出与 CLAUDE_PLUGIN_DATA 下的计数文件
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { readCase, withFixtureRun } from '../fixtures/run.ts'
import { runEntry } from '../helpers/entry.ts'

const CONTINUE = '{"decision":"block","reason":"请先运行测试再结束"}'

test('停机计数按会话保存：同一会话继续两次后结束并归零，其他会话不受影响', async () => {
  const fixtureCase = await readCase('single-claude')
  await withFixtureRun('single-claude', fixtureCase, async run => {
    assert.equal(run.exitCode, 0, run.stderr)
    const entry = join(run.project, 'dist/claude-code/hooks/uapa-claude-code.mjs')
    const data = await mkdtemp(join(tmpdir(), 'uapa-stop-state-'))
    try {
      const stop = (session: string) => {
        const stdin = JSON.stringify({ session_id: session, stop_hook_active: false })
        const result = runEntry(entry, ['before-stop'], stdin, {
          CLAUDE_PLUGIN_DATA: data,
        })
        assert.equal(result.status, 0)
        assert.equal(result.stderr, '')
        return result.stdout.trim()
      }
      const count = async (session: string) => {
        const file = join(data, `uapa-stop-${encodeURIComponent(session)}.json`)
        return JSON.parse(await readFile(file, 'utf8')).continuations
      }
      const outputs: string[] = []
      const counts: number[] = []
      for (const session of ['a', 'b', 'a', 'a', 'a']) {
        const output = stop(session)
        if (session === 'a') {
          outputs.push(output === '' ? 'end' : output)
          counts.push(await count('a'))
        }
      }
      assert.deepEqual(outputs, [CONTINUE, CONTINUE, 'end', CONTINUE])
      assert.deepEqual(counts, [1, 2, 0, 1])
      assert.equal(await count('b'), 1)
      // 会话 id 编码后作文件名，不写出数据目录
      stop('x/../y')
      assert.deepEqual((await readdir(data)).sort(), [
        'uapa-stop-a.json',
        'uapa-stop-b.json',
        'uapa-stop-x%2F..%2Fy.json',
      ])
    } finally {
      await rm(data, { recursive: true, force: true })
    }
  })
})
