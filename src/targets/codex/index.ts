// Codex 宿主模块（codex:subprocess）。不实现 verify：Codex 没有校验插件的命令，由字段白名单
// 检查（F-06-05）在生成时代替。MCP 服务器写入 mcp.json（F-06-06）。
import type { GuardDeclaration } from '../../source/guard.ts'
import type {
  HostInput,
  HostModule,
  HostResult,
  OutputFile,
  TargetNote,
  TargetPlan,
} from '../types.ts'
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
import { MCP_FILE, mcpConfig } from './mcp.ts'

const TARGET = 'codex:subprocess'

// 信任状态未通过的非托管 hook 不注册、不告警（codex-plugins.md「源码核对」）
const TRUST_RISK =
  'Codex 只运行已信任的 hooks：安装后或 hooks 配置改动后须在 Codex 的 /hooks 中信任，' +
  '未信任的 hook 被静默跳过，守卫不生效'
const DIRECTORY_RISK = '含 hooks 的插件不能进入 Codex 的公开插件目录'
// 写入的 timeout 超过上限时按上限执行（codex-source-review.md「matcher、命令执行与超时」）
const SESSION_END_RISK =
  'Codex 的 SessionEnd 默认超时 1 秒、上限 3 秒：声明的 SessionEnd 命令运行超过 3 秒即被终止'
// 计划了执行后检查时（SD-29；codex-source-review.md「PostToolUse」）
const AFTER_TOOL_RISK =
  'Codex 只对执行成功的调用触发 PostToolUse：处理器报错与 MCP 结果 isError 为真的调用' +
  '不受执行后检查'
// 服务器名不加命名空间，重名时按配置名排序后先出现的生效，用户配置中的同名项覆盖插件的服务器
// （codex-source-review.md「插件中的 MCP 服务器」）
const MCP_NAME_RISK =
  'Codex 不为插件的 MCP 服务器名加命名空间：与用户配置或其他插件的服务器重名时，插件的服务器' +
  '可能不生效'
// Claude Code 按目录加载 hooks/hooks.json，不经 manifest 指定
const SHARED_HOOKS_RISK =
  '与 Claude Code 共用插件目录时，Claude Code 也加载 hooks/hooks.json 并运行其中为 Codex ' +
  `生成的命令；${HOOKS_CONFLICT_HINT}`

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
  const taken = [MANIFEST, SUBPROCESS_ENTRY].filter(path => path === hooksFile)
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

// manifest 的 mcpServers：生成了 mcp.json 时指向它；源项目有服务器而全部跳过、且与其他宿主
// 共用目录时写 NO_MCP_SERVERS，使 Codex 不读取 Claude Code 为这些服务器写出的 .mcp.json。
// 源项目没有服务器时其他宿主也不生成 MCP 配置，不写，v0.1.0 的产物保持不变
function manifestMcp(
  input: HostInput,
  plan: TargetPlan,
  config: Readonly<Record<string, unknown>> | null,
): string | typeof NO_MCP_SERVERS | null {
  if (config !== null) return `./${MCP_FILE}`
  const shadowed = plan.mcpServers.length > 0 && input.sharedWith.length > 0
  return shadowed ? NO_MCP_SERVERS : null
}

function hooksRisks(
  input: HostInput,
  plan: TargetPlan,
  hooksFile: string,
): TargetNote[] {
  const messages = [TRUST_RISK, DIRECTORY_RISK]
  if (plan.commandHooks.some(hook => hook.event === 'SessionEnd')) {
    messages.push(SESSION_END_RISK)
  }
  // 没有守卫时 checks 为空
  if (plan.checks.includes('afterTool')) messages.push(AFTER_TOOL_RISK)
  if (input.sharedWith.includes('claude-code') && hooksFile === DEFAULT_HOOKS_FILE) {
    messages.push(SHARED_HOOKS_RISK)
  }
  return messages.map(message => ({ target: TARGET, message }))
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
    },
    external: 'node',
  })
  return { path: SUBPROCESS_ENTRY, content: entry }
}

function mcpRisks(): TargetNote[] {
  return [{ target: TARGET, message: MCP_NAME_RISK }]
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

export const codex: HostModule = {
  host: 'codex',
  async generate(input) {
    const hooksFile = hooksFileOf(input.config)
    const inputErrors = [...manifestErrors(input.config), ...hooksFileErrors(hooksFile)]
    if (inputErrors.length > 0) return failAll(input.plans, inputErrors)
    const plan = input.plans.find(p => p.target === TARGET)
    if (plan === undefined) throw new Error(`plans 中没有 ${TARGET}`)
    const withEntry = plan.checks.length > 0 && input.guard !== null
    // checks 与 commandHooks 都为空时不生成 hooks 配置
    const hooks = hooksConfig(withEntry ? plan.checks : [], plan)
    const mcp = mcpConfig(plan.mcpServers)
    const pluginManifest = manifest(input.config, {
      hooks: manifestHooks(input, hooksFile, hooks),
      mcpServers: manifestMcp(input, plan, mcp.config),
    })
    const errors = fieldErrors(
      pluginManifest,
      hooks === null ? null : { file: hooksFile, value: hooks },
      mcp.config === null ? null : { file: MCP_FILE, value: mcp.config },
    )
    if (errors.length > 0) return failAll(input.plans, errors)
    const files: OutputFile[] = [
      { path: MANIFEST, content: json(pluginManifest) },
      ...(await hooksFiles(input, plan, hooksFile, hooks)),
      ...(mcp.config === null ? [] : [{ path: MCP_FILE, content: json(mcp.config) }]),
    ]
    const residualRisks = [
      ...(hooks === null ? [] : hooksRisks(input, plan, hooksFile)),
      ...(mcp.config === null ? [] : mcpRisks()),
    ]
    return { ok: true, files, skipped: mcp.skipped, residualRisks }
  },
}
