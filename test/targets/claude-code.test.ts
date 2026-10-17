// Claude Code 的 .claude-plugin/plugin.json（F-05-02、F-05-20、F-05-25）与 .mcp.json（F-05-12）
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { claudeCodeSubprocess } from '../../src/capabilities/claude-code-subprocess.ts'
import type { UapaConfig } from '../../src/config/types.ts'
import { claudeCode } from '../../src/targets/claude-code/index.ts'
import type { HostResult, TargetPlan } from '../../src/targets/types.ts'
import { SERVERS } from '../helpers/mcp.ts'
import { baseConfig } from '../helpers/project.ts'

const plan: TargetPlan = {
  target: 'claude-code:subprocess',
  capabilities: claudeCodeSubprocess,
  skills: [],
  agents: [],
  mcpServers: [],
  rules: [],
  commands: [],
  checks: [],
  commandHooks: [],
}

function generate(config: Partial<UapaConfig>): Promise<HostResult> {
  return claudeCode.generate({
    config: { ...baseConfig, ...config } as UapaConfig,
    plans: [plan],
    guard: null,
    sharedWith: [],
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
  // 以 - 分隔的任一段为保留词时失败，原因写明 validate --strict 拒绝（F-05-25）
  const segments: [string, string][] = [
    ['claude-tools', 'claude'],
    ['anthropic-tools', 'anthropic'],
    ['anthropics-tools', 'anthropics'],
    ['claude', 'claude'],
    ['claude-code', 'claude'],
    ['claude-mods', 'claude'],
    ['team-claude-tools', 'claude'],
    ['anthropics', 'anthropics'],
    ['my-anthropic', 'anthropic'],
  ]
  const strict = 'claude plugin validate --strict 拒绝该名称'
  const cases: Case[] = [
    [{ name: 'My_Plugin' }, /不是 kebab-case/],
    ...segments.map(
      ([name, segment]): Case => [
        { name },
        new RegExp(`含保留段 ${segment}：${strict}`),
      ],
    ),
    [{ name: 'cc-plugin-tools' }, new RegExp(`保留前缀 cc-plugin- 开头：${strict}`)],
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

test('段中含保留词而不等于保留词的名称通过', async () => {
  for (const name of ['claudette', 'myclaude', 'anthropical-tools']) {
    assert.ok((await generate({ name })).ok, name)
  }
})

test('manifest 透传字段按写入顺序追加在生成的字段之后', async () => {
  const text = manifestOf(
    await generate({
      keywords: ['guard'],
      hosts: {
        'claude-code': {
          displayName: 'Demo',
          manifest: {
            license: 'MIT',
            homepage: 'https://example.com',
            hooks: './h.json',
          },
        },
      },
    }),
  )
  assert.deepEqual(Object.keys(JSON.parse(text)), [
    'name',
    'displayName',
    'version',
    'description',
    'author',
    'keywords',
    'license',
    'homepage',
    'hooks',
  ])
})

test(`.mcp.json：{pluginRoot} 换为 \${CLAUDE_PLUGIN_ROOT}，远程服务器写 type: "http"，不跳过服务器`, async () => {
  const inProcess: TargetPlan = {
    ...plan,
    target: 'claude-code:in-process',
    mcpServers: SERVERS,
  }
  const result = await claudeCode.generate({
    config: baseConfig as UapaConfig,
    plans: [{ ...plan, mcpServers: SERVERS }, inProcess],
    guard: null,
    sharedWith: [],
    bundle: async () => '',
  })
  assert.ok(result.ok)
  assert.deepEqual(result.skipped, [])
  const mcp = result.files.filter(f => f.path === '.mcp.json')
  assert.equal(mcp.length, 1)
  const root = `\${CLAUDE_PLUGIN_ROOT}`
  assert.equal(
    mcp[0]?.content,
    `${JSON.stringify(
      {
        mcpServers: {
          docs: {
            command: 'node',
            args: [`${root}/mcp/server.mjs`],
            env: { UAPA_DATA: `${root}/data` },
          },
          launcher: { command: `${root}/mcp/run.sh` },
          plain: { command: 'uapa-mcp-probe', args: ['--stdio'] },
          remote: {
            type: 'http',
            url: 'http://127.0.0.1:9/mcp',
            headers: { 'X-Uapa-Probe': 'uapa-header-probe' },
          },
        },
      },
      null,
      2,
    )}\n`,
  )
  // 没有服务器时不生成，manifest 不写指向它的字段
  manifestOf(await generate({}))
})
