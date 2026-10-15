// codex:subprocess 的子进程入口（F-06-04、F-06-07）：只实现 Codex 的字段名与输出格式，其余由公共部分
// runSubprocessEntry 处理（入口与打包接口第 3 节）。
// 字段名与输出写法依据 Codex「源码核对（rust-v0.162.1）」（TA-15）：
// - stdin 为 snake_case：会话 id 为 session_id，工具名为 tool_name，工具入参为 tool_input，
//   Bash 的命令为 tool_input.command（字符串），提示文本为 prompt；
// - 退出码 2 并在 stderr 写非空原因时拒绝工具调用，或拦下提示且不调用模型；stderr 为空的
//   退出码 2 记为 hook 失败并放行；
// - 改写须写 hookSpecificOutput 的 hookEventName、permissionDecision: "allow" 与 updatedInput；
//   Bash 只读回 updatedInput.command；输出 JSON 不得含宿主不认识的字段；
// - Stop 输出 decision: "block" 与 reason 时本轮继续；
// - PostToolUse 的 stdin 另有 tool_response；decision: "block" 与非空 reason 时以 reason
//   替换工具输出，只对执行成功的调用触发（源码核对「PostToolUse」）。
import type { HostTool } from '../core/tools.ts'
import { runSubprocessEntry } from './subprocess.ts'

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// 写入 stdout 的 JSON：不缩进，以一个换行结尾
function jsonLine(value: unknown): string {
  return `${JSON.stringify(value)}\n`
}

function hostTool(stdin: Readonly<Record<string, unknown>>): HostTool {
  if (typeof stdin.tool_name !== 'string') throw new Error('tool_name')
  if (!isRecord(stdin.tool_input)) throw new Error('tool_input')
  const input = stdin.tool_input
  const command = typeof input.command === 'string' ? { command: input.command } : {}
  return { name: stdin.tool_name, input, ...command }
}

await runSubprocessEntry({
  parse(check, stdin) {
    if (!isRecord(stdin) || typeof stdin.session_id !== 'string') {
      throw new Error('session_id')
    }
    const sessionId = stdin.session_id
    if (check === 'before-tool') return { sessionId, tool: hostTool(stdin) }
    if (check === 'after-tool') {
      const tool = hostTool(stdin)
      // 值可为任意 JSON，按形状取文本（入口与打包接口第 4 节）
      if (!Object.hasOwn(stdin, 'tool_response')) throw new Error('tool_response')
      return { sessionId, tool, toolOutput: stdin.tool_response }
    }
    if (check === 'before-prompt') {
      if (typeof stdin.prompt !== 'string') throw new Error('prompt')
      return { sessionId, prompt: stdin.prompt }
    }
    return { sessionId }
  },
  allow: () => ({ exitCode: 0 }),
  deny: (_check, reason) => ({ exitCode: 2, stderr: `${reason}\n` }),
  rewriteShell: (input, command) => ({
    exitCode: 0,
    stdout: jsonLine({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        updatedInput: { ...input, command },
      },
    }),
  }),
  continueStop: reason => ({
    exitCode: 0,
    stdout: jsonLine({ decision: 'block', reason }),
  }),
  // 宿主以 reason 替换工具输出；没有替换为任意文本的字段，不实现 replaceOutput
  blockOutput: text => ({
    exitCode: 0,
    stdout: jsonLine({ decision: 'block', reason: text }),
  }),
  // 插件数据目录（PLUGIN_DATA）；宿主不预先创建，公共部分按需创建
  dataDir(env) {
    const dir = env.PLUGIN_DATA
    return dir === undefined || dir === '' ? null : dir
  },
})
