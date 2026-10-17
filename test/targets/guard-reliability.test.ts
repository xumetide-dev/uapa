// 守卫可靠性与残余风险（F-05-21～F-05-23、F-06-14、F-06-16、F-11-14，SD-43）：onFailure 只写在
// 执行前与提示提交前的守卫条目中，能力数据随配置改为拒绝；各宿主补全的残余风险与跳过项
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { agySubprocess } from '../../src/capabilities/agy-subprocess.ts'
import { claudeCodeInProcess } from '../../src/capabilities/claude-code-in-process.ts'
import { claudeCodeSubprocess } from '../../src/capabilities/claude-code-subprocess.ts'
import { codexSubprocess } from '../../src/capabilities/codex-subprocess.ts'
import { capabilitiesFor, targetCapabilities } from '../../src/capabilities/index.ts'
import type { TargetCapabilities } from '../../src/capabilities/types.ts'
import type { TargetName } from '../../src/config/targets.ts'
import type { CommandHookDecl, UapaConfig } from '../../src/config/types.ts'
import { canonicalToolName } from '../../src/runtime/core/tools.ts'
import type { GuardCheck } from '../../src/runtime/core/types.ts'
import type { GuardDeclaration } from '../../src/source/guard.ts'
import type { Agent, Rule, Skill } from '../../src/source/types.ts'
import { agy } from '../../src/targets/agy/index.ts'
import { claudeCode } from '../../src/targets/claude-code/index.ts'
import { codex } from '../../src/targets/codex/index.ts'
import type { HostModule, HostResult, TargetPlan } from '../../src/targets/types.ts'
import { baseConfig } from '../helpers/project.ts'

const GUARD: GuardDeclaration = {
  modulePath: '/project/guard.ts',
  name: 'fixture-guard',
  requires: [],
  checks: ['beforeTool', 'beforePrompt', 'beforeStop', 'afterTool'],
  options: [],
}
const BLOCK = { hosts: { 'claude-code': { onFailure: 'block' } } } as const

interface PlanParts {
  readonly checks?: readonly GuardCheck[]
  readonly commandHooks?: readonly CommandHookDecl[]
  readonly agents?: readonly Agent[]
  readonly skills?: readonly Skill[]
  readonly rules?: readonly Rule[]
}

function plan(
  target: TargetName,
  capabilities: TargetCapabilities,
  parts: PlanParts = {},
): TargetPlan {
  return {
    target,
    capabilities,
    skills: parts.skills ?? [],
    agents: parts.agents ?? [],
    mcpServers: [],
    rules: parts.rules ?? [],
    commands: [],
    checks: parts.checks ?? [],
    commandHooks: parts.commandHooks ?? [],
  }
}

function generate(
  host: HostModule,
  plans: readonly TargetPlan[],
  config: Partial<UapaConfig> = {},
): Promise<HostResult> {
  return host.generate({
    config: {
      ...baseConfig,
      ...config,
      targets: plans.map(p => p.target),
    } as UapaConfig,
    plans,
    guard: GUARD,
    sharedWith: [],
    bundle: async () => '',
  })
}

function messagesOf(result: HostResult, target: TargetName): string[] {
  assert.ok(result.ok)
  return result.residualRisks.filter(r => r.target === target).map(r => r.message)
}

function hooksOf(result: HostResult, path: string): Record<string, unknown[]> {
  assert.ok(result.ok)
  const file = result.files.find(f => f.path === path)
  assert.ok(file !== undefined, path)
  return JSON.parse(String(file.content)).hooks
}

const ALL: readonly GuardCheck[] = [
  'beforeTool',
  'beforePrompt',
  'beforeStop',
  'afterTool',
]
const SUBPROCESS = 'claude-code:subprocess'
const IN_PROCESS = 'claude-code:in-process'

