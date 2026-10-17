// 命令 hooks 配置（F-05-03、F-05-13、F-05-15、F-05-19、F-05-21）：hooks/hooks.json 的 hooks 键按
// TargetPlan.checks 生成守卫条目，再写 always 规则的 SessionStart 条目，最后按
// TargetPlan.commandHooks 写入声明的命令；不写 matcher（省略时匹配全部工具，TA-15）；timeout 取
// 能力数据的 hookTimeoutSeconds，单位秒，为 null 时不写（hooks 适配第 7 节）。
// hosts['claude-code'].onFailure 为 'block' 时，执行前与提示提交前的守卫条目写 onFailure，
// 规则条目与声明的命令不写。
import type { CommandHookDecl, HostOptions } from '../../config/types.ts'
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

// 入口出错时可以阻断的检查（Claude Code 2.1.295 起，SD-43）
const BLOCKABLE: readonly GuardCheck[] = ['beforeTool', 'beforePrompt']

type OnFailure = HostOptions['claude-code']['onFailure']

function handler(command: string, timeout: number | null): Record<string, unknown> {
  return timeout === null
    ? { type: 'command', command }
    : { type: 'command', command, timeout }
}

// 守卫条目：每个检查一个事件，每个事件一个分组；onFailure 写在 timeout 之后
export function commandHooks(
  checks: readonly GuardCheck[],
  timeout: number | null,
  onFailure: OnFailure = undefined,
): Record<string, unknown[]> {
  const hooks: Record<string, unknown[]> = {}
  for (const check of checks) {
    const command = `node "${PLUGIN_ROOT}/${SUBPROCESS_ENTRY}" ${CHECK_ARGS[check]}`
    const entry = handler(command, timeout)
    if (onFailure !== undefined && BLOCKABLE.includes(check))
      entry.onFailure = onFailure
    hooks[EVENTS[check]] = [{ hooks: [entry] }]
  }
  return hooks
}

export interface HooksKeyOptions {
  readonly rulesCommand: string | null // always 规则的输出命令，没有时为 null
  readonly onFailure: OnFailure // hosts['claude-code'].onFailure
}

// guardChecks 为生成了入口的检查（没有守卫时为空），plan 为 claude-code:subprocess 的计划，
// 只配置 claude-code:in-process 时为 undefined。守卫条目在前，规则条目其次；每条声明一个分组，
// 按声明顺序排在同一事件的已有条目之后，去重（F-05-08）不作用于规则与声明的条目。都没有时为 null
export function hooksKey(
  guardChecks: readonly GuardCheck[],
  plan: TargetPlan | undefined,
  { rulesCommand, onFailure }: HooksKeyOptions,
): Record<string, unknown[]> | null {
  const timeout = plan?.capabilities.hookTimeoutSeconds ?? null
  const hooks = commandHooks(guardChecks, timeout, onFailure)
  if (rulesCommand !== null) {
    hooks.SessionStart = [{ hooks: [handler(rulesCommand, timeout)] }]
  }
  if (plan !== undefined) {
    for (const hook of plan.commandHooks) {
      const event = hostEvent(plan, hook)
      const command = hook.command.split('{pluginRoot}').join(PLUGIN_ROOT)
      const limit = hook.timeout ?? timeout
      hooks[event] = [...(hooks[event] ?? []), { hooks: [handler(command, limit)] }]
    }
  }
  return Object.keys(hooks).length === 0 ? null : hooks
}

function hostEvent(plan: TargetPlan, hook: CommandHookDecl): string {
  const event = plan.capabilities.commandHookEvents[hook.event]
  // 承载检查（F-03-15）只传入本目标承载的事件
  if (event === null) throw new Error(`${plan.target} 不承载 ${hook.event} 事件`)
  return event
}
