// agy 宿主模块（agy:subprocess）。agy plugin validate 对结构错误也报通过，本宿主不实现
// verify，由字段白名单检查（F-11-05）在生成时代替。
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
import { agyHooks, HOOKS_FILE, SUBPROCESS_ENTRY } from './hooks.ts'
import {
  MANIFEST,
  MANIFEST_CONFLICT_HINT,
  manifest,
  manifestErrors,
} from './manifest.ts'

const TARGET = 'agy:subprocess'

// 停机计数目录取系统临时目录（SD-06），宿主没有插件数据目录变量
const STOP_COUNTER_RISK =
  '停机计数存放在系统临时目录下的 uapa-<插件名>/，该目录被清理时停机计数归零'

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
    // 有守卫且 checks 非空时才生成 hooks.json 与入口
    const withHooks = plan !== undefined && plan.checks.length > 0 && guard !== null
    const pluginManifest = manifest(input.config)
    const hooks = withHooks
      ? agyHooks(input.config.name, plan.checks, plan.capabilities.hookTimeoutSeconds)
      : null
    const errors = fieldErrors(pluginManifest, hooks)
    if (errors.length > 0) return failAll(input.plans, errors)
    const files: OutputFile[] = [
      {
        path: MANIFEST,
        content: json(pluginManifest),
        conflictHint: MANIFEST_CONFLICT_HINT,
      },
    ]
    const residualRisks: TargetNote[] = []
    if (withHooks) {
      files.push({ path: HOOKS_FILE, content: json(hooks) })
      files.push(await entryFile(input, plan, guard))
      if (plan.checks.includes('beforeStop')) {
        residualRisks.push({ target: TARGET, message: STOP_COUNTER_RISK })
      }
    }
    return { ok: true, files, residualRisks }
  },
}
