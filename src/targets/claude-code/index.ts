// Claude Code 宿主模块。claude-code:subprocess 与 claude-code:in-process（F-05-14 起）
// 写入同一插件目录。
import type { GuardDeclaration } from '../../source/guard.ts'
import type {
  HostInput,
  HostModule,
  HostResult,
  OutputFile,
  TargetPlan,
} from '../types.ts'
import { HOOKS_FILE, hooksKey, SUBPROCESS_ENTRY } from './hooks.ts'
import { manifest, manifestErrors } from './manifest.ts'
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

// claude-code:subprocess 的 hooks 配置（F-05-03、F-05-15）与子进程入口（F-05-04）：checks 为空时
// 不生成入口，checks 与 commandHooks 都为空时也不生成 hooks 配置
async function subprocessFiles(
  input: HostInput,
  plan: TargetPlan,
): Promise<OutputFile[]> {
  const guard = input.guard
  const withEntry = plan.checks.length > 0 && guard !== null
  const hooks = hooksKey(withEntry ? plan.checks : [], plan)
  if (hooks === null) return []
  const files: OutputFile[] = [{ path: HOOKS_FILE, content: json({ hooks }) }]
  if (withEntry) files.push(await entryFile(input, plan, guard))
  return files
}

async function entryFile(
  input: HostInput,
  plan: TargetPlan,
  guard: GuardDeclaration,
): Promise<OutputFile> {
  const entry = await input.bundle({
    entry: 'claude-code-subprocess',
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

export const claudeCode: HostModule = {
  host: 'claude-code',
  async generate(input) {
    const errors = manifestErrors(input.config)
    if (errors.length > 0) return failAll(input.plans, errors)
    const files: OutputFile[] = [
      { path: '.claude-plugin/plugin.json', content: json(manifest(input.config)) },
    ]
    const subprocess = input.plans.find(
      plan => plan.target === 'claude-code:subprocess',
    )
    if (subprocess !== undefined)
      files.push(...(await subprocessFiles(input, subprocess)))
    return { ok: true, files, residualRisks: [] }
  },
  async verify(dir) {
    return validatePlugin(dir)
  },
}
