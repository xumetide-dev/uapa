// Claude Code 的 .claude-plugin/plugin.json（F-05-02）
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { claudeCodeSubprocess } from '../../src/capabilities/claude-code-subprocess.ts'
import type { UapaConfig } from '../../src/config/types.ts'
import { claudeCode } from '../../src/targets/claude-code/index.ts'
import type { HostResult, TargetPlan } from '../../src/targets/types.ts'
import { baseConfig } from '../helpers/project.ts'

const plan: TargetPlan = {
  target: 'claude-code:subprocess',
  capabilities: claudeCodeSubprocess,
  skills: [],
  checks: [],
}

function generate(config: Partial<UapaConfig>): Promise<HostResult> {
  return claudeCode.generate({
    config: { ...baseConfig, ...config } as UapaConfig,
    plans: [plan],
    guard: null,
    bundle: async () => '',
  })
}

function manifestOf(result: HostResult): string {
  assert.ok(result.ok)
  assert.equal(result.files.length, 1)
  assert.equal(result.files[0]?.path, '.claude-plugin/plugin.json')
  return result.files[0]?.content as string
}

test('最小配置只写名称、版本、描述与作者', async () => {
  const text = manifestOf(await generate({}))
  assert.equal(
    text,
    '{\n  "name": "demo",\n  "version": "0.1.0",\n  "description": "测试用插件",\n' +
      '  "author": {\n    "name": "Tester"\n  }\n}\n',
  )
})

test('宿主选项与可选字段按固定键序写入', async () => {
  const text = manifestOf(
    await generate({
      author: { url: 'https://example.com', email: 'a@example.com', name: 'A' },
      keywords: ['guard'],
      hosts: {
        'claude-code': {
          userConfig: { token: { type: 'string', title: 't', description: 'd' } },
          dependencies: ['other'],
          displayName: 'Demo',
          $schema: 'https://example.com/schema.json',
        },
      },
    }),
  )
  assert.deepEqual(Object.keys(JSON.parse(text)), [
    '$schema',
    'name',
    'displayName',
    'version',
    'description',
    'author',
    'keywords',
    'dependencies',
    'userConfig',
  ])
  assert.deepEqual(Object.keys(JSON.parse(text).author), ['name', 'email', 'url'])
})

test('名称不合规或缺少 author 时为每个目标返回错误', async () => {
  type Case = [Partial<UapaConfig>, RegExp]
  const prefixes = ['claude-', 'anthropic-', 'anthropics-', 'cc-plugin-']
  const names = ['claude', 'anthropic', 'claude-code', 'claude-mods']
  const cases: Case[] = [
    [{ name: 'My_Plugin' }, /不是 kebab-case/],
    ...prefixes.map(
      (p): Case => [{ name: `${p}tools` }, new RegExp(`保留前缀 ${p} 开头`)],
    ),
    ...names.map((name): Case => [{ name }, /保留名/]),
    [{ author: undefined }, /claude plugin validate --strict 把缺少 author 判为失败/],
  ]
  for (const [config, message] of cases) {
    const result = await generate(config)
    assert.ok(!result.ok)
    assert.ok(result.errors.every(note => note.target === 'claude-code:subprocess'))
    assert.ok(
      result.errors.some(note => message.test(note.message)),
      JSON.stringify(result.errors),
    )
  }
})
