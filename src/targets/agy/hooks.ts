// 根 hooks.json（F-11-03）：顶层只有一个键，为插件名，其值按 TargetPlan.checks 写事件。
// PreToolUse 的元素为 { matcher, hooks }，matcher 为 "" 时匹配全部工具；Stop 的元素直接是
// 处理器。hook 以插件目录为工作目录，命令写相对路径（agy-plugins.md「本地实测」）。
import type { GuardCheck } from '../../runtime/core/types.ts'

export const HOOKS_FILE = 'hooks.json'
export const SUBPROCESS_ENTRY = 'hooks/uapa-agy.mjs'

// 入口的第一个参数（入口与打包接口第 2 节）
const CHECK_ARGS: Readonly<Record<GuardCheck, string>> = {
  beforeTool: 'before-tool',
  beforePrompt: 'before-prompt',
  beforeStop: 'before-stop',
}

// 处理器的键序固定为 type、command、timeout；timeout 为 null 时不写
function handler(check: GuardCheck, timeout: number | null): Record<string, unknown> {
  const command = `node ${SUBPROCESS_ENTRY} ${CHECK_ARGS[check]}`
  return timeout === null
    ? { type: 'command', command }
    : { type: 'command', command, timeout }
}

export function agyHooks(
  pluginName: string,
  checks: readonly GuardCheck[],
  timeout: number | null,
): Record<string, unknown> {
  const events: Record<string, unknown> = {}
  for (const check of checks) {
    if (check === 'beforeTool') {
      events.PreToolUse = [{ matcher: '', hooks: [handler(check, timeout)] }]
    } else if (check === 'beforeStop') {
      events.Stop = [handler(check, timeout)]
    } else {
      // 能力数据记 promptGate 为不支持，构建编排不会传入提示提交前检查
      throw new Error('agy 没有提示提交事件，不能生成 beforePrompt 的 hook')
    }
  }
  return { [pluginName]: events }
}
