// hooks 配置（F-06-03、F-06-07、F-06-08、F-06-11、F-06-14）：结构为 { hooks: { <事件>: [{ hooks: [<处理器>] }] } }，与
// Claude Code 相同；不写 matcher（省略时匹配全部工具）；timeout 单位秒。命令中的 ${PLUGIN_ROOT}
// 由 Codex 在交给 shell 之前替换为插件目录，各平台的 shell 都能执行。依据 codex-plugins.md
// 「源码核对（rust-v0.162.1）」。
import type { CommandHookDecl, UapaConfig } from '../../config/types.ts'
import type { GuardCheck } from '../../runtime/core/types.ts'
import type { TargetPlan } from '../types.ts'

export const DEFAULT_HOOKS_FILE = 'hooks/hooks.json'
export const SUBPROCESS_ENTRY = 'hooks/uapa-codex.mjs'

// 未设 hosts.codex.hooksFile 时附在 hooks/hooks.json 的冲突错误之后（SD-07）
export const HOOKS_CONFLICT_HINT = '设置 hosts.codex.hooksFile 改用独立的 hooks 文件'

// 守卫条目与声明中 {pluginRoot} 的替换（command-hooks.md 第 3 节）
const PLUGIN_ROOT = `\${PLUGIN_ROOT}`

// 宿主把更大的 SessionEnd 超时压到 3 秒，并在每次会话开始告警（rust-v0.162.1
// hooks/src/engine/discovery.rs，codex-source-review.md「matcher、命令执行与超时」）
const SESSION_END_TIMEOUT_SECONDS = 3

const EVENTS: Readonly<Record<GuardCheck, string>> = {
  beforeTool: 'PreToolUse',
  beforePrompt: 'UserPromptSubmit',
  beforeStop: 'Stop',
  afterTool: 'PostToolUse', // 不写 matcher，覆盖全部工具（SD-29）
}

// 入口的第一个参数（入口与打包接口第 2 节）
const CHECK_ARGS: Readonly<Record<GuardCheck, string>> = {
  beforeTool: 'before-tool',
  beforePrompt: 'before-prompt',
  beforeStop: 'before-stop',
  afterTool: 'after-tool',
}

// hooks 配置相对插件目录的路径，不以 ./ 开头；hooksFile 已由配置校验限定在插件目录内
export function hooksFileOf(config: UapaConfig): string {
  const configured = config.hosts?.codex?.hooksFile
  if (configured === undefined) return DEFAULT_HOOKS_FILE
  return configured.startsWith('./') ? configured.slice(2) : configured
}

function handler(command: string, timeout: number | null): Record<string, unknown> {
  return timeout === null
    ? { type: 'command', command }
    : { type: 'command', command, timeout }
}

// 守卫条目：每个检查一个事件，每个事件一个分组
export function codexHooks(
  checks: readonly GuardCheck[],
  timeout: number | null,
): { hooks: Record<string, unknown[]> } {
  const events: Record<string, unknown[]> = {}
  for (const check of checks) {
    const command = `node "${PLUGIN_ROOT}/${SUBPROCESS_ENTRY}" ${CHECK_ARGS[check]}`
    events[EVENTS[check]] = [{ hooks: [handler(command, timeout)] }]
  }
  return { hooks: events }
}

// guardChecks 为生成了入口的检查（没有守卫时为空）；rulesCommand 为 always 规则的输出命令，没有
// 时为 null。守卫条目在前，规则条目其次；每条声明一个分组，按声明顺序排在同一事件的已有条目
// 之后（F-06-08）。都没有时为 null
export function hooksConfig(
  guardChecks: readonly GuardCheck[],
  plan: TargetPlan,
  rulesCommand: string | null,
): { hooks: Record<string, unknown[]> } | null {
  const timeout = plan.capabilities.hookTimeoutSeconds
  const { hooks } = codexHooks(guardChecks, timeout)
  if (rulesCommand !== null) {
    hooks.SessionStart = [{ hooks: [handler(rulesCommand, timeout)] }]
  }
  for (const hook of plan.commandHooks) {
    const event = hostEvent(plan, hook)
    const command = hook.command.split('{pluginRoot}').join(PLUGIN_ROOT)
    const requested = hook.timeout ?? timeout
    const limit =
      hook.event === 'SessionEnd'
        ? Math.min(
            requested ?? SESSION_END_TIMEOUT_SECONDS,
            SESSION_END_TIMEOUT_SECONDS,
          )
        : requested
    hooks[event] = [...(hooks[event] ?? []), { hooks: [handler(command, limit)] }]
  }
  return Object.keys(hooks).length === 0 ? null : { hooks }
}

function hostEvent(plan: TargetPlan, hook: CommandHookDecl): string {
  const event = plan.capabilities.commandHookEvents[hook.event]
  // 承载检查（F-03-15）只传入本目标承载的事件
  if (event === null) throw new Error(`${plan.target} 不承载 ${hook.event} 事件`)
  return event
}
