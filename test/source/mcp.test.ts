// 读取 MCP 服务器（F-01-08，SD-30）：mcp/servers.json 的 mcpServers，按名称排序
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { UapaConfig } from '../../src/config/types.ts'
import { readSource } from '../../src/source/index.ts'
import { baseConfig, tempProject } from '../helpers/project.ts'

async function read(files: Record<string, string>) {
  const project = await tempProject(files)
  try {
    return await readSource(baseConfig as UapaConfig, project.root)
  } finally {
    await project.cleanup()
  }
}

const servers = (value: unknown) => ({ 'mcp/servers.json': JSON.stringify(value) })

test('mcp/servers.json 不存在时没有服务器', async () => {
  const none = await read({ 'uapa.config.ts': '' })
  assert.ok(none.ok)
  assert.deepEqual(none.value.mcpServers, [])
  const other = await read({ 'mcp/README.md': '说明\n' })
  assert.ok(other.ok)
  assert.deepEqual(other.value.mcpServers, [])
})

test('本地与远程服务器按名称排序，未写的字段不出现', async () => {
  const result = await read(
    servers({
      mcpServers: {
        remote: {
          url: 'http://127.0.0.1:9/mcp',
          headers: { 'X-Probe': 'uapa-header-probe' },
        },
        docs: {
          command: 'node',
          args: ['{pluginRoot}/mcp/server.mjs'],
          env: { DATA: '{pluginRoot}/data' },
        },
        bare: { command: 'uapa-mcp-probe' },
      },
    }),
  )
  assert.ok(result.ok)
  assert.deepEqual(result.value.mcpServers, [
    { name: 'bare', kind: 'local', command: 'uapa-mcp-probe' },
    {
      name: 'docs',
      kind: 'local',
      command: 'node',
      args: ['{pluginRoot}/mcp/server.mjs'],
      env: { DATA: '{pluginRoot}/data' },
    },
    {
      name: 'remote',
      kind: 'remote',
      url: 'http://127.0.0.1:9/mcp',
      headers: { 'X-Probe': 'uapa-header-probe' },
    },
  ])
})

test('不是有效的 JSON、顶层或 mcpServers 形状不符时失败', async () => {
  const cases: [Record<string, string>, string | null, RegExp][] = [
    [{ 'mcp/servers.json': '{' }, null, /不是有效的 JSON/],
    [servers([]), null, /顶层应为对象/],
    [servers({ mcpServers: {}, extra: 1 }), 'extra', /顶层只有 mcpServers/],
    [servers({ servers: {} }), 'servers', /顶层只有 mcpServers/],
    [servers({ mcpServers: [] }), 'mcpServers', /服务器名到配置的映射/],
    [{ 'mcp/servers.json/x': '' }, null, /应为文件/],
    [{ mcp: '不是目录\n' }, null, /mcp 应为目录/],
  ]
  for (const [files, field, message] of cases) {
    const result = await read(files)
    assert.ok(!result.ok, JSON.stringify(files))
    assert.equal(result.issues[0]?.field, field)
    assert.match(result.issues[0]?.message ?? '', message)
  }
})

test('服务器名、字段、类型、混用与远程服务器的 {pluginRoot} 写到服务器名与字段', async () => {
  const cases: [unknown, string, RegExp][] = [
    [{ 'bad name': { command: 'x' } }, 'mcpServers.bad name', /字母、数字/],
    [{ a: 'node' }, 'mcpServers.a', /应为对象/],
    [{ a: { command: 'x', cwd: '.' } }, 'mcpServers.a.cwd', /未知字段/],
    [{ a: { command: 'x', url: 'http://h' } }, 'mcpServers.a', /混用/],
    [{ a: { args: ['x'] } }, 'mcpServers.a.command', /非空字符串/],
    [{ a: { command: '' } }, 'mcpServers.a.command', /非空字符串/],
    [{ a: { command: 'x', args: 'y' } }, 'mcpServers.a.args', /字符串数组/],
    [{ a: { command: 'x', args: ['y', 1] } }, 'mcpServers.a.args[1]', /应为字符串/],
    [{ a: { command: 'x', env: { K: 1 } } }, 'mcpServers.a.env.K', /应为字符串/],
    [{ a: { url: 1 } }, 'mcpServers.a.url', /非空字符串/],
    [{ a: { url: '{pluginRoot}/x' } }, 'mcpServers.a.url', /远程服务器不能使用/],
    [
      { a: { url: 'http://h', headers: { H: '{pluginRoot}' } } },
      'mcpServers.a.headers.H',
      /远程服务器不能使用/,
    ],
    [{ a: { url: 'http://h', headers: [] } }, 'mcpServers.a.headers', /映射/],
  ]
  for (const [map, field, message] of cases) {
    const result = await read(servers({ mcpServers: map }))
    assert.ok(!result.ok, JSON.stringify(map))
    assert.equal(result.issues[0]?.file, 'mcp/servers.json')
    assert.equal(result.issues[0]?.field, field)
    assert.match(result.issues[0]?.message ?? '', message)
  }
})

