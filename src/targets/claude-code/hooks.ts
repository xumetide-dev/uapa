// 命令 hooks 配置（F-05-03、F-05-13、F-05-15）：hooks/hooks.json 的 hooks 键按 TargetPlan.checks
// 生成守卫条目，再按 TargetPlan.commandHooks 写入声明的命令；不写 matcher（省略时匹配全部
// 工具，TA-15）；timeout 取能力数据的 hookTimeoutSeconds，单位秒，为 null 时不写（hooks 适配
// 第 7 节）。
import type { CommandHookDecl } from '../../config/types.ts'
import type { GuardCheck } from '../../runtime/core/types.ts'
import type { TargetPlan } from '../types.ts'

export const HOOKS_FILE = 'hooks/hooks.json'
export const SUBPROCESS_ENTRY = 'hooks/uapa-claude-code.mjs'

// 声明中 {pluginRoot} 的替换（command-hooks.md 第 3 节）
const PLUGIN_ROOT = `\${CLAUDE_PLUGIN_ROOT}`

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

function handler(command: string, timeout: number | null): Record<string, unknown> {
  return timeout === null
    ? { type: 'command', command }
    : { type: 'command', command, timeout }
}

// 守卫条目：每个检查一个事件，每个事件一个分组
export function commandHooks(
  checks: readonly GuardCheck[],
  timeout: number | null,
): Record<string, unknown[]> {
  const hooks: Record<string, unknown[]> = {}
  for (const check of checks) {
    const command = `node "${PLUGIN_ROOT}/${SUBPROCESS_ENTRY}" ${CHECK_ARGS[check]}`
    hooks[EVENTS[check]] = [{ hooks: [handler(command, timeout)] }]
  }
  return hooks
}

// guardChecks 为生成了入口的检查（没有守卫时为空）。守卫条目在前；每条声明一个分组，按声明顺序
// 排在同一事件的守卫条目之后，去重（F-05-08）不作用于这些条目。两者都没有时为 null
export function hooksKey(
  guardChecks: readonly GuardCheck[],
  plan: TargetPlan,
): Record<string, unknown[]> | null {
  const timeout = plan.capabilities.hookTimeoutSeconds
  const hooks = commandHooks(guardChecks, timeout)
  for (const hook of plan.commandHooks) {
    const event = hostEvent(plan, hook)
    const command = hook.command.split('{pluginRoot}').join(PLUGIN_ROOT)
    hooks[event] = [...(hooks[event] ?? []), { hooks: [handler(command, timeout)] }]
  }
  return Object.keys(hooks).length === 0 ? null : hooks
}

function hostEvent(plan: TargetPlan, hook: CommandHookDecl): string {
  const event = plan.capabilities.commandHookEvents[hook.event]
  // 承载检查（F-03-15）只传入本目标承载的事件
  if (event === null) throw new Error(`${plan.target} 不承载 ${hook.event} 事件`)
  return event
}
