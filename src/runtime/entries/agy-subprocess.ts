// agy:subprocess 的子进程入口（F-11-04）：只实现 agy 的字段名与输出格式，其余由公共部分
// runSubprocessEntry 处理（入口与打包接口第 3 节）。
// 字段名与输出写法依据 agy「本地实测」（1.3.4）：
// - stdin 为 camelCase：会话 id 为 conversationId，工具名为 toolCall.name，工具入参为
//   toolCall.args，run_command 的命令为 toolCall.args.CommandLine；
// - PreToolUse 的 stdout 不是含 decision 的 JSON 时宿主阻断，因此执行前检查的放行也要输出
//   {"decision":"allow"}；拒绝以退出码 0 输出 decision: "deny" 与 reason；
// - 改写的 overwrite 按键浅合并进 toolCall.args，只写命令字段；
// - Stop 输出 decision: "continue" 与 reason 时会话继续，放行输出 {}。
// 宿主没有插件数据目录变量，停机计数放在系统临时目录下（SD-06）；本入口不读取任何宿主的
// 环境变量。
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runSubprocessEntry } from './subprocess.ts'

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// 写入 stdout 的 JSON：不缩进，以一个换行结尾
function jsonLine(value: unknown): string {
  return `${JSON.stringify(value)}\n`
}

await runSubprocessEntry({
  parse(check, stdin) {
    if (!isRecord(stdin) || typeof stdin.conversationId !== 'string') {
      throw new Error('conversationId')
    }
    const sessionId = stdin.conversationId
    const paths = stdin.workspacePaths
    const first = Array.isArray(paths) ? paths[0] : undefined
    const cwd = typeof first === 'string' && first !== '' ? first : null
    if (check !== 'before-tool') return { sessionId, cwd }
    const call = stdin.toolCall
    if (!isRecord(call)) throw new Error('toolCall')
    if (typeof call.name !== 'string') throw new Error('toolCall.name')
    if (!isRecord(call.args)) throw new Error('toolCall.args')
    const input = call.args
    const command =
      typeof input.CommandLine === 'string' ? { command: input.CommandLine } : {}
    return { sessionId, cwd, tool: { name: call.name, input, ...command } }
  },
  allow: check => ({
    exitCode: 0,
    stdout: jsonLine(check === 'before-tool' ? { decision: 'allow' } : {}),
  }),
  deny: (_check, reason) => ({
    exitCode: 0,
    stdout: jsonLine({ decision: 'deny', reason }),
  }),
  rewriteShell: (_input, command) => ({
    exitCode: 0,
    stdout: jsonLine({ decision: 'allow', overwrite: { CommandLine: command } }),
  }),
  continueStop: reason => ({
    exitCode: 0,
    stdout: jsonLine({ decision: 'continue', reason }),
  }),
  dataDir: () => join(tmpdir(), `uapa-${encodeURIComponent(__UAPA_PLUGIN_NAME__)}`),
})
