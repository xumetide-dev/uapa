// Claude Code 宿主模块。claude-code:subprocess 与 claude-code:in-process 写入同一插件目录，
// 合为一个插件包（F-05-10）：plugin.json 与 .mcp.json 只生成一份，hooks/hooks.json 按进入 plans
// 的目标写 hooks 键（命令 hooks）与 modules 键（hooks 模块）。rules 按两个目标的并集换算为
// 技能与 SessionStart 命令 hook（F-05-19）。
import { compare } from '../../source/files.ts'
import { type GuardDeclaration, runtimeOptions } from '../../source/guard.ts'
import type {
  HostInput,
  HostModule,
  HostResult,
  OutputFile,
  TargetPlan,
} from '../types.ts'
import { HOOKS_FILE, hooksKey, SUBPROCESS_ENTRY } from './hooks.ts'
import { manifest, manifestErrors, userConfig } from './manifest.ts'
import { marketplaceFiles } from './marketplace.ts'
import { MCP_FILE, mcpConfig } from './mcp.ts'
import { MODULES, type ModuleFiles, moduleFiles, moduleSessionEnv } from './module.ts'
import { claudeCodeRisks } from './risks.ts'
import { claudeCodeRules } from './rules.ts'
import { validatePlugin } from './verify.ts'

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

// 错误不属于单个目标时，为每个目标各返回一条相同的消息（模块接口 §5）
function failAll(
  plans: readonly TargetPlan[],
  messages: readonly string[],
): HostResult {
  const errors = plans.flatMap(plan =>
    messages.map(message => ({ target: plan.target, message })),
  )
  return { ok: false, errors }
}

interface SubprocessFiles {
  readonly hooks: Record<string, unknown[]> // hooks/hooks.json 的 hooks 键
  readonly files: readonly OutputFile[]
}

// 命令 hooks（F-05-03、F-05-15、F-05-19）与子进程入口（F-05-04）：plan 为 claude-code:subprocess
// 的计划，不在 plans 中时只写规则条目；checks 为空时不生成入口，没有任何条目时返回 null
async function subprocessFiles(
  input: HostInput,
  plan: TargetPlan | undefined,
  sessionEnv: string | null,
  rulesCommand: string | null,
): Promise<SubprocessFiles | null> {
  const guard = input.guard
  const checks = plan?.checks ?? []
  const withEntry = checks.length > 0 && guard !== null
  const onFailure = input.config.hosts?.['claude-code']?.onFailure
  const hooks = hooksKey(withEntry ? checks : [], plan, { rulesCommand, onFailure })
  if (hooks === null) return null
  if (!withEntry || plan === undefined) return { hooks, files: [] }
  return { hooks, files: [await entryFile(input, plan, guard, sessionEnv)] }
}

async function entryFile(
  input: HostInput,
  plan: TargetPlan,
  guard: GuardDeclaration,
  sessionEnv: string | null,
): Promise<OutputFile> {
  const entry = await input.bundle({
    entry: 'claude-code-subprocess',
    guardModule: guard.modulePath,
    data: {
      pluginName: input.config.name,
      toolNames: plan.capabilities.toolNames,
      capabilities: plan.capabilities.capabilities,
      moduleSessionEnv: sessionEnv,
      options: runtimeOptions(guard),
    },
    external: 'node',
  })
  return { path: SUBPROCESS_ENTRY, content: entry }
}

// 两种形态的键写入同一个 hooks/hooks.json，hooks 键在前；都没有时不生成该文件
function hooksConfigFile(
  command: SubprocessFiles | null,
  hooksModule: ModuleFiles | null,
): OutputFile[] {
  if (command === null && hooksModule === null) return []
  const content = {
    ...(command === null ? {} : { hooks: command.hooks }),
    ...(hooksModule === null ? {} : { modules: MODULES }),
  }
  return [{ path: HOOKS_FILE, content: json(content) }]
}

// 两个目标的服务器相同（MCP 服务器没有 targets）；取并集，按名称排序
function mcpFile(plans: readonly TargetPlan[]): OutputFile[] {
  const servers = new Map(plans.flatMap(plan => plan.mcpServers.map(s => [s.name, s])))
  const sorted = [...servers.values()].sort((a, b) => compare(a.name, b.name))
  const config = mcpConfig(sorted)
  return config === null ? [] : [{ path: MCP_FILE, content: json(config) }]
}

async function buildClaudeResult(
  input: HostInput,
  userConfigValue: unknown,
): Promise<HostResult> {
  const subprocess = input.plans.find(p => p.target === 'claude-code:subprocess')
  const inProcess = input.plans.find(p => p.target === 'claude-code:in-process')
  const sessionEnv =
    subprocess && inProcess ? moduleSessionEnv(input.config.name) : null
  const rules = claudeCodeRules(input.plans)
  const command = await subprocessFiles(input, subprocess, sessionEnv, rules.command)
  const hooksModule = inProcess ? await moduleFiles(input, inProcess, sessionEnv) : null
  const plugin = manifest(input.config, hooksModule?.types ?? null, userConfigValue)
  const files: OutputFile[] = [
    { path: '.claude-plugin/plugin.json', content: json(plugin) },
    ...hooksConfigFile(command, hooksModule),
    ...(command?.files ?? []),
    ...(hooksModule?.files ?? []),
    ...mcpFile(input.plans),
    ...rules.files,
  ]
  const residualRisks = [
    ...claudeCodeRisks(input, {
      subprocess,
      inProcess,
      moduleWritten: hooksModule !== null,
    }),
    ...rules.risks,
  ]
  const marketplaces = marketplaceFiles(input)
  return {
    ok: true,
    files,
    skipped: [],
    residualRisks,
    ...(marketplaces === undefined ? {} : { marketplaceFiles: marketplaces }),
  }
}

export const claudeCode: HostModule = {
  host: 'claude-code',
  async generate(input) {
    const errors = manifestErrors(input.config)
    if (errors.length > 0) return failAll(input.plans, errors)
    // 没有守卫时 checks 为空；有要检查的事件时守卫选项写入 userConfig（F-05-17）。
    // 在打包之前检查，生成失败时不打包
    const checked = input.plans.some(plan => plan.checks.length > 0)
    const config = userConfig(input.config, checked ? (input.guard?.options ?? []) : [])
    if (!config.ok) return failAll(input.plans, config.errors)
    return buildClaudeResult(input, config.value)
  },
  async verify(dir) {
    return validatePlugin(dir)
  },
}
