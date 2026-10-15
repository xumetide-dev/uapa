// 三个子进程目标写入声明的命令 hooks（F-05-15、F-06-08、F-11-06），以及共用插件目录时的
// manifest 与残余风险（承接 M1-04、M1-05 验收 §7）
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { agySubprocess } from '../../src/capabilities/agy-subprocess.ts'
import { claudeCodeSubprocess } from '../../src/capabilities/claude-code-subprocess.ts'
import { codexSubprocess } from '../../src/capabilities/codex-subprocess.ts'
import type { TargetCapabilities } from '../../src/capabilities/types.ts'
import type { HostName } from '../../src/config/targets.ts'
import type { CommandHookDecl, UapaConfig } from '../../src/config/types.ts'
import type { GuardCheck } from '../../src/runtime/core/types.ts'
import { agy } from '../../src/targets/agy/index.ts'
import { claudeCode } from '../../src/targets/claude-code/index.ts'
import { codex } from '../../src/targets/codex/index.ts'
import type { HostModule, HostResult } from '../../src/targets/types.ts'
import { baseConfig } from '../helpers/project.ts'

const GUARD = {
  modulePath: '/project/guard.ts',
  name: 'g',
  requires: [],
  checks: ['beforeTool', 'beforeStop'] as GuardCheck[],
}

interface Case {
  readonly module: HostModule
  readonly capabilities: TargetCapabilities
  readonly checks: readonly GuardCheck[]
  readonly commandHooks: readonly CommandHookDecl[]
  readonly withGuard?: boolean
  readonly sharedWith?: readonly HostName[]
  readonly config?: Partial<UapaConfig>
}

let bundles = 0

function generate(c: Case): Promise<HostResult> {
  return c.module.generate({
    config: {
      ...baseConfig,
      targets: [c.capabilities.target],
      ...c.config,
    } as UapaConfig,
    plans: [
      {
        target: c.capabilities.target,
        capabilities: c.capabilities,
        skills: [],
        checks: c.checks,
        commandHooks: c.commandHooks,
      },
    ],
    guard: c.withGuard === false ? null : GUARD,
    sharedWith: c.sharedWith ?? [],
    bundle: async () => {
      bundles += 1
      return 'BUNDLED\n'
    },
  })
}

function json(result: HostResult, path: string): unknown {
  assert.ok(result.ok)
  const content = result.files.find(f => f.path === path)?.content
  return content === undefined ? undefined : JSON.parse(content as string)
}

function paths(result: HostResult): string[] {
  assert.ok(result.ok)
  return result.files.map(f => f.path)
}

function risks(result: HostResult): string[] {
  assert.ok(result.ok)
  return result.residualRisks.map(r => r.message)
}

const handler = (command: string) => ({ type: 'command', command, timeout: 30 })

test('Claude Code：声明排在同一事件的守卫条目之后，{pluginRoot} 换为 CLAUDE_PLUGIN_ROOT 变量', async () => {
  const result = await generate({
    module: claudeCode,
    capabilities: claudeCodeSubprocess,
    checks: ['beforeTool'],
    commandHooks: [
      { event: 'PreToolUse', command: 'node {pluginRoot}/a.mjs' },
      { event: 'SessionEnd', command: 'echo end' },
      { event: 'PreToolUse', command: 'echo second' },
    ],
  })
  const entry = `node "\${CLAUDE_PLUGIN_ROOT}/hooks/uapa-claude-code.mjs" before-tool`
  assert.deepEqual(json(result, 'hooks/hooks.json'), {
    hooks: {
      PreToolUse: [
        { hooks: [handler(entry)] },
        { hooks: [handler(`node \${CLAUDE_PLUGIN_ROOT}/a.mjs`)] },
        { hooks: [handler('echo second')] },
      ],
      SessionEnd: [{ hooks: [handler('echo end')] }],
    },
  })
})

test('Codex：声明写入 hooksFile，{pluginRoot} 换为 PLUGIN_ROOT 变量；含 SessionEnd 时写残余风险', async () => {
  const result = await generate({
    module: codex,
    capabilities: codexSubprocess,
    checks: ['beforeStop'],
    commandHooks: [
      { event: 'Stop', command: 'node {pluginRoot}/stop.mjs' },
      { event: 'SessionEnd', command: 'echo end' },
    ],
    config: { hosts: { codex: { hooksFile: 'codex-hooks.json' } } },
  })
  const entry = `node "\${PLUGIN_ROOT}/hooks/uapa-codex.mjs" before-stop`
  assert.deepEqual(json(result, 'codex-hooks.json'), {
    hooks: {
      Stop: [
        { hooks: [handler(entry)] },
        { hooks: [handler(`node \${PLUGIN_ROOT}/stop.mjs`)] },
      ],
      SessionEnd: [{ hooks: [handler('echo end')] }],
    },
  })
  assert.equal(
    (json(result, '.codex-plugin/plugin.json') as { hooks: string }).hooks,
    './codex-hooks.json',
  )
  assert.ok(
    risks(result).includes(
      'Codex 的 SessionEnd 默认超时 1 秒、上限 3 秒：声明的 SessionEnd 命令运行超过 3 秒即被终止',
    ),
  )
})

