// 守卫选项在各宿主模块中的写法（F-05-17、F-05-18、F-06-10、F-11-10）：Claude Code 的
// userConfig 与 register.ts，三个宿主打包数据中的 options，Codex 与 agy 的残余风险
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BundleRequest } from '../../src/bundle/types.ts'
import { agySubprocess } from '../../src/capabilities/agy-subprocess.ts'
import { claudeCodeInProcess } from '../../src/capabilities/claude-code-in-process.ts'
import { claudeCodeSubprocess } from '../../src/capabilities/claude-code-subprocess.ts'
import { codexSubprocess } from '../../src/capabilities/codex-subprocess.ts'
import type { TargetName } from '../../src/config/targets.ts'
import type { UapaConfig } from '../../src/config/types.ts'
import type { GuardCheck } from '../../src/runtime/core/types.ts'
import type { GuardDeclaration } from '../../src/source/guard.ts'
import { agy } from '../../src/targets/agy/index.ts'
import { claudeCode } from '../../src/targets/claude-code/index.ts'
import { codex } from '../../src/targets/codex/index.ts'
import type { HostModule, HostResult, TargetPlan } from '../../src/targets/types.ts'
import { baseConfig } from '../helpers/project.ts'

const GUARD: GuardDeclaration = {
  modulePath: '/project/guard.ts',
  name: 'g',
  requires: [],
  checks: ['beforeTool'],
  options: [
    {
      name: 'label',
      type: 'string',
      title: '标签',
      description: '原因前缀',
      default: 'a',
    },
    {
      name: 'limit',
      type: 'number',
      title: '上限',
      description: '长度上限',
      default: 3,
    },
  ],
}

const RUNTIME_OPTIONS = [
  { name: 'label', type: 'string', default: 'a' },
  { name: 'limit', type: 'number', default: 3 },
]

const CAPABILITIES = {
  'claude-code:in-process': claudeCodeInProcess,
  'claude-code:subprocess': claudeCodeSubprocess,
  'codex:subprocess': codexSubprocess,
  'agy:subprocess': agySubprocess,
} as const

function plan(target: TargetName, checks: readonly GuardCheck[]): TargetPlan {
  return {
    target,
    capabilities: CAPABILITIES[target],
    skills: [],
    agents: [],
    mcpServers: [],
    rules: [],
    commands: [],
    checks,
    commandHooks: [],
  }
}

async function generate(
  host: HostModule,
  plans: readonly TargetPlan[],
  config: Partial<UapaConfig> = {},
): Promise<{ result: HostResult; requests: BundleRequest[] }> {
  const requests: BundleRequest[] = []
  const result = await host.generate({
    config: { ...baseConfig, name: 'demo', ...config } as UapaConfig,
    plans,
    guard: GUARD,
    sharedWith: [],
    bundle: async request => {
      requests.push(request)
      return 'BUNDLED\n'
    },
  })
  return { result, requests }
}

function fileOf(result: HostResult, path: string): string {
  assert.ok(result.ok)
  const found = result.files.find(file => file.path === path)
  assert.ok(found, path)
  return found.content as string
}

const BOTH = [
  plan('claude-code:subprocess', ['beforeTool']),
  plan('claude-code:in-process', ['beforeTool']),
]

const OWN = { token: { type: 'string', title: 't', description: 'd' } }

test('Claude Code：守卫选项按名称写在宿主选项 userConfig 之后，两个入口带取值所需的数据', async () => {
  const hosts = { 'claude-code': { userConfig: OWN } }
  const { result, requests } = await generate(claudeCode, BOTH, { hosts })
  const plugin = JSON.parse(fileOf(result, '.claude-plugin/plugin.json'))
  assert.deepEqual(Object.keys(plugin.userConfig), ['token', 'label', 'limit'])
  assert.deepEqual(plugin.userConfig.limit, {
    type: 'number',
    title: '上限',
    description: '长度上限',
    default: 3,
  })
  assert.deepEqual(
    requests.map(request => [request.entry, request.data.options]),
    [
      ['claude-code-subprocess', RUNTIME_OPTIONS],
      ['claude-code-in-process', RUNTIME_OPTIONS],
    ],
  )
  assert.equal(
    fileOf(result, 'hooks/register.ts'),
    "import type { Register } from 'claude-code'\n" +
      "import { register as guard } from './uapa-guard.mjs'\n\n" +
      'export const register: Register = (on, options) => guard(on, options)\n',
  )
})

test('Claude Code：没有要检查的事件时不写守卫选项，宿主选项 userConfig 原样写出', async () => {
  const plans = [plan('claude-code:subprocess', [])]
  for (const userConfig of [undefined, OWN, ['not-object']]) {
    const hosts = { 'claude-code': { userConfig } }
    const { result, requests } = await generate(claudeCode, plans, { hosts })
    const plugin = JSON.parse(fileOf(result, '.claude-plugin/plugin.json'))
    assert.deepEqual(plugin.userConfig, userConfig)
    assert.deepEqual(requests, [])
  }
})

test('Claude Code：宿主选项 userConfig 不是对象或与守卫选项全大写后重名时生成失败', async () => {
  const cases: [unknown, string][] = [
    [['token'], "hosts['claude-code'].userConfig 不是对象，不能写入守卫选项"],
    [
      { LIMIT: OWN.token },
      "hosts['claude-code'].userConfig 的 LIMIT 与守卫选项 limit 全大写后相同",
    ],
  ]
  for (const [userConfig, message] of cases) {
    const hosts = { 'claude-code': { userConfig } }
    const { result, requests } = await generate(claudeCode, BOTH, { hosts })
    assert.deepEqual(result, {
      ok: false,
      errors: [
        { target: 'claude-code:subprocess', message },
        { target: 'claude-code:in-process', message },
      ],
    })
    assert.deepEqual(requests, [])
  }
})

const OPTION_RISKS = {
  codex: 'Codex 没有插件用户配置，守卫选项取构建时默认值',
  agy: 'agy 没有已核实的插件用户配置，守卫选项取构建时默认值',
}

test('Codex 与 agy：入口带默认值，守卫有选项且 checks 非空时写残余风险', async () => {
  const hosts: [HostModule, TargetName, string][] = [
    [codex, 'codex:subprocess', OPTION_RISKS.codex],
    [agy, 'agy:subprocess', OPTION_RISKS.agy],
  ]
  for (const [host, target, risk] of hosts) {
    const checked = await generate(host, [plan(target, ['beforeTool'])])
    assert.ok(checked.result.ok)
    assert.ok(
      checked.result.residualRisks.some(r => r.message === risk),
      target,
    )
    assert.deepEqual(
      checked.requests.map(request => request.data.options),
      [RUNTIME_OPTIONS],
    )
    const unchecked = await generate(host, [plan(target, [])])
    assert.ok(unchecked.result.ok)
    assert.ok(
      unchecked.result.residualRisks.every(r => r.message !== risk),
      target,
    )
  }
})
