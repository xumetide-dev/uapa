// agy 宿主模块（agy:subprocess）。agy plugin validate 对结构错误也报通过，本宿主不实现
// verify，由字段白名单检查（F-11-05）在生成时代替。MCP 服务器写入 mcp_config.json（F-11-08），
// rules 写入 rules/（F-11-09）。commands 由构建编排原样复制，本模块只写残余风险（F-11-11）。
import { type GuardDeclaration, runtimeOptions } from '../../source/guard.ts'
import type {
  HostInput,
  HostModule,
  HostResult,
  OutputFile,
  TargetNote,
  TargetPlan,
} from '../types.ts'
import { fieldErrors } from './fields.ts'
import { HOOKS_FILE, hooksConfig, SUBPROCESS_ENTRY } from './hooks.ts'
import {
  MANIFEST,
  MANIFEST_CONFLICT_HINT,
  manifest,
  manifestErrors,
} from './manifest.ts'
import { MCP_FILE, mcpConfig } from './mcp.ts'
import { ruleFiles } from './rules.ts'

const TARGET = 'agy:subprocess'

// 停机计数目录取系统临时目录（SD-06），宿主没有插件数据目录变量
const STOP_COUNTER_RISK =
  '停机计数存放在系统临时目录下的 uapa-<插件名>/，该目录被清理时停机计数归零'
// PreToolUse 的 stdout 不是含 decision 的 JSON 时宿主阻断（agy-local-tests.md「本地实测」）
const PRE_TOOL_USE_RISK =
  '声明的 PreToolUse 命令须在 stdout 输出含 decision 的 JSON，否则 agy 阻断每次工具调用'
// F-11-03：共用目录时 .claude-plugin/ 与 agy 的文件同在插件根目录
const SHARED_CLAUDE_CODE_RISK =
  '与 Claude Code 共用插件目录：agy 的安装命令是否把含 .claude-plugin/ 的目录按 Claude Code ' +
  '插件转换未实测'

// 安装时把 commands/ 转换为技能（F-11-11；agy-local-tests.md「v0.4.0 覆盖审查（1.3.5，容器）」）
const COMMANDS_RISK =
  'agy 安装时把 commands 转换为技能，以 /<插件名>:<命令名> 调用；转换后的技能也会被模型按 ' +
  'description 自动选用'

// 未核实 agy 插件的用户配置（F-11-10）
const OPTIONS_RISK = 'agy 没有已核实的插件用户配置，守卫选项取构建时默认值'

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

// 子进程入口（F-11-04）
async function entryFile(
  input: HostInput,
  plan: TargetPlan,
  guard: GuardDeclaration,
): Promise<OutputFile> {
  const entry = await input.bundle({
    entry: 'agy-subprocess',
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

export const agy: HostModule = {
  host: 'agy',
  async generate(input) {
    const nameErrors = manifestErrors(input.config)
    if (nameErrors.length > 0) return failAll(input.plans, nameErrors)
    const plan = input.plans.find(p => p.target === TARGET)
    const guard = input.guard
    // 有守卫且 checks 非空时才生成入口；checks 与 commandHooks 都为空时不生成 hooks.json
    const withEntry = plan !== undefined && plan.checks.length > 0 && guard !== null
    const pluginManifest = manifest(input.config)
    const hooks =
      plan === undefined
        ? null
        : hooksConfig(input.config.name, withEntry ? plan.checks : [], plan)
    const mcp = mcpConfig(plan?.mcpServers ?? [])
    const errors = fieldErrors(pluginManifest, hooks, mcp.config)
    if (errors.length > 0) return failAll(input.plans, errors)
    const files: OutputFile[] = [
      {
        path: MANIFEST,
        content: json(pluginManifest),
        conflictHint: MANIFEST_CONFLICT_HINT,
      },
    ]
    if (hooks !== null) files.push({ path: HOOKS_FILE, content: json(hooks) })
    if (withEntry) files.push(await entryFile(input, plan, guard))
    if (mcp.config !== null) files.push({ path: MCP_FILE, content: json(mcp.config) })
    const rules = ruleFiles(plan?.rules ?? [])
    files.push(...rules.files)
    const residualRisks = plan === undefined ? [] : risks(input, plan, rules.risks)
    return { ok: true, files, skipped: mcp.skipped, residualRisks }
  },
}

function risks(
  input: HostInput,
  plan: TargetPlan,
  ruleRisks: readonly string[],
): TargetNote[] {
  const messages: string[] = []
  if (plan.checks.includes('beforeStop')) messages.push(STOP_COUNTER_RISK)
  if (plan.commandHooks.some(hook => hook.event === 'PreToolUse')) {
    messages.push(PRE_TOOL_USE_RISK)
  }
  if (input.sharedWith.includes('claude-code')) messages.push(SHARED_CLAUDE_CODE_RISK)
  const optionCount = input.guard?.options.length ?? 0
  if (plan.checks.length > 0 && optionCount > 0) messages.push(OPTIONS_RISK)
  messages.push(...ruleRisks)
  if (plan.commands.length > 0) messages.push(COMMANDS_RISK)
  return messages.map(message => ({ target: TARGET, message }))
}
