// 停机门禁的计数序列（TA-16）：在 single-claude 与 full 夹具的产物上多次运行各子进程入口的
// 停机前检查，核对每次的输出与数据目录下的计数文件（agy 以 TMPDIR 指定系统临时目录，计数文件
// 位于其下的 uapa-<插件名>/）
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { readCase, withFixtureRun } from '../fixtures/run.ts'
import { runEntry } from '../helpers/entry.ts'

const REASON = '请先运行测试再结束'

interface StopProtocol {
  readonly target: string
  readonly entry: string // 相对源项目根
  readonly stdin: (session: string) => unknown
  readonly env: (data: string) => Record<string, string>
  readonly continued: string // 继续时的 stdout（去掉换行）
  readonly ended: string // 结束时的 stdout（去掉换行）
  readonly stateDir: (data: string) => string
}

const claudeCode = (entry: string): StopProtocol => ({
  target: 'claude-code:subprocess',
  entry,
  stdin: session => ({ session_id: session, stop_hook_active: false }),
  env: data => ({ CLAUDE_PLUGIN_DATA: data }),
  continued: JSON.stringify({ decision: 'block', reason: REASON }),
  ended: '',
  stateDir: data => data,
})

const FIXTURES: readonly [string, readonly StopProtocol[]][] = [
  ['single-claude', [claudeCode('dist/claude-code/hooks/uapa-claude-code.mjs')]],
  [
    'full',
    [
      claudeCode('dist/claude-code/hooks/uapa-claude-code.mjs'),
      {
        target: 'codex:subprocess',
        entry: 'dist/codex/hooks/uapa-codex.mjs',
        stdin: session => ({
          session_id: session,
          hook_event_name: 'Stop',
          stop_hook_active: false,
        }),
        env: data => ({ PLUGIN_DATA: data }),
        continued: JSON.stringify({ decision: 'block', reason: REASON }),
        ended: '',
        stateDir: data => data,
      },
      {
        target: 'agy:subprocess',
        entry: 'dist/agy/hooks/uapa-agy.mjs',
        stdin: session => ({ conversationId: session }),
        env: data => ({ TMPDIR: data }),
        continued: JSON.stringify({ decision: 'continue', reason: REASON }),
        ended: '{}',
        stateDir: data => join(data, 'uapa-full-guard'),
      },
    ],
  ],
]

async function checkSequence(project: string, protocol: StopProtocol): Promise<void> {
  const label = protocol.target
  const data = await mkdtemp(join(tmpdir(), 'uapa-stop-state-'))
  try {
    const stop = (session: string) => {
      const stdin = JSON.stringify(protocol.stdin(session))
      const result = runEntry(join(project, protocol.entry), ['before-stop'], stdin, {
        ...protocol.env(data),
      })
      assert.equal(result.status, 0, label)
      assert.equal(result.stderr, '', label)
      return result.stdout.trim()
    }
    const count = async (session: string) => {
      const name = `uapa-stop-${encodeURIComponent(session)}.json`
      const file = join(protocol.stateDir(data), name)
      return JSON.parse(await readFile(file, 'utf8')).continuations
    }
    const outputs: string[] = []
    const counts: number[] = []
    for (const session of ['a', 'b', 'a', 'a', 'a']) {
      const output = stop(session)
      if (session === 'a') {
        outputs.push(output === protocol.ended ? 'end' : output)
        counts.push(await count('a'))
      }
    }
    const continued = protocol.continued
    assert.deepEqual(outputs, [continued, continued, 'end', continued], label)
    assert.deepEqual(counts, [1, 2, 0, 1], label)
    assert.equal(await count('b'), 1, label)
    // 会话 id 编码后作文件名，不写出数据目录
    stop('x/../y')
    assert.deepEqual(
      (await readdir(protocol.stateDir(data))).sort(),
      ['uapa-stop-a.json', 'uapa-stop-b.json', 'uapa-stop-x%2F..%2Fy.json'],
      label,
    )
  } finally {
    await rm(data, { recursive: true, force: true })
  }
}

for (const [fixture, protocols] of FIXTURES) {
  test(`${fixture}：停机计数按会话保存，同一会话继续两次后结束并归零，其他会话不受影响`, async () => {
    await withFixtureRun(fixture, await readCase(fixture), async run => {
      assert.equal(run.exitCode, 0, run.stderr)
      for (const protocol of protocols) await checkSequence(run.project, protocol)
    })
  })
}
