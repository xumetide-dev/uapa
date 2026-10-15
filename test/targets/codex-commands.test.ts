// Codex 的 commands（F-06-09，SD-33）：命令文件由构建编排放置，宿主模块不返回；TargetPlan.commands
// 非空时写一条命令转换限制的残余风险
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { codexSubprocess } from '../../src/capabilities/codex-subprocess.ts'
import type { UapaConfig } from '../../src/config/types.ts'
import type { Command } from '../../src/source/types.ts'
import { codex } from '../../src/targets/codex/index.ts'
import type { HostResult } from '../../src/targets/types.ts'
import { baseConfig } from '../helpers/project.ts'

const TARGET = 'codex:subprocess'

const COMMANDS_RISK =
  'Codex 安装时把 commands 转换为技能，正文含 $ARGUMENTS 等模板写法或转换结果超过 4000 字节的' +
  '命令被跳过，UAPA 不检查'

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

test('有 commands 时写命令转换限制的残余风险，不返回命令文件', async () => {
  const result = await generate([
    { name: 'review', path: 'commands/review.md', targets: null },
  ])
  assert.ok(result.ok)
  assert.deepEqual(result.residualRisks, [{ target: TARGET, message: COMMANDS_RISK }])
  assert.ok(!result.files.some(file => file.path.startsWith('commands/')))
})

test('没有 commands 时不写该风险', async () => {
  const result = await generate([])
  assert.ok(result.ok)
  assert.deepEqual(result.residualRisks, [])
})
