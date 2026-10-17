// Codex 的 commands（F-06-09、F-06-13）：命令文件由构建编排放置，宿主模块不返回；按 rust-v0.162.1
// 的转换条件逐个检查，会被 Codex 跳过的命令列为跳过，不再写笼统的残余风险
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { codexSubprocess } from '../../src/capabilities/codex-subprocess.ts'
import type { UapaConfig } from '../../src/config/types.ts'
import type { Command } from '../../src/source/types.ts'
import { codex } from '../../src/targets/codex/index.ts'
import type { HostResult } from '../../src/targets/types.ts'
import { baseConfig } from '../helpers/project.ts'

const TARGET = 'codex:subprocess'

function command(name: string, body = '\n审查当前改动。\n'): Command {
  return {
    name,
    path: `commands/${name}.md`,
    description: '审查改动',
    body,
    targets: null,
  }
}

function generate(commands: readonly Command[]): Promise<HostResult> {
  return codex.generate({
    config: { ...baseConfig, targets: [TARGET] } as UapaConfig,
    plans: [
      {
        target: TARGET,
        capabilities: codexSubprocess,
        skills: [],
        agents: [],
        mcpServers: [],
        rules: [],
        commands,
        checks: [],
        commandHooks: [],
      },
    ],
    guard: null,
    sharedWith: [],
    bundle: async () => '',
  })
}

async function skippedOf(commands: readonly Command[]) {
  const result = await generate(commands)
  assert.ok(result.ok)
  assert.deepEqual(result.residualRisks, [])
  assert.ok(!result.files.some(file => file.path.startsWith('commands/')))
  return result.skipped.map(({ component, reason }) => [component, reason])
}

test('满足转换条件的命令不跳过，不写残余风险，不返回命令文件', async () => {
  assert.deepEqual(await skippedOf([command('review')]), [])
  assert.deepEqual(await skippedOf([]), [])
})

test('正文含模板写法的命令各列为跳过，原因写明命中的写法', async () => {
  const cases: [string, string, string][] = [
    ['args', '审查 $ARGUMENTS。', '$ARGUMENTS'],
    ['numbered', '总结 $1 的内容。', '$<数字>'],
    ['mustache', '使用 {{file}}。', '{{…}}'],
    ['shell', '当前状态：!`echo uapa-probe`', '!`…`'],
    ['shell-space', '当前状态：! `echo uapa-probe`', '!`…`'],
    ['mention', '阅读 @README.md 后回答。', '@<文件>'],
  ]
  const skipped = await skippedOf(cases.map(([name, body]) => command(name, body)))
  assert.deepEqual(
    skipped,
    cases
      .map(([name, , feature]) => [
        `commands/${name}.md`,
        `正文含模板写法 ${feature}，Codex 不转换`,
      ])
      .sort((a, b) => ((a[0] ?? '') < (b[0] ?? '') ? -1 : 1)),
  )
  // 单独的 @ 与 { } 不算模板写法
  assert.deepEqual(await skippedOf([command('plain', '邮件写 a @ b，{x}。')]), [])
})

test('README、过长的技能名、重名的技能名与超过 4000 字节的转换结果', async () => {
  const long = 'a'.repeat(50) // source-command- 加 50 个字符为 65 个字符
  const fits = 'b'.repeat(49)
  const skipped = await skippedOf([
    command('README'),
    command(long),
    command(fits),
    command('a_b'),
    command('a-b'),
    command('big', 'x'.repeat(4_000)),
  ])
  const same =
    'commands/a-b.md、commands/a_b.md 转换后的技能名都是 source-command-a-b，Codex 都不转换'
  assert.deepEqual(skipped, [
    ['commands/README.md', 'Codex 不转换文件名为 README 的命令'],
    ['commands/a-b.md', same],
    ['commands/a_b.md', same],
    [
      `commands/${long}.md`,
      `转换后的技能名 source-command-${long} 超过 64 个字符，Codex 不转换`,
    ],
    ['commands/big.md', '转换后的技能为 4185 字节，超过 Codex 的上限 4000 字节'],
  ])
})
