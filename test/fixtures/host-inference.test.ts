// TA-05（不在运行时推断宿主）：full 与 throwing-guard 夹具中三个子进程目标的入口用例各运行
// 两次，第二次另设其他目标的数据目录变量与 agy 的会话变量；两次输出逐字一致，其他目标变量所指
// 的目录中不出现文件
import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { TargetName } from '../../src/config/targets.ts'
import { readCase, readEntryCases, runEntryCase, withFixtureRun } from './run.ts'

const FIXTURES = ['full', 'throwing-guard']

// 各目标读取的数据目录变量（agy 以 TMPDIR 决定系统临时目录）
const DATA_ENV: Readonly<Record<string, string>> = {
  'claude-code:subprocess': 'CLAUDE_PLUGIN_DATA',
  'codex:subprocess': 'PLUGIN_DATA',
  'agy:subprocess': 'TMPDIR',
}

function otherVariables(target: TargetName): string[] {
  return Object.entries(DATA_ENV)
    .filter(([other]) => other !== target)
    .map(([, variable]) => variable)
}

for (const FIXTURE of FIXTURES) {
  test(`${FIXTURE}：入口不按其他宿主的环境变量改变输出（TA-05）`, async () => {
    const entryCases = await readEntryCases(FIXTURE)
    assert.deepEqual(
      [...new Set(entryCases.map(c => c.target))],
      ['agy:subprocess', 'claude-code:subprocess', 'codex:subprocess'],
    )
    await withFixtureRun(FIXTURE, await readCase(FIXTURE), async run => {
      for (const entryCase of entryCases) {
        const label = `${entryCase.target}/${entryCase.name}`
        const dirs = await mkdtemp(join(tmpdir(), 'uapa-other-'))
        try {
          const extraEnv: Record<string, string> = {
            ANTIGRAVITY_CONVERSATION_ID: 'other-conversation',
          }
          for (const variable of otherVariables(entryCase.target)) {
            extraEnv[variable] = await mkdtemp(join(dirs, `${variable}-`))
          }
          const first = await runEntryCase(run, entryCase)
          const second = await runEntryCase(run, entryCase, { extraEnv })
          assert.deepEqual(second.result, first.result, label)
          assert.deepEqual(first.result, first.expected, label)
          for (const variable of otherVariables(entryCase.target)) {
            const dir = extraEnv[variable] as string
            assert.deepEqual(await readdir(dir), [], `${label} 写入了 ${variable}`)
          }
        } finally {
          await rm(dirs, { recursive: true, force: true })
        }
      }
    })
  })
}
