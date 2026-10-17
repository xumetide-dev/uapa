// MCP 服务器的环境变量与占位符（F-05-26、F-06-12、F-11-12，SD-40）：Codex 把 envVars 写为
// env_vars，Claude Code 与 agy 不写；Codex 列出未声明 envVars 的本地服务器；Codex 与 agy 列出
// 含 ${ 的字段。跳过的服务器不写残余风险
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { agySubprocess } from '../../src/capabilities/agy-subprocess.ts'
import { claudeCodeSubprocess } from '../../src/capabilities/claude-code-subprocess.ts'
import { codexSubprocess } from '../../src/capabilities/codex-subprocess.ts'
import type { TargetCapabilities } from '../../src/capabilities/types.ts'
import type { TargetName } from '../../src/config/targets.ts'
import type { UapaConfig } from '../../src/config/types.ts'
import type { McpServer } from '../../src/source/types.ts'
import { agy } from '../../src/targets/agy/index.ts'
import { claudeCode } from '../../src/targets/claude-code/index.ts'
import { codex } from '../../src/targets/codex/index.ts'
import type { HostModule, HostResult } from '../../src/targets/types.ts'
import { baseConfig } from '../helpers/project.ts'

const SERVERS: readonly McpServer[] = [
  {
    name: 'api',
    kind: 'remote',
    url: `https://127.0.0.1:9/\${REGION}/mcp`,
    headers: { Authorization: `Bearer \${TOKEN}`, 'X-Plain': 'uapa-header-probe' },
  },
  {
    name: 'docs',
    kind: 'local',
    command: 'node',
    args: ['--port', `\${PORT}`],
    env: { DATA_DIR: `\${HOME}/data` },
    envVars: ['UAPA_TOKEN', 'HTTPS_PROXY'],
  },
  { name: 'launcher', kind: 'local', command: `{pluginRoot}/run.sh \${A}` },
  { name: 'plain', kind: 'local', command: 'uapa-mcp-probe' },
]

const LITERAL_FIELDS =
  'mcpServers.api.url、mcpServers.api.headers.Authorization、mcpServers.docs.args[1]、' +
  'mcpServers.docs.env.DATA_DIR'

function generate(
  host: HostModule,
  target: TargetName,
  capabilities: TargetCapabilities,
): Promise<HostResult> {
  return host.generate({
    config: { ...baseConfig, targets: [target] } as UapaConfig,
    plans: [
      {
        target,
        capabilities,
        skills: [],
        agents: [],
        mcpServers: SERVERS,
        rules: [],
        commands: [],
        checks: [],
        commandHooks: [],
      },
    ],
    guard: null,
    sharedWith: [],
    bundle: async () => '',
  })
}

function servers(
  result: HostResult,
  path: string,
): Record<string, Record<string, unknown>> {
  assert.ok(result.ok)
  const file = result.files.find(f => f.path === path)
  assert.ok(file !== undefined, path)
  return JSON.parse(String(file.content)).mcpServers
}

test('Codex：envVars 写为 env_vars；列出未声明 envVars 的本地服务器与含 ${ 的字段', async () => {
  const result = await generate(codex, 'codex:subprocess', codexSubprocess)
  const written = servers(result, 'mcp.json')
  assert.deepEqual(written.docs, {
    type: 'stdio',
    command: 'node',
    args: ['--port', `\${PORT}`],
    env: { DATA_DIR: `\${HOME}/data` },
    env_vars: ['UAPA_TOKEN', 'HTTPS_PROXY'],
  })
  assert.deepEqual(written.plain, { type: 'stdio', command: 'uapa-mcp-probe' })
  assert.ok(result.ok)
  assert.deepEqual(result.residualRisks.slice(1), [
    {
      target: 'codex:subprocess',
      message:
        'MCP 服务器 plain 未声明 envVars：Codex 启动本地服务器前清空环境，只传递 HOME、PATH ' +
        '等少数变量与 env、env_vars 中的变量',
    },
    {
      target: 'codex:subprocess',
      message: `MCP 服务器的字段 ${LITERAL_FIELDS} 含 \${：Codex 不展开 MCP 配置中的变量，按字面传递`,
    },
  ])
})

test('agy：envVars 不写入 mcp_config.json；列出含 ${ 的字段', async () => {
  const result = await generate(agy, 'agy:subprocess', agySubprocess)
  const written = servers(result, 'mcp_config.json')
  assert.deepEqual(written.docs, {
    command: 'node',
    args: ['--port', `\${PORT}`],
    env: { DATA_DIR: `\${HOME}/data` },
  })
  assert.ok(result.ok)
  assert.deepEqual(result.residualRisks, [
    {
      target: 'agy:subprocess',
      message: `MCP 服务器的字段 ${LITERAL_FIELDS} 含 \${：agy 不展开 MCP 配置中的变量，按字面传递`,
    },
  ])
})

test('Claude Code：envVars 不写入 .mcp.json，占位符原样写出，不写残余风险', async () => {
  const result = await generate(
    claudeCode,
    'claude-code:subprocess',
    claudeCodeSubprocess,
  )
  const written = servers(result, '.mcp.json')
  assert.deepEqual(written.docs, {
    command: 'node',
    args: ['--port', `\${PORT}`],
    env: { DATA_DIR: `\${HOME}/data` },
  })
  assert.equal(written.api?.url, `https://127.0.0.1:9/\${REGION}/mcp`)
  assert.ok(result.ok)
  assert.deepEqual(result.residualRisks, [])
})

test('没有未声明 envVars 的本地服务器、也没有含 ${ 的字段时，Codex 只写服务器名的风险', async () => {
  const declared: McpServer = {
    name: 'docs',
    kind: 'local',
    command: 'node',
    envVars: ['UAPA_TOKEN'],
  }
  const result = await codex.generate({
    config: { ...baseConfig, targets: ['codex:subprocess'] } as UapaConfig,
    plans: [
      {
        target: 'codex:subprocess',
        capabilities: codexSubprocess,
        skills: [],
        agents: [],
        mcpServers: [declared],
        rules: [],
        commands: [],
        checks: [],
        commandHooks: [],
      },
    ],
    guard: null,
    sharedWith: [],
    bundle: async () => '',
  })
  assert.ok(result.ok)
  assert.equal(result.residualRisks.length, 1)
  assert.match(
    result.residualRisks[0]?.message ?? '',
    /不为插件的 MCP 服务器名加命名空间/,
  )
})
