// Codex 宿主模块：.codex-plugin/plugin.json（F-06-02）、hooks 配置（F-06-03）、入口的打包请求
// （F-06-04）、字段白名单检查（F-06-05），以及只配置 codex:subprocess 的一次真实构建
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { test } from 'node:test'
import { build } from '../../src/build/index.ts'
import type { BundleRequest } from '../../src/bundle/types.ts'
import { codexSubprocess } from '../../src/capabilities/codex-subprocess.ts'
import type { UapaConfig } from '../../src/config/types.ts'
import type { GuardCheck } from '../../src/runtime/core/types.ts'
import { fieldErrors } from '../../src/targets/codex/fields.ts'
import { codexHooks } from '../../src/targets/codex/hooks.ts'
import { codex } from '../../src/targets/codex/index.ts'
import type { HostResult } from '../../src/targets/types.ts'
import { runEntry } from '../helpers/entry.ts'
import { importsOf } from '../helpers/imports.ts'
import { baseConfig, tempProject } from '../helpers/project.ts'

const TARGET = 'codex:subprocess'
const MANIFEST = '.codex-plugin/plugin.json'
const codexConfig = { ...baseConfig, targets: [TARGET] } as UapaConfig

const GUARD = {
  modulePath: '/project/guard.ts',
  name: 'g',
  requires: [],
  checks: ['beforeTool', 'beforePrompt', 'beforeStop'] as GuardCheck[],
}