test('onFailure 只写在 PreToolUse 与 UserPromptSubmit 的守卫条目中', async () => {
  const declared: CommandHookDecl = { event: 'PreToolUse', command: 'echo uapa-pre' }
  const result = await generate(
    claudeCode,
    [plan(SUBPROCESS, claudeCodeSubprocess, { checks: ALL, commandHooks: [declared] })],
    BLOCK,
  )
  const hooks = hooksOf(result, 'hooks/hooks.json')
  const handlers = (event: string) =>
    (hooks[event] as { hooks: Record<string, unknown>[] }[]).map(
      group => group.hooks[0],
    )
  assert.deepEqual(
    handlers('PreToolUse').map(h => h?.onFailure),
    ['block', undefined],
  )
  assert.deepEqual(Object.keys(handlers('PreToolUse')[0] ?? {}), [
    'type',
    'command',
    'timeout',
    'onFailure',
  ])
  assert.equal(handlers('UserPromptSubmit')[0]?.onFailure, 'block')
  assert.equal(handlers('Stop')[0]?.onFailure, undefined)
  assert.equal(handlers('PostToolUse')[0]?.onFailure, undefined)
  // 未配置时不写
  const plain = await generate(claudeCode, [
    plan(SUBPROCESS, claudeCodeSubprocess, { checks: ALL }),
  ])
  assert.ok(plain.ok)
  assert.ok(!plain.files.some(f => String(f.content).includes('onFailure')))
})

test('onFailure 的残余风险：只有命令形态、两种形态与只有 hooks 模块', async () => {
  const blocked =
    '运行宿主的机器缺少 Node ≥ 22 时，每次工具调用与提示都被阻断；' +
    'Claude Code 2.1.295 之前的版本对 onFailure 的处理未核实'
  const subprocessOnly = await generate(
    claudeCode,
    [
      plan(SUBPROCESS, claudeCodeSubprocess, {
        checks: ['beforeTool', 'beforePrompt'],
      }),
    ],
    BLOCK,
  )
  assert.equal(messagesOf(subprocessOnly, SUBPROCESS)[0], blocked)
  const both = await generate(
    claudeCode,
    [
      plan(IN_PROCESS, claudeCodeInProcess, { checks: ['beforeTool'] }),
      plan(SUBPROCESS, claudeCodeSubprocess, { checks: ['beforeTool'] }),
    ],
    BLOCK,
  )
  assert.deepEqual(messagesOf(both, SUBPROCESS).slice(0, 2), [
    '运行宿主的机器缺少 Node ≥ 22 时，每次工具调用都被阻断；' +
      'Claude Code 2.1.295 之前的版本对 onFailure 的处理未核实',
    '同时配置 claude-code:in-process 时，hooks 模块生效的会话中命令入口仍会运行（随后跳过），' +
      '缺少 Node ≥ 22 时同样被阻断',
  ])
  const inProcessOnly = await generate(
    claudeCode,
    [plan(IN_PROCESS, claudeCodeInProcess, { checks: ['beforeTool'] })],
    BLOCK,
  )
  assert.ok(
    messagesOf(inProcessOnly, IN_PROCESS).includes(
      'hosts.claude-code.onFailure 只作用于命令 hooks，只配置 claude-code:in-process 时不生效',
    ),
  )
})

test('capabilitiesFor：onFailure 为 block 时执行前与提示提交前检查出错按拒绝处理', () => {
  assert.equal(capabilitiesFor(baseConfig as UapaConfig), targetCapabilities)
  const blocked = capabilitiesFor({ ...baseConfig, ...BLOCK } as UapaConfig)
  const { failureDefault } = blocked[SUBPROCESS]
  assert.deepEqual(failureDefault.beforeTool, { error: 'deny', timeout: 'deny' })
  assert.deepEqual(failureDefault.beforePrompt, { error: 'deny', timeout: 'deny' })
  assert.deepEqual(
    failureDefault.beforeStop,
    claudeCodeSubprocess.failureDefault.beforeStop,
  )
  assert.equal(blocked[IN_PROCESS], claudeCodeInProcess)
})

test('Monitor 换为 shell，NotebookEdit 换为 edit_file（两个 Claude Code 目标）', () => {
  for (const capabilities of [claudeCodeSubprocess, claudeCodeInProcess]) {
    assert.equal(canonicalToolName('Monitor', capabilities.toolNames), 'shell')
    assert.equal(canonicalToolName('NotebookEdit', capabilities.toolNames), 'edit_file')
  }
})

const agent = (name: string, frontmatterKeys: readonly string[]): Agent => ({
  name,
  path: `agents/${name}.md`,
  frontmatterKeys,
  targets: null,
})

