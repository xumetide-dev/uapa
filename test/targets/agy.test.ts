// agy 宿主模块：根 plugin.json（F-11-02）、根 hooks.json（F-11-03）、入口的打包请求
// （F-11-04）、字段白名单检查（F-11-05），以及只配置 agy:subprocess 的一次真实构建
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { test } from 'node:test'
import { build } from '../../src/build/index.ts'
import type { BundleRequest } from '../../src/bundle/types.ts'
import { agySubprocess } from '../../src/capabilities/agy-subprocess.ts'
import type { UapaConfig } from '../../src/config/types.ts'
import type { GuardCheck } from '../../src/runtime/core/types.ts'
import type { GuardOptionDecl } from '../../src/source/guard.ts'
import { fieldErrors } from '../../src/targets/agy/fields.ts'
import { agyHooks } from '../../src/targets/agy/hooks.ts'
import { agy } from '../../src/targets/agy/index.ts'
import type { HostResult } from '../../src/targets/types.ts'
import { runEntry } from '../helpers/entry.ts'
import { importsOf } from '../helpers/imports.ts'
import { REMOTE, SERVERS } from '../helpers/mcp.ts'
import { baseConfig, tempProject } from '../helpers/project.ts'

const TARGET = 'agy:subprocess'
const agyConfig = { ...baseConfig, targets: [TARGET] } as UapaConfig

const GUARD = {
  modulePath: '/project/guard.ts',
  name: 'g',
  requires: [],
  checks: ['beforeTool', 'beforeStop'] as GuardCheck[],
  options: [] as GuardOptionDecl[],
}

async function generate(
  checks: readonly GuardCheck[],
  guard: typeof GUARD | null = GUARD,
  config: Partial<UapaConfig> = {},
): Promise<{ result: HostResult; requests: BundleRequest[] }> {
  const requests: BundleRequest[] = []
  const result = await agy.generate({
    config: { ...agyConfig, ...config } as UapaConfig,
    plans: [
      {
        target: TARGET,
        capabilities: agySubprocess,
        skills: [],
        agents: [],
        mcpServers: [],
        rules: [],
        commands: [],
        checks,
        commandHooks: [],
      },
    ],
    guard,
    sharedWith: [],
    bundle: async request => {
      requests.push(request)
      return 'BUNDLED\n'
    },
  })
  return { result, requests }
}

function file(result: HostResult, path: string): string | undefined {
  assert.ok(result.ok)
  return result.files.find(f => f.path === path)?.content as string | undefined
}

test('plugin.json 只写 name 与 description，标注不可合并的冲突提示', async () => {
  const { result } = await generate([])
  assert.ok(result.ok)
  assert.deepEqual(result.files, [
    {
      path: 'plugin.json',
      content: '{\n  "name": "demo",\n  "description": "测试用插件"\n}\n',
      conflictHint:
        'agy 的根 plugin.json 只允许 name 与 description，不能与其他宿主的根 plugin.json ' +
        '合并；为 hosts.agy.dir 设置单独的目录',
    },
  ])
  // 其余配置字段不进入 agy 的 manifest
  const { result: full } = await generate([], null, {
    keywords: ['guard'],
    author: { name: 'A', email: 'a@example.com' },
  })
  assert.deepEqual(Object.keys(JSON.parse(file(full, 'plugin.json') ?? '{}')), [
    'name',
    'description',
  ])
})

test('插件名不匹配 ^[a-zA-Z0-9_-]+$ 时为每个目标返回错误', async () => {
  for (const name of ['demo.plugin', 'demo plugin', '插件', 'a/b']) {
    const { result, requests } = await generate(['beforeTool'], GUARD, { name })
    assert.ok(!result.ok)
    assert.deepEqual(result.errors, [
      {
        target: TARGET,
        message: `插件名 ${name} 不匹配 ^[a-zA-Z0-9_-]+$：agy 的 plugin.json 不接受该名称`,
      },
    ])
    assert.equal(requests.length, 0)
  }
  const { result } = await generate([], null, { name: 'Demo_1-x' })
  assert.ok(result.ok)
})