test('agy：工具事件的元素为 { matcher: "", hooks }，其余为处理器；{pluginRoot} 换为 .；含 PreToolUse 时写残余风险', async () => {
  const result = await generate({
    module: agy,
    capabilities: agySubprocess,
    checks: ['beforeTool'],
    commandHooks: [
      { event: 'PreToolUse', command: 'node {pluginRoot}/pre.mjs' },
      { event: 'PostToolUse', command: 'echo post' },
      { event: 'SessionStart', command: 'echo start' },
    ],
  })
  const entry = 'node hooks/uapa-agy.mjs before-tool'
  assert.deepEqual(json(result, 'hooks.json'), {
    demo: {
      PreToolUse: [
        { matcher: '', hooks: [handler(entry)] },
        { matcher: '', hooks: [handler('node ./pre.mjs')] },
      ],
      PostToolUse: [{ matcher: '', hooks: [handler('echo post')] }],
      SessionStart: [handler('echo start')],
    },
  })
  assert.deepEqual(risks(result), [
    '声明的 PreToolUse 命令须在 stdout 输出含 decision 的 JSON，否则 agy 阻断每次工具调用',
  ])
})

test('未配置守卫时只生成 hooks 配置与指向它的字段，不生成入口、不打包', async () => {
  const commandHooks: CommandHookDecl[] = [{ event: 'Stop', command: 'echo stop' }]
  const before = bundles
  const claude = await generate({
    module: claudeCode,
    capabilities: claudeCodeSubprocess,
    checks: [],
    commandHooks,
    withGuard: false,
  })
  assert.deepEqual(paths(claude), ['.claude-plugin/plugin.json', 'hooks/hooks.json'])
  const codexResult = await generate({
    module: codex,
    capabilities: codexSubprocess,
    checks: [],
    commandHooks,
    withGuard: false,
  })
  assert.deepEqual(paths(codexResult), [
    '.codex-plugin/plugin.json',
    'hooks/hooks.json',
  ])
  assert.equal(
    (json(codexResult, '.codex-plugin/plugin.json') as { hooks: string }).hooks,
    './hooks/hooks.json',
  )
  const agyResult = await generate({
    module: agy,
    capabilities: agySubprocess,
    checks: [],
    commandHooks,
    withGuard: false,
  })
  assert.deepEqual(paths(agyResult), ['plugin.json', 'hooks.json'])
  assert.deepEqual(json(agyResult, 'hooks.json'), {
    demo: { Stop: [handler('echo stop')] },
  })
  assert.equal(bundles, before)
})

test('Codex 没有 hooks 而与其他宿主共用目录时，manifest 写内联的空 hooks，不读取默认文件', async () => {
  const shared = await generate({
    module: codex,
    capabilities: codexSubprocess,
    checks: [],
    commandHooks: [],
    sharedWith: ['claude-code'],
  })
  assert.deepEqual(paths(shared), ['.codex-plugin/plugin.json'])
  assert.deepEqual(
    (json(shared, '.codex-plugin/plugin.json') as { hooks: unknown }).hooks,
    { hooks: {} },
  )
  assert.deepEqual(risks(shared), [])
  const alone = await generate({
    module: codex,
    capabilities: codexSubprocess,
    checks: [],
    commandHooks: [],
  })
  assert.equal(
    (json(alone, '.codex-plugin/plugin.json') as { hooks?: unknown }).hooks,
    undefined,
  )
})

test('Codex 与 Claude Code 共用目录且 hooks 写在默认文件时，残余风险写明 Claude Code 也会加载', async () => {
  const shared = (config: Partial<UapaConfig>) =>
    generate({
      module: codex,
      capabilities: codexSubprocess,
      checks: ['beforeTool'],
      commandHooks: [],
      sharedWith: ['claude-code'],
      config,
    })
  const message =
    '与 Claude Code 共用插件目录时，Claude Code 也加载 hooks/hooks.json 并运行其中为 Codex ' +
    '生成的命令；设置 hosts.codex.hooksFile 改用独立的 hooks 文件'
  assert.ok(risks(await shared({})).includes(message))
  const separate = await shared({ hosts: { codex: { hooksFile: 'codex.json' } } })
  assert.ok(!risks(separate).includes(message))
})

test('agy 与 Claude Code 共用目录时，残余风险写明安装转换未实测（F-11-03）', async () => {
  const message =
    '与 Claude Code 共用插件目录：agy 的安装命令是否把含 .claude-plugin/ 的目录按 Claude Code ' +
    '插件转换未实测'
  const shared = await generate({
    module: agy,
    capabilities: agySubprocess,
    checks: [],
    commandHooks: [],
    sharedWith: ['claude-code', 'codex'],
  })
  assert.deepEqual(risks(shared), [message])
  const withCodex = await generate({
    module: agy,
    capabilities: agySubprocess,
    checks: [],
    commandHooks: [],
    sharedWith: ['codex'],
  })
  assert.deepEqual(risks(withCodex), [])
})