test('本地服务器的 envVars 按声明顺序读取', async () => {
  const result = await read(
    servers({
      mcpServers: {
        docs: { command: 'node', envVars: ['UAPA_TOKEN', '_PROXY', 'a1'] },
      },
    }),
  )
  assert.ok(result.ok)
  assert.deepEqual(result.value.mcpServers, [
    {
      name: 'docs',
      kind: 'local',
      command: 'node',
      envVars: ['UAPA_TOKEN', '_PROXY', 'a1'],
    },
  ])
})

test('envVars：远程服务器写该字段、为空、元素不合规则或重复时失败，字段写到元素', async () => {
  const cases: [unknown, [string, RegExp][]][] = [
    [
      { url: 'http://h', envVars: ['A'] },
      [['mcpServers.a.envVars', /只用于本地服务器/]],
    ],
    [{ command: 'x', envVars: [] }, [['mcpServers.a.envVars', /非空的字符串数组/]]],
    [{ command: 'x', envVars: 'A' }, [['mcpServers.a.envVars', /非空的字符串数组/]]],
    [
      { command: 'x', envVars: ['A', '1B', 'C-D', 2] },
      [
        ['mcpServers.a.envVars[1]', /应为变量名/],
        ['mcpServers.a.envVars[2]', /应为变量名/],
        ['mcpServers.a.envVars[3]', /应为变量名/],
      ],
    ],
    [
      { command: 'x', envVars: ['A', 'B', 'A'] },
      [['mcpServers.a.envVars[2]', /与 mcpServers\.a\.envVars\[0\] 重复/]],
    ],
  ]
  for (const [config, expected] of cases) {
    const result = await read(servers({ mcpServers: { a: config } }))
    assert.ok(!result.ok, JSON.stringify(config))
    assert.deepEqual(
      result.issues.map(i => i.field),
      expected.map(([field]) => field),
    )
    expected.forEach(([, message], index) => {
      assert.match(result.issues[index]?.message ?? '', message)
    })
  }
})

test('mcpServers.<name>.targets：合法列表通过，为空、重复或未知目标名时失败（F-01-15）', async () => {
  const valid = await read(
    servers({
      mcpServers: {
        local: {
          command: 'node',
          targets: ['claude-code:subprocess', 'codex:subprocess'],
        },
        remote: { url: 'http://127.0.0.1:9/mcp', targets: ['agy:subprocess'] },
      },
    }),
  )
  assert.ok(valid.ok)
  assert.deepEqual(valid.value.mcpServers, [
    {
      name: 'local',
      kind: 'local',
      command: 'node',
      targets: ['claude-code:subprocess', 'codex:subprocess'],
    },
    {
      name: 'remote',
      kind: 'remote',
      url: 'http://127.0.0.1:9/mcp',
      targets: ['agy:subprocess'],
    },
  ])
  const invalidCases: [unknown, string, RegExp][] = [
    [{ command: 'x', targets: [] }, 'mcpServers.a.targets', /非空的目标名列表/],
    [
      { command: 'x', targets: 'codex:subprocess' },
      'mcpServers.a.targets',
      /非空的目标名列表/,
    ],
    [
      { command: 'x', targets: ['codex:subprocess', 'codex:subprocess'] },
      'mcpServers.a.targets[1]',
      /与 mcpServers\.a\.targets\[0\] 重复/,
    ],
    [
      { command: 'x', targets: ['unknown:target'] },
      'mcpServers.a.targets[0]',
      /未知目标名/,
    ],
  ]
  for (const [config, field, message] of invalidCases) {
    const result = await read(servers({ mcpServers: { a: config } }))
    assert.ok(!result.ok)
    assert.equal(result.issues[0]?.field, field)
    assert.match(result.issues[0]?.message ?? '', message)
  }
})