test('hooks.json 顶层键为插件名，PreToolUse 带空 matcher，Stop 直接为处理器', async () => {
  const { result } = await generate(['beforeTool', 'beforeStop'])
  const expected = [
    '{',
    '  "demo": {',
    '    "PreToolUse": [',
    '      {',
    '        "matcher": "",',
    '        "hooks": [',
    '          {',
    '            "type": "command",',
    '            "command": "node hooks/uapa-agy.mjs before-tool",',
    '            "timeout": 30',
    '          }',
    '        ]',
    '      }',
    '    ],',
    '    "Stop": [',
    '      {',
    '        "type": "command",',
    '        "command": "node hooks/uapa-agy.mjs before-stop",',
    '        "timeout": 30',
    '      }',
    '    ]',
    '  }',
    '}',
    '',
  ].join('\n')
  assert.equal(file(result, 'hooks.json'), expected)
  assert.equal(file(result, 'hooks/uapa-agy.mjs'), 'BUNDLED\n')
})

test('hookTimeoutSeconds 为 null 时处理器不写 timeout；beforePrompt 不生成 hook', () => {
  assert.deepEqual(agyHooks('demo', ['beforeStop'], null), {
    demo: {
      Stop: [{ type: 'command', command: 'node hooks/uapa-agy.mjs before-stop' }],
    },
  })
  assert.throws(() => agyHooks('demo', ['beforePrompt'], 30), /agy 没有提示提交事件/)
})

test('子进程入口的打包请求：入口名、守卫、目标数据与外部导入', async () => {
  const { result, requests } = await generate(['beforeTool'])
  assert.ok(result.ok)
  assert.deepEqual(requests, [
    {
      entry: 'agy-subprocess',
      guardModule: '/project/guard.ts',
      data: {
        pluginName: 'demo',
        toolNames: agySubprocess.toolNames,
        capabilities: agySubprocess.capabilities,
        moduleSessionEnv: null,
        options: [],
      },
      external: 'node',
    },
  ])
  assert.deepEqual(Object.keys(JSON.parse(file(result, 'hooks.json') ?? '{}').demo), [
    'PreToolUse',
  ])
  // 只有执行前检查时不记停机计数的残余风险，只记 /btw（F-11-14）
  assert.deepEqual(result.residualRisks, [
    {
      target: TARGET,
      message: '/btw 不运行用户与工作区的 hooks，其中是否运行插件的 hooks 未实测',
    },
  ])
})

test('checks 为空或未配置守卫时只生成 plugin.json，不打包', async () => {
  for (const [checks, guard] of [
    [[], GUARD],
    [['beforeTool'], null],
  ] as const) {
    const { result, requests } = await generate(checks, guard)
    assert.ok(result.ok)
    assert.deepEqual(
      result.files.map(f => f.path),
      ['plugin.json'],
    )
    assert.deepEqual(result.residualRisks, [])
    assert.equal(requests.length, 0)
  }
})

test('有停机前检查时残余风险写明停机计数随系统临时目录清理归零，以及连续继续的上限', async () => {
  const { result } = await generate(['beforeStop'])
  assert.ok(result.ok)
  assert.deepEqual(result.residualRisks, [
    {
      target: TARGET,
      message:
        '停机计数存放在系统临时目录下的 uapa-<插件名>/，该目录被清理时停机计数归零',
    },
    {
      target: TARGET,
      message:
        'agy 在连续继续 10 次后不再采用停机前检查的 continue（1.3.5 实测，次数可由用户配置）',
    },
  ])
})

