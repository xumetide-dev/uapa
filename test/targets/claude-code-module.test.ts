// Claude Code 的 hooks 模块与两种形态合包（F-05-05、F-05-07、F-05-08、F-05-10）：
// 宿主模块生成的文件、打包请求与残余风险
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BundleRequest } from '../../src/bundle/types.ts'
import { claudeCodeInProcess } from '../../src/capabilities/claude-code-in-process.ts'
import { claudeCodeSubprocess } from '../../src/capabilities/claude-code-subprocess.ts'
import type { UapaConfig } from '../../src/config/types.ts'
import type { GuardCheck } from '../../src/runtime/core/types.ts'
import { claudeCode } from '../../src/targets/claude-code/index.ts'
import type { HostResult, TargetPlan } from '../../src/targets/types.ts'
import { baseConfig } from '../helpers/project.ts'

const ALL_CHECKS: GuardCheck[] = ['beforeTool', 'beforePrompt', 'beforeStop']

const GUARD = {
  modulePath: '/project/guard.ts',
  name: 'g',
  requires: [],
  checks: ALL_CHECKS,
}

function plan(target: TargetPlan['target'], checks: readonly GuardCheck[]): TargetPlan {
  const capabilities =
    target === 'claude-code:in-process' ? claudeCodeInProcess : claudeCodeSubprocess
  return {
    target,
    capabilities,
    skills: [],
    agents: [],
    mcpServers: [],
    checks,
    commandHooks: [],
  }
}

async function generate(
  plans: readonly TargetPlan[],
  guard: typeof GUARD | null = GUARD,
): Promise<{ result: HostResult; requests: BundleRequest[] }> {
  const requests: BundleRequest[] = []
  const result = await claudeCode.generate({
    config: { ...baseConfig, name: 'demo-plugin' } as UapaConfig,
    plans,
    guard,
    sharedWith: [],
    bundle: async request => {
      requests.push(request)
      return `BUNDLED ${request.entry}\n`
    },
  })
  return { result, requests }
}

function files(result: HostResult): Map<string, string> {
  assert.ok(result.ok)
  return new Map(result.files.map(f => [f.path, f.content as string]))
}

const REGISTER =
  "import type { Register } from 'claude-code'\n" +
  "import { register as guard } from './uapa-guard.mjs'\n\n" +
  'export const register: Register = on => guard(on)\n'

test('只配置 claude-code:in-process：hooks.json 只含 modules，打包请求只保留 claude-code 并带 checks', async () => {
  const { result, requests } = await generate([
    plan('claude-code:in-process', ['beforeTool']),
  ])
  const written = files(result)
  assert.deepEqual(
    [...written.keys()],
    [
      '.claude-plugin/plugin.json',
      'hooks/hooks.json',
      'hooks/register.ts',
      'hooks/uapa-guard.mjs',
    ],
  )
  assert.equal(
    written.get('hooks/hooks.json'),
    '{\n  "modules": [\n    "./register.ts"\n  ]\n}\n',
  )
  assert.equal(written.get('hooks/register.ts'), REGISTER)
  assert.equal(written.get('hooks/uapa-guard.mjs'), 'BUNDLED claude-code-in-process\n')
  assert.ok(!('types' in JSON.parse(written.get('.claude-plugin/plugin.json') ?? '')))
  assert.deepEqual(requests, [
    {
      entry: 'claude-code-in-process',
      guardModule: '/project/guard.ts',
      data: {
        pluginName: 'demo-plugin',
        toolNames: claudeCodeInProcess.toolNames,
        capabilities: claudeCodeInProcess.capabilities,
        moduleSessionEnv: null,
      },
      external: 'claude-code',
      checks: ['beforeTool'],
    },
  ])
  assert.ok(result.ok)
  assert.deepEqual(result.residualRisks, [
    {
      target: 'claude-code:in-process',
      message:
        'Claude Code 2.1.287 之前的版本不加载 hooks 模块，守卫不生效；' +
        '同时配置 claude-code:subprocess 可在这些版本上以命令 hooks 兜底',
    },
  ])
})

test('两个目标：一个插件包，hooks 键在 modules 键之前，两个入口都带去重变量名', async () => {
  const { result, requests } = await generate([
    plan('claude-code:in-process', ALL_CHECKS),
    plan('claude-code:subprocess', ALL_CHECKS),
  ])
  const written = files(result)
  assert.deepEqual([...written.keys()].sort(), [
    '.claude-plugin/plugin.json',
    'hooks/hooks.json',
    'hooks/register.ts',
    'hooks/uapa-claude-code.mjs',
    'hooks/uapa-guard.mjs',
    'types/index.d.ts',
  ])
  const hooks = JSON.parse(written.get('hooks/hooks.json') ?? '')
  assert.deepEqual(Object.keys(hooks), ['hooks', 'modules'])
  assert.deepEqual(Object.keys(hooks.hooks), ['PreToolUse', 'UserPromptSubmit', 'Stop'])
  assert.deepEqual(
    requests.map(r => [r.entry, r.data.moduleSessionEnv]),
    [
      ['claude-code-subprocess', 'UAPA_MODULE_SESSION_DEMO_PLUGIN'],
      ['claude-code-in-process', 'UAPA_MODULE_SESSION_DEMO_PLUGIN'],
    ],
  )
  assert.ok(result.ok)
  assert.deepEqual(result.residualRisks, [])
})

test('停机前检查进入计划时生成类型契约并在 plugin.json 写 types 字段（F-05-07）', async () => {
  const { result } = await generate([plan('claude-code:in-process', ['beforeStop'])])
  const written = files(result)
  assert.equal(
    written.get('types/index.d.ts'),
    "declare module 'claude-code' {\n" +
      '  interface PluginState {\n' +
      "    'demo-plugin': { uapaStopContinuations: number }\n" +
      '  }\n' +
      '}\n',
  )
  const manifest = JSON.parse(written.get('.claude-plugin/plugin.json') ?? '')
  assert.equal(Object.keys(manifest).at(-1), 'types')
  assert.equal(manifest.types, './types/index.d.ts')
})

test('没有守卫或没有要检查的事件时不生成 hooks 模块，也不记残余风险', async () => {
  for (const [checks, guard] of [
    [ALL_CHECKS, null],
    [[], GUARD],
  ] as const) {
    const { result, requests } = await generate(
      [plan('claude-code:in-process', checks)],
      guard,
    )
    assert.deepEqual([...files(result).keys()], ['.claude-plugin/plugin.json'])
    assert.deepEqual(requests, [])
    assert.ok(result.ok)
    assert.deepEqual(result.residualRisks, [])
  }
})

test('只有 claude-code:subprocess 时不写 modules 键，去重变量为 null', async () => {
  const { result, requests } = await generate([
    plan('claude-code:subprocess', ['beforeTool']),
  ])
  const hooks = JSON.parse(files(result).get('hooks/hooks.json') ?? '')
  assert.deepEqual(Object.keys(hooks), ['hooks'])
  assert.deepEqual(
    requests.map(r => r.data.moduleSessionEnv),
    [null],
  )
})