test('Claude Code：SessionEnd 的总预算、mod 与关闭 hooks 的情形、插件 agent 忽略的键', async () => {
  const result = await generate(claudeCode, [
    plan(SUBPROCESS, claudeCodeSubprocess, {
      checks: ['beforeTool'],
      commandHooks: [{ event: 'SessionEnd', command: 'echo uapa-end' }],
      agents: [
        agent('plain', ['name', 'description', 'tools']),
        agent('scoped', ['name', 'description', 'hooks', 'permissionMode', 'model']),
      ],
    }),
  ])
  assert.deepEqual(messagesOf(result, SUBPROCESS), [
    'Claude Code 的 SessionEnd hooks 共用 1.5 秒的总预算，插件 hooks 写的 timeout 不提高该预算',
    '用户安装的 mod 可以放行插件 hook 拒绝的工具调用',
    'disableAllHooks、--safe-mode、--bare 与托管设置（如 allowManagedHooksOnly）可使插件的 ' +
      'hooks 与 hooks 模块不运行，守卫不生效',
    'agent scoped 的 frontmatter 含 hooks、permissionMode：Claude Code 插件中的 agent 忽略这些键',
  ])
})

const skill = (name: string, files: readonly string[] = ['SKILL.md']): Skill => ({
  name,
  dir: `skills/${name}`,
  files,
  targets: null,
})

test('Codex：技能名超长列为跳过（含规则换算的技能），嵌套的 SKILL.md 写风险', async () => {
  const long = 'a'.repeat(65)
  const fits = 'b'.repeat(64)
  const result = await generate(
    codex,
    [
      plan('codex:subprocess', codexSubprocess, {
        skills: [
          skill(long),
          skill(fits),
          skill('nested', ['SKILL.md', 'extra/SKILL.md', '.hidden/SKILL.md']),
        ],
        rules: [
          {
            name: 'c'.repeat(70),
            path: `rules/${'c'.repeat(70)}.md`,
            activation: 'model',
            description: '设计 API 时',
            globs: [],
            body: '\n规则。\n',
            targets: null,
          },
        ],
      }),
    ],
    { name: 'p'.repeat(65) },
  )
  assert.ok(result.ok)
  assert.deepEqual(
    result.skipped.map(s => [s.component, s.reason]),
    [
      [`skills/${long}`, `技能名 ${long} 超过 64 个字符，Codex 不加载`],
      [`skills/${fits}`, `${'p'.repeat(65)}:${fits} 超过 129 个字符，Codex 不加载`],
      [
        `rules/${'c'.repeat(70)}.md`,
        `技能名 ${'c'.repeat(70)} 超过 64 个字符，Codex 不加载`,
      ],
    ],
  )
  assert.ok(!result.files.some(f => f.path.startsWith('skills/c')))
  assert.ok(
    messagesOf(result, 'codex:subprocess').includes(
      'skill nested 的目录中另有 extra/SKILL.md：Codex 把每个 SKILL.md 各注册为一个技能',
    ),
  )
})

test('Codex：没有守卫条目时信任风险不写守卫不生效；有 hooks 时写托管配置的风险', async () => {
  const result = await generate(codex, [
    plan('codex:subprocess', codexSubprocess, {
      commandHooks: [{ event: 'Stop', command: 'echo uapa-stop' }],
    }),
  ])
  assert.deepEqual(messagesOf(result, 'codex:subprocess').slice(0, 3), [
    'Codex 只运行已信任的 hooks：安装后或 hooks 配置改动后须在 Codex 的 /hooks 中信任，' +
      '未信任的 hook 被静默跳过',
    '含 hooks 的插件不能进入 Codex 的公开插件目录',
    'Codex 配置 allow_managed_hooks_only = true 或 [features].hooks = false 时，插件的 hooks ' +
      '不运行',
  ])
})

test('agy：agent 的 tools 与 model、rule 正文中的 @[ 引用', async () => {
  const result = await generate(agy, [
    plan('agy:subprocess', agySubprocess, {
      agents: [
        agent('runner', ['name', 'description', 'model', 'tools']),
        agent('plain', ['name', 'description']),
      ],
      rules: [
        {
          name: 'docs',
          path: 'rules/docs.md',
          activation: 'always',
          description: null,
          globs: [],
          body: '\n遵循 @[docs/style.md] 中的约定。\n',
          targets: null,
        },
      ],
    }),
  ])
  assert.deepEqual(messagesOf(result, 'agy:subprocess'), [
    'agent runner 的 frontmatter 含 model、tools：agy 按自身的工具名与模型名解释，' +
      '写错的工具名可能使子代理挂起',
    'rule docs 的正文以 @[…] 引用文件：被引用的文件须经 files/ 或 overrides/agy/ 提供，' +
      '规则的大小上限按展开后计算',
  ])
})
