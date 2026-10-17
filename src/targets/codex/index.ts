// Codex 宿主模块（codex:subprocess）。不实现 verify：Codex 没有校验插件的命令，由字段白名单
// 检查（F-06-05）在生成时代替。MCP 服务器写入 mcp.json（F-06-06）；rules 换算为技能与
// SessionStart 命令 hook（F-06-11）；commands 逐个检查转换条件（F-06-13）；技能名超长的 skill
// 列为跳过（F-06-16）。
import { type GuardDeclaration, runtimeOptions } from '../../source/guard.ts'
import type {
  HostInput,
  HostModule,
  HostResult,
  OutputFile,
  TargetPlan,
} from '../types.ts'
import { commandSkips } from './commands.ts'
import { fieldErrors } from './fields.ts'
import {
  DEFAULT_HOOKS_FILE,
  HOOKS_CONFLICT_HINT,
  hooksConfig,
  hooksFileOf,
  SUBPROCESS_ENTRY,
} from './hooks.ts'
import {
  MANIFEST,
  manifest,
  manifestErrors,
  NO_HOOKS,
  NO_MCP_SERVERS,
} from './manifest.ts'
import { marketplaceFiles } from './marketplace.ts'
import { MCP_FILE, mcpConfig } from './mcp.ts'
import { hooksRisks, mcpRisks, TARGET } from './risks.ts'
import { codexRules, RULES_ENTRY } from './rules.ts'
import { nestedSkillRisks, skillSkips } from './skills.ts'

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

// hooksFile 与本宿主的其他产物同路径时会互相覆盖
function hooksFileErrors(hooksFile: string): string[] {
  const taken = [MANIFEST, SUBPROCESS_ENTRY, RULES_ENTRY].filter(
    path => path === hooksFile,
  )
  return taken.map(path => `hosts.codex.hooksFile 与 Codex 产物 ${path} 同路径`)
}

// manifest 的 hooks：有 hooks 配置时指向它；没有而与其他宿主共用目录时写 NO_HOOKS，
// 使 Codex 不读取其他宿主写出的 hooks/hooks.json；默认布局中不写
function manifestHooks(
  input: HostInput,
  hooksFile: string,
  hooks: Readonly<Record<string, unknown>> | null,
): string | typeof NO_HOOKS | null {
  if (hooks !== null) return `./${hooksFile}`
  return input.sharedWith.length > 0 ? NO_HOOKS : null
}

// manifest 的 mcpServers：生成了 mcp.json 时指向它；源项目有服务器而本目标无写出服务器、且与其他宿主
// 共用目录时写 NO_MCP_SERVERS，使 Codex 不读取 Claude Code 为这些服务器写出的 .mcp.json。
// 源项目没有服务器时其他宿主也不生成 MCP 配置，不写，v0.1.0 的产物保持不变
function manifestMcp(
  input: HostInput,
  plan: TargetPlan,
  config: Readonly<Record<string, unknown>> | null,
): string | typeof NO_MCP_SERVERS | null {
  if (config !== null) return `./${MCP_FILE}`
  const hasMcp = plan.mcpServers.length > 0 || input.hasMcpServers === true
  const shadowed = hasMcp && input.sharedWith.length > 0
  return shadowed ? NO_MCP_SERVERS : null
}

// 子进程入口（F-06-04）
async function entryFile(
  input: HostInput,
  plan: TargetPlan,
  guard: GuardDeclaration,
): Promise<OutputFile> {
  const entry = await input.bundle({
    entry: 'codex-subprocess',
    guardModule: guard.modulePath,
    data: {
      pluginName: input.config.name,
      toolNames: plan.capabilities.toolNames,
      capabilities: plan.capabilities.capabilities,
      moduleSessionEnv: null,
      options: runtimeOptions(guard),
    },
    external: 'node',
  })
  return { path: SUBPROCESS_ENTRY, content: entry }
}

// hooks 配置与入口；hooks 为 null 时不写文件
async function hooksFiles(
  input: HostInput,
  plan: TargetPlan,
  hooksFile: string,
  hooks: Readonly<Record<string, unknown>> | null,
): Promise<OutputFile[]> {
  if (hooks === null) return []
  const files: OutputFile[] = [
    {
      path: hooksFile,
      content: json(hooks),
      ...(hooksFile === DEFAULT_HOOKS_FILE
        ? { conflictHint: HOOKS_CONFLICT_HINT }
        : {}),
    },
  ]
  // 有守卫且 checks 非空时才生成入口
  const guard = input.guard
  if (plan.checks.length > 0 && guard !== null) {
    files.push(await entryFile(input, plan, guard))
  }
  return files
}

function codexNotes(
  input: HostInput,
  plan: TargetPlan,
  hooksFile: string,
  hooks: Readonly<Record<string, unknown>> | null,
  mcp: ReturnType<typeof mcpConfig>,
  rules: ReturnType<typeof codexRules>,
) {
  const residualRisks = [
    ...(hooks === null ? [] : hooksRisks(input, plan, hooksFile)),
    ...(mcp.config === null ? [] : mcpRisks()),
    ...mcp.risks.map(message => ({ target: TARGET, message })),
    ...rules.risks.map(message => ({ target: TARGET, message })),
    ...nestedSkillRisks(plan.skills).map(message => ({ target: TARGET, message })),
  ]
  const skipped = [
    ...skillSkips(TARGET, input.config.name, plan.skills),
    ...mcp.skipped,
    ...rules.skipped,
    ...commandSkips(TARGET, plan.commands),
  ]
  return { skipped, residualRisks }
}

export const codex: HostModule = {
  host: 'codex',
  async generate(input) {
    const hooksFile = hooksFileOf(input.config)
    const inputErrors = [...manifestErrors(input.config), ...hooksFileErrors(hooksFile)]
    if (inputErrors.length > 0) return failAll(input.plans, inputErrors)
    const plan = input.plans.find(p => p.target === TARGET)
    if (plan === undefined) throw new Error(`plans 中没有 ${TARGET}`)
    const withEntry = plan.checks.length > 0 && input.guard !== null
    const rules = codexRules(plan, input.config.name)
    // checks、always 规则与 commandHooks 都没有时不生成 hooks 配置
    const hooks = hooksConfig(withEntry ? plan.checks : [], plan, rules.command)
    const mcp = mcpConfig(plan.mcpServers)
    const refs = {
      hooks: manifestHooks(input, hooksFile, hooks),
      mcpServers: manifestMcp(input, plan, mcp.config),
    }
    const pluginManifest = manifest(input.config, refs)
    const hooksEntry = hooks === null ? null : { file: hooksFile, value: hooks }
    const mcpEntry = mcp.config === null ? null : { file: MCP_FILE, value: mcp.config }
    const errors = fieldErrors(pluginManifest, hooksEntry, mcpEntry)
    if (errors.length > 0) return failAll(input.plans, errors)
    const files: OutputFile[] = [{ path: MANIFEST, content: json(pluginManifest) }]
    files.push(...(await hooksFiles(input, plan, hooksFile, hooks)))
    if (mcp.config !== null) files.push({ path: MCP_FILE, content: json(mcp.config) })
    files.push(...rules.files)
    const notes = codexNotes(input, plan, hooksFile, hooks, mcp, rules)
    const marketplaces = marketplaceFiles(input)
    const extra = marketplaces === undefined ? {} : { marketplaceFiles: marketplaces }
    return { ok: true, files, ...notes, ...extra }
  },
}