test('字段白名单：每类额外字段与结构错误都使生成失败', () => {
  const manifest = { name: 'demo', description: 'd' }
  const handler = { type: 'command', command: 'node x', timeout: 30 }
  const pre = { matcher: '', hooks: [handler] }
  const valid = { demo: { PreToolUse: [pre], PostToolUse: [pre], Stop: [handler] } }
  assert.deepEqual(fieldErrors(manifest, valid), [])
  assert.deepEqual(fieldErrors(manifest, null), [])
  const cases: [Record<string, unknown>, Record<string, unknown> | null, string][] = [
    [{ ...manifest, version: '1' }, null, 'plugin.json 含 agy 不允许的字段 version'],
    [manifest, { demo: {}, other: {} }, 'hooks.json 的顶层应只有一个键，实际为 2 个'],
    [manifest, {}, 'hooks.json 的顶层应只有一个键，实际为 0 个'],
    [manifest, { demo: [] }, 'hooks.json 的 demo 不是对象'],
    [
      manifest,
      { demo: { Notify: [] } },
      'hooks.json 的 demo 含 agy 不允许的字段 Notify',
    ],
    [manifest, { demo: { Stop: {} } }, 'hooks.json 的 demo.Stop 不是数组'],
    [
      manifest,
      { demo: { PreToolUse: [{ ...pre, enabled: true }] } },
      'hooks.json 的 demo.PreToolUse[0] 含 agy 不允许的字段 enabled',
    ],
    [
      manifest,
      { demo: { PostToolUse: [{ matcher: '', hooks: 'x' }] } },
      'hooks.json 的 demo.PostToolUse[0].hooks 不是数组',
    ],
    [
      manifest,
      { demo: { PreToolUse: [{ matcher: '', hooks: [{ ...handler, async: true }] }] } },
      'hooks.json 的 demo.PreToolUse[0].hooks[0] 含 agy 不允许的字段 async',
    ],
    [
      manifest,
      { demo: { SessionStart: [{ ...handler, matcher: '' }] } },
      'hooks.json 的 demo.SessionStart[0] 含 agy 不允许的字段 matcher',
    ],
    [manifest, { demo: { Stop: ['x'] } }, 'hooks.json 的 demo.Stop[0] 不是对象'],
  ]
  for (const [m, hooks, message] of cases) {
    assert.deepEqual(fieldErrors(m, hooks), [message])
  }
})

// 夹具守卫的写法：拒绝与改写只匹配无副作用的标记命令（AGENTS.md）
const GUARD_SOURCE = `const guard = {
  name: 'agy-build-guard',
  requires: [],
  beforeTool(call) {
    const command = call.tool === 'shell' ? String(call.input.command) : ''
    if (command.includes('uapa-deny-probe')) {
      return { kind: 'deny', reason: '拒绝标记命令 uapa-deny-probe' }
    }
    if (command === 'echo uapa-rewrite-probe') {
      return {
        kind: 'rewrite',
        input: { command: 'echo uapa-rewritten' },
        fallbackReason: '请改用 echo uapa-rewritten',
      }
    }
    return { kind: 'allow' }
  },
  beforeStop: s =>
    s.continuations < 1 ? { kind: 'continue', reason: '请先运行测试' } : { kind: 'stop' },
}
export default guard
`

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true })
  return entries
    .filter(entry => entry.isFile())
    .map(entry => relative(dir, join(entry.parentPath, entry.name)))
    .sort()
}

