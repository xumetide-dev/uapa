// 能力数据（F-03-01、TA-09）：模型缺字段时 tsc 报错；
// 每个已登记的数据模块写明宿主版本、核对日期与出处
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { claudeCodeSubprocess } from '../../src/capabilities/claude-code-subprocess.ts'
import { targetCapabilities } from '../../src/capabilities/index.ts'
import type { TargetCapabilities } from '../../src/capabilities/types.ts'
import { hostOf, TARGETS } from '../../src/config/targets.ts'

const RESEARCH = new URL(
  '../../docs/research/coding-agent-plugin-manifests/',
  import.meta.url,
)

test('每个目标都已登记，且 target 与宿主名一致', () => {
  assert.deepEqual(Object.keys(targetCapabilities).sort(), [...TARGETS].sort())
  for (const target of TARGETS) {
    assert.equal(targetCapabilities[target].target, target)
    assert.equal(targetCapabilities[target].host.name, hostOf(target))
  }
})

test('宿主版本、核对日期与出处', () => {
  for (const capabilities of Object.values(targetCapabilities)) {
    const { version, checked, source } = capabilities.host
    assert.match(version, /^(>=)?\d+\.\d+\.\d+$/, `${capabilities.target} 的宿主版本`)
    assert.match(checked, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(!Number.isNaN(Date.parse(checked)), `${capabilities.target} 的核对日期`)
    const file = fileURLToPath(new URL(source, RESEARCH))
    assert.ok(existsSync(file), `${capabilities.target} 的出处 ${source} 不存在`)
  }
})

test('能力数据缺字段时 tsc 报错（F-03-01）', () => {
  const { toolNames: _toolNames, ...withoutToolNames } = claudeCodeSubprocess
  // @ts-expect-error 缺少 toolNames
  const missing: TargetCapabilities = withoutToolNames
  assert.ok(missing)
})

// F-05-14：进程内运行，没有超时字段；钩子失败时被跳过，记为放行；不运行声明的命令
test('claude-code:in-process 的能力数据', () => {
  const data = targetCapabilities['claude-code:in-process']
  assert.equal(data.host.version, '2.1.296')
  assert.equal(data.host.source, 'claude-code-mods-guide.md')
  assert.equal(data.capabilities.promptGate, true)
  assert.deepEqual([data.hookTimeoutSeconds, data.defaultTimeoutSeconds], [null, null])
  for (const check of ['beforeTool', 'beforePrompt', 'beforeStop'] as const) {
    assert.deepEqual(data.failureDefault[check], { error: 'allow', timeout: 'allow' })
  }
  assert.deepEqual(data.toolNames, claudeCodeSubprocess.toolNames)
  assert.ok(Object.values(data.commandHookEvents).every(event => event === null))
})
