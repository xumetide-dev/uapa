// Codex 宿主模块（codex:subprocess）。不实现 verify：Codex 没有校验插件的命令，由字段白名单
// 检查（F-06-05）在生成时代替。
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
import { MANIFEST, manifest, manifestErrors, NO_HOOKS } from './manifest.ts'

const TARGET = 'codex:subprocess'

// 信任状态未通过的非托管 hook 不注册、不告警（codex-plugins.md「源码核对」）
const TRUST_RISK =
  'Codex 只运行已信任的 hooks：安装后或 hooks 配置改动后须在 Codex 的 /hooks 中信任，' +
  '未信任的 hook 被静默跳过，守卫不生效'
const DIRECTORY_RISK = '含 hooks 的插件不能进入 Codex 的公开插件目录'
// 写入的 timeout 超过上限时按上限执行（codex-source-review.md「matcher、命令执行与超时」）
const SESSION_END_RISK =
  'Codex 的 SessionEnd 默认超时 1 秒、上限 3 秒：声明的 SessionEnd 命令运行超过 3 秒即被终止'
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

function hooksRisks(
  input: HostInput,
  plan: TargetPlan,
  hooksFile: string,
): TargetNote[] {
  const messages = [TRUST_RISK, DIRECTORY_RISK]
  if (plan.commandHooks.some(hook => hook.event === 'SessionEnd')) {
    messages.push(SESSION_END_RISK)
  }
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

export const codex: HostModule = {
  host: 'codex',
  async generate(input) {
    const hooksFile = hooksFileOf(input.config)
    const inputErrors = [...manifestErrors(input.config), ...hooksFileErrors(hooksFile)]
    if (inputErrors.length > 0) return failAll(input.plans, inputErrors)
    const plan = input.plans.find(p => p.target === TARGET)
    const guard = input.guard
    // 有守卫且 checks 非空时才生成入口；checks 与 commandHooks 都为空时不生成 hooks 配置
    const withEntry = plan !== undefined && plan.checks.length > 0 && guard !== null
    const hooks =
      plan === undefined ? null : hooksConfig(withEntry ? plan.checks : [], plan)
    const pluginManifest = manifest(
      input.config,
      manifestHooks(input, hooksFile, hooks),
    )
    const errors = fieldErrors(
      pluginManifest,
      hooks === null ? null : { file: hooksFile, value: hooks },
    )
    if (errors.length > 0) return failAll(input.plans, errors)
    const files: OutputFile[] = [{ path: MANIFEST, content: json(pluginManifest) }]
    if (plan === undefined || hooks === null)
      return { ok: true, files, residualRisks: [] }
    files.push({
      path: hooksFile,
      content: json(hooks),
      ...(hooksFile === DEFAULT_HOOKS_FILE
        ? { conflictHint: HOOKS_CONFLICT_HINT }
        : {}),
    })
    if (withEntry) files.push(await entryFile(input, plan, guard))
    return { ok: true, files, residualRisks: hooksRisks(input, plan, hooksFile) }
  },
}
