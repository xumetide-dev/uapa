// 命令 hooks 配置（F-05-03）：hooks/hooks.json 的 hooks 键按 TargetPlan.checks 生成条目，
// 不写 matcher（省略时匹配全部工具，TA-15）；timeout 取能力数据的 hookTimeoutSeconds，单位秒，
// 为 null 时不写（hooks 适配第 7 节）。
import type { GuardCheck } from '../../runtime/core/types.ts'

export const SUBPROCESS_ENTRY = 'hooks/uapa-claude-code.mjs'

const EVENTS: Readonly<Record<GuardCheck, string>> = {
  beforeTool: 'PreToolUse',
  beforePrompt: 'UserPromptSubmit',
  beforeStop: 'Stop',
}

// 入口的第一个参数（入口与打包接口第 2 节）
const CHECK_ARGS: Readonly<Record<GuardCheck, string>> = {
  beforeTool: 'before-tool',
  beforePrompt: 'before-prompt',
  beforeStop: 'before-stop',
}

export function commandHooks(
  checks: readonly GuardCheck[],
  timeout: number | null,
): Record<string, unknown> {
  const hooks: Record<string, unknown> = {}
  for (const check of checks) {
    const command = `node "\${CLAUDE_PLUGIN_ROOT}/${SUBPROCESS_ENTRY}" ${CHECK_ARGS[check]}`
    const entry =
      timeout === null
        ? { type: 'command', command }
        : { type: 'command', command, timeout }
    hooks[EVENTS[check]] = [{ hooks: [entry] }]
  }
  return hooks
}