test('只配置 agy:subprocess 时写出 plugin.json、hooks.json、入口与 skills，入口可运行', async () => {
  const project = await tempProject({
    'guard.ts': GUARD_SOURCE,
    'skills/review/SKILL.md': '---\nname: review\ndescription: d\n---\n',
  })
  const temp = await mkdtemp(join(tmpdir(), 'uapa-agy-tmp-'))
  try {
    const outcome = await build(
      { ...agyConfig, guard: 'guard.ts' } as UapaConfig,
      project.root,
      { check: false },
    )
    assert.equal(outcome.kind, 'done')
    const plugin = join(project.root, 'dist/agy')
    assert.deepEqual(await listFiles(plugin), [
      'hooks.json',
      'hooks/uapa-agy.mjs',
      'plugin.json',
      'skills/review/SKILL.md',
    ])
    const entry = join(plugin, 'hooks/uapa-agy.mjs')
    assert.ok((await importsOf(entry)).every(id => id.startsWith('node:')))
    const env = { TMPDIR: temp }
    const tool = (command: string) =>
      JSON.stringify({
        conversationId: 'c1',
        toolCall: { name: 'run_command', args: { CommandLine: command, Cwd: '.' } },
      })
    const stdout = (stdin: string, check = 'before-tool') => {
      const result = runEntry(entry, [check], stdin, env)
      assert.equal(result.status, 0)
      return result.stdout
    }
    assert.equal(stdout(tool('echo ok')), '{"decision":"allow"}\n')
    assert.equal(
      stdout(tool('echo uapa-deny-probe')),
      '{"decision":"deny","reason":"拒绝标记命令 uapa-deny-probe"}\n',
    )
    assert.equal(
      stdout(tool('echo uapa-rewrite-probe')),
      '{"decision":"allow","overwrite":{"CommandLine":"echo uapa-rewritten"}}\n',
    )
    const stop = JSON.stringify({ conversationId: 'c1' })
    assert.equal(
      stdout(stop, 'before-stop'),
      '{"decision":"continue","reason":"请先运行测试"}\n',
    )
    assert.equal(stdout(stop, 'before-stop'), '{}\n')
    // 停机计数只写入 TMPDIR 下的 uapa-<插件名>/
    assert.deepEqual(await listFiles(temp), ['uapa-demo/uapa-stop-c1.json'])
    const report = JSON.parse(
      await readFile(join(project.root, 'dist/uapa-report.json'), 'utf8'),
    )
    assert.equal(report.targets[0].status, 'ok')
    assert.equal(report.targets[0].hostValidation, 'none')
  } finally {
    await rm(temp, { recursive: true, force: true })
    await project.cleanup()
  }
})

test('mcp_config.json：args 与 env 的 {pluginRoot} 换为 .，url 写为 serverUrl，command 含它时跳过', async () => {
  const result = await agy.generate({
    config: agyConfig,
    plans: [
      {
        target: TARGET,
        capabilities: agySubprocess,
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
  assert.ok(result.ok)
  assert.deepEqual(JSON.parse(file(result, 'mcp_config.json') ?? ''), {
    mcpServers: {
      docs: {
        command: 'node',
        args: ['./mcp/server.mjs'],
        env: { UAPA_DATA: './data' },
      },
      plain: { command: 'uapa-mcp-probe', args: ['--stdio'] },
      remote: { serverUrl: REMOTE.url, headers: REMOTE.headers },
    },
  })
  assert.deepEqual(result.skipped, [
    {
      target: TARGET,
      component: 'mcpServers.launcher',
      reason:
        'agy 不展开 MCP 配置中的插件根，command 的相对路径按哪个目录解析依赖平台，' +
        'command 中的 {pluginRoot} 不能换算',
    },
  ])
  // plugin.json 不变；没有服务器时不生成 mcp_config.json
  assert.deepEqual(JSON.parse(file(result, 'plugin.json') ?? '').mcpServers, undefined)
  const { result: none } = await generate([])
  assert.equal(file(none, 'mcp_config.json'), undefined)
})

test('字段白名单覆盖 mcp_config.json', () => {
  const manifest = { name: 'n', description: 'd' }
  const ok = { mcpServers: { a: { serverUrl: 'u', headers: {} } } }
  assert.deepEqual(fieldErrors(manifest, null, ok), [])
  assert.deepEqual(fieldErrors(manifest, null, { mcpServers: { a: { url: 'u' } } }), [
    'mcp_config.json 的 mcpServers.a 含 agy 不允许的字段 url',
  ])
  assert.deepEqual(fieldErrors(manifest, null, { mcpServers: {}, servers: {} }), [
    'mcp_config.json 含 agy 不允许的字段 servers',
  ])
})