async function generate(
  checks: readonly GuardCheck[],
  guard: typeof GUARD | null = GUARD,
  config: Partial<UapaConfig> = {},
): Promise<{ result: HostResult; requests: BundleRequest[] }> {
  const requests: BundleRequest[] = []
  const result = await codex.generate({
    config: { ...codexConfig, ...config } as UapaConfig,
    plans: [
      {
        target: TARGET,
        capabilities: codexSubprocess,
        skills: [],
        agents: [],
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

test('没有 hooks 时 manifest 只写名称、版本与描述，不写 author', async () => {
  const { result } = await generate([])
  assert.ok(result.ok)
  assert.deepEqual(result.files, [
    {
      path: MANIFEST,
      content:
        '{\n  "name": "demo",\n  "version": "0.1.0",\n  "description": "测试用插件"\n}\n',
    },
  ])
})

test('manifest 按固定键序写 keywords、hooks 与 hosts.codex.interface', async () => {
  const { result } = await generate(['beforeTool'], GUARD, {
    keywords: ['guard'],
    hosts: { codex: { interface: { displayName: 'Demo', developerName: 'Team' } } },
  })
  const parsed = JSON.parse(file(result, MANIFEST) ?? '{}')
  assert.deepEqual(Object.keys(parsed), [
    'name',
    'version',
    'description',
    'keywords',
    'hooks',
    'interface',
  ])
  assert.equal(parsed.hooks, './hooks/hooks.json')
  assert.deepEqual(parsed.interface, { displayName: 'Demo', developerName: 'Team' })
})

test('插件名不是 kebab-case 时为每个目标返回错误，不打包', async () => {
  for (const name of ['My_Plugin', 'demo.x', 'Demo']) {
    const { result, requests } = await generate(['beforeTool'], GUARD, { name })
    assert.ok(!result.ok)
    assert.deepEqual(result.errors, [
      {
        target: TARGET,
        message: `插件名 ${name} 不是 kebab-case：Codex 以插件名作为组件命名空间`,
      },
    ])
    assert.equal(requests.length, 0)
  }
})

test('hooks/hooks.json 按 checks 生成条目，不写 matcher，命令引用 PLUGIN_ROOT 占位符', async () => {
  const { result } = await generate(['beforeTool', 'beforePrompt', 'beforeStop'])
  assert.ok(result.ok)
  const entry = (arg: string) => [
    {
      hooks: [
        {
          type: 'command',
          command: `node "\${PLUGIN_ROOT}/hooks/uapa-codex.mjs" ${arg}`,
          timeout: 30,
        },
      ],
    },
  ]
  const expected = {
    hooks: {
      PreToolUse: entry('before-tool'),
      UserPromptSubmit: entry('before-prompt'),
      Stop: entry('before-stop'),
    },
  }
  const hooks = result.files.find(f => f.path === 'hooks/hooks.json')
  assert.deepEqual(hooks, {
    path: 'hooks/hooks.json',
    content: `${JSON.stringify(expected, null, 2)}\n`,
    conflictHint: '设置 hosts.codex.hooksFile 改用独立的 hooks 文件',
  })
  assert.equal(file(result, 'hooks/uapa-codex.mjs'), 'BUNDLED\n')
})

test('hookTimeoutSeconds 为 null 时处理器不写 timeout', () => {
  assert.deepEqual(codexHooks(['beforeStop'], null), {
    hooks: {
      Stop: [
        {
          hooks: [
            {
              type: 'command',
              command: `node "\${PLUGIN_ROOT}/hooks/uapa-codex.mjs" before-stop`,
            },
          ],
        },
      ],
    },
  })
})

test('hooksFile 改变 hooks 配置的路径并同步 manifest 的 hooks，不带冲突提示', async () => {
  for (const hooksFile of ['hooks/codex.json', './hooks/codex.json']) {
    const { result } = await generate(['beforeTool'], GUARD, {
      hosts: { codex: { hooksFile } },
    })
    assert.ok(result.ok)
    assert.deepEqual(
      result.files.map(f => f.path),
      [MANIFEST, 'hooks/codex.json', 'hooks/uapa-codex.mjs'],
    )
    assert.equal(JSON.parse(file(result, MANIFEST) ?? '{}').hooks, './hooks/codex.json')
    const hooks = result.files.find(f => f.path === 'hooks/codex.json')
    assert.equal(hooks?.conflictHint, undefined)
  }
  for (const hooksFile of ['.codex-plugin/plugin.json', 'hooks/uapa-codex.mjs']) {
    const { result } = await generate(['beforeTool'], GUARD, {
      hosts: { codex: { hooksFile } },
    })
    assert.ok(!result.ok)
    assert.deepEqual(
      result.errors.map(e => e.message),
      [`hosts.codex.hooksFile 与 Codex 产物 ${hooksFile} 同路径`],
    )
  }
})

test('子进程入口的打包请求与残余风险', async () => {
  const { result, requests } = await generate(['beforeTool'])
  assert.ok(result.ok)
  assert.deepEqual(requests, [
    {
      entry: 'codex-subprocess',
      guardModule: '/project/guard.ts',
      data: {
        pluginName: 'demo',
        toolNames: codexSubprocess.toolNames,
        capabilities: codexSubprocess.capabilities,
        moduleSessionEnv: null,
      },
      external: 'node',
    },
  ])
  assert.deepEqual(
    result.residualRisks.map(r => r.message),
    [
      'Codex 只运行已信任的 hooks：安装后或 hooks 配置改动后须在 Codex 的 /hooks 中信任，' +
        '未信任的 hook 被静默跳过，守卫不生效',
      '含 hooks 的插件不能进入 Codex 的公开插件目录',
    ],
  )
})

test('checks 为空或未配置守卫时只生成 manifest，不写 hooks 字段、不打包', async () => {
  for (const [checks, guard] of [
    [[], GUARD],
    [['beforeTool'], null],
  ] as const) {
    const { result, requests } = await generate(checks, guard)
    assert.ok(result.ok)
    assert.deepEqual(
      result.files.map(f => f.path),
      [MANIFEST],
    )
    assert.equal(JSON.parse(file(result, MANIFEST) ?? '{}').hooks, undefined)
    assert.deepEqual(result.residualRisks, [])
    assert.equal(requests.length, 0)
  }
})

test('字段白名单：每类额外字段与结构错误都使生成失败', () => {
  const manifest = { name: 'demo', version: '0.1.0', description: 'd' }
  const handler = { type: 'command', command: 'node x', timeout: 30 }
  const group = { matcher: '', hooks: [handler] }
  const valid = {
    hooks: { PreToolUse: [group], UserPromptSubmit: [group], Stop: [group] },
  }
  const file = 'hooks/hooks.json'
  assert.deepEqual(fieldErrors(manifest, { file, value: valid }), [])
  assert.deepEqual(
    fieldErrors({ ...manifest, interface: { websiteURL: 'u' } }, null),
    [],
  )
  type Case = [Record<string, unknown>, Record<string, unknown> | null, string]
  const cases: Case[] = [
    [{ ...manifest, author: {} }, null, `${MANIFEST} 含 Codex 不允许的字段 author`],
    [
      { ...manifest, interface: { icon: 'x' } },
      null,
      `${MANIFEST} 的 interface 含 Codex 不允许的字段 icon`,
    ],
    [{ ...manifest, interface: 'x' }, null, `${MANIFEST} 的 interface 不是对象`],
    [
      manifest,
      { ...valid, modules: {} },
      'hooks/hooks.json 含 Codex 不允许的字段 modules',
    ],
    [manifest, { hooks: [] }, 'hooks/hooks.json 的 hooks 不是对象'],
    [
      manifest,
      { hooks: { Notification: [] } },
      'hooks/hooks.json 的 hooks 含 Codex 不允许的字段 Notification',
    ],
    [manifest, { hooks: { Stop: {} } }, 'hooks/hooks.json 的 hooks.Stop 不是数组'],
    [
      manifest,
      { hooks: { Stop: [{ ...group, enabled: true }] } },
      'hooks/hooks.json 的 hooks.Stop[0] 含 Codex 不允许的字段 enabled',
    ],
    [
      manifest,
      { hooks: { PreToolUse: [{ hooks: 'x' }] } },
      'hooks/hooks.json 的 hooks.PreToolUse[0].hooks 不是数组',
    ],
    [
      manifest,
      { hooks: { PreToolUse: [{ hooks: [{ ...handler, async: true }] }] } },
      'hooks/hooks.json 的 hooks.PreToolUse[0].hooks[0] 含 Codex 不允许的字段 async',
    ],
  ]
  for (const [m, value, message] of cases) {
    assert.deepEqual(fieldErrors(m, value === null ? null : { file, value }), [message])
  }
})

// 夹具守卫的写法：拒绝与改写只匹配无副作用的标记命令（AGENTS.md）
const GUARD_SOURCE = `const guard = {
  name: 'codex-build-guard',
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
  beforePrompt: p =>
    p.prompt.includes('API_KEY=') ? { kind: 'block', reason: '提示中含疑似密钥' } : { kind: 'allow' },
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

test('只配置 codex:subprocess 时写出 manifest、hooks 配置、入口与 skills，入口可运行', async () => {
  const project = await tempProject({
    'guard.ts': GUARD_SOURCE,
    'skills/review/SKILL.md': '---\nname: review\ndescription: d\n---\n',
  })
  const data = await mkdtemp(join(tmpdir(), 'uapa-codex-data-'))
  try {
    const outcome = await build(
      { ...codexConfig, guard: 'guard.ts' } as UapaConfig,
      project.root,
      { check: false },
    )
    assert.equal(outcome.kind, 'done')
    const plugin = join(project.root, 'dist/codex')
    assert.deepEqual(await listFiles(plugin), [
      '.codex-plugin/plugin.json',
      'hooks/hooks.json',
      'hooks/uapa-codex.mjs',
      'skills/review/SKILL.md',
    ])
    const entry = join(plugin, 'hooks/uapa-codex.mjs')
    assert.ok((await importsOf(entry)).every(id => id.startsWith('node:')))
    // 宿主不预先创建插件数据目录
    const env = { PLUGIN_DATA: join(data, 'demo-local') }
    const run = (check: string, stdin: object) =>
      runEntry(entry, [check], JSON.stringify(stdin), env)
    const tool = (command: string) => ({
      session_id: 's1',
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command },
      tool_use_id: 'call_1',
    })
    assert.deepEqual(run('before-tool', tool('echo ok')), {
      status: 0,
      stdout: '',
      stderr: '',
    })
    assert.deepEqual(run('before-tool', tool('echo uapa-deny-probe')), {
      status: 2,
      stdout: '',
      stderr: '拒绝标记命令 uapa-deny-probe\n',
    })
    const rewritten = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        updatedInput: { command: 'echo uapa-rewritten' },
      },
    }
    assert.deepEqual(run('before-tool', tool('echo uapa-rewrite-probe')), {
      status: 0,
      stdout: `${JSON.stringify(rewritten)}\n`,
      stderr: '',
    })
    const prompt = { session_id: 's1', prompt: 'API_KEY=1' }
    assert.deepEqual(run('before-prompt', prompt), {
      status: 2,
      stdout: '',
      stderr: '提示中含疑似密钥\n',
    })
    const stop = { session_id: 's1', stop_hook_active: false }
    assert.deepEqual(run('before-stop', stop), {
      status: 0,
      stdout: '{"decision":"block","reason":"请先运行测试"}\n',
      stderr: '',
    })
    assert.deepEqual(run('before-stop', { ...stop, stop_hook_active: true }), {
      status: 0,
      stdout: '',
      stderr: '',
    })
    // 停机计数只写入 PLUGIN_DATA 所指目录
    assert.deepEqual(await listFiles(data), ['demo-local/uapa-stop-s1.json'])
    const report = JSON.parse(
      await readFile(join(project.root, 'dist/uapa-report.json'), 'utf8'),
    )
    assert.equal(report.targets[0].status, 'ok')
    assert.equal(report.targets[0].hostValidation, 'none')
  } finally {
    await rm(data, { recursive: true, force: true })
    await project.cleanup()
  }
})
