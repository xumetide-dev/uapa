// Claude Code 宿主模块。claude-code:subprocess 与 claude-code:in-process 写入同一插件目录，
// 合为一个插件包（F-05-10）：plugin.json 只生成一份，hooks/hooks.json 按进入 plans 的目标
// 写 hooks 键（命令 hooks）与 modules 键（hooks 模块）。
import type { GuardDeclaration } from '../../source/guard.ts'
import type {
  HostInput,
  HostModule,
  HostResult,
  OutputFile,
  TargetNote,
  TargetPlan,
} from '../types.ts'
import { HOOKS_FILE, hooksKey, SUBPROCESS_ENTRY } from './hooks.ts'
import { manifest, manifestErrors } from './manifest.ts'
import { MODULES, type ModuleFiles, moduleFiles, moduleSessionEnv } from './module.ts'
import { validatePlugin } from './verify.ts'

// 插件包中只有 hooks 模块时（F-05-10）
const MODULE_ONLY_RISK =
  'Claude Code 2.1.287 之前的版本不加载 hooks 模块，守卫不生效；' +
  '同时配置 claude-code:subprocess 可在这些版本上以命令 hooks 兜底'

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

// claude-code:subprocess 的命令 hooks（F-05-03、F-05-15）与子进程入口（F-05-04）：checks 为空时
// 不生成入口，checks 与 commandHooks 都为空时返回 null
async function subprocessFiles(
  input: HostInput,
  plan: TargetPlan,
  sessionEnv: string | null,
): Promise<SubprocessFiles | null> {
  const guard = input.guard
  const withEntry = plan.checks.length > 0 && guard !== null
  const hooks = hooksKey(withEntry ? plan.checks : [], plan)
  if (hooks === null) return null
  const files = withEntry ? [await entryFile(input, plan, guard, sessionEnv)] : []
  return { hooks, files }
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

export const claudeCode: HostModule = {
  host: 'claude-code',
  async generate(input) {
    const errors = manifestErrors(input.config)
    if (errors.length > 0) return failAll(input.plans, errors)
    const subprocess = input.plans.find(p => p.target === 'claude-code:subprocess')
    const inProcess = input.plans.find(p => p.target === 'claude-code:in-process')
    // 两个目标都进入 plans 时按会话 id 去重（F-05-08）
    const sessionEnv =
      subprocess !== undefined && inProcess !== undefined
        ? moduleSessionEnv(input.config.name)
        : null
    const command =
      subprocess === undefined
        ? null
        : await subprocessFiles(input, subprocess, sessionEnv)
    const hooksModule =
      inProcess === undefined ? null : await moduleFiles(input, inProcess, sessionEnv)
    const plugin = manifest(input.config, hooksModule?.types ?? null)
    const files: OutputFile[] = [
      { path: '.claude-plugin/plugin.json', content: json(plugin) },
      ...hooksConfigFile(command, hooksModule),
      ...(command?.files ?? []),
      ...(hooksModule?.files ?? []),
    ]
    const residualRisks: TargetNote[] =
      hooksModule !== null && subprocess === undefined
        ? [{ target: 'claude-code:in-process', message: MODULE_ONLY_RISK }]
        : []
    return { ok: true, files, residualRisks }
  },
  async verify(dir) {
    return validatePlugin(dir)
  },
}
