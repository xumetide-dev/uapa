// 测试用的最小子进程入口：协议的字段名与输出格式只为测试设定，不对应任何宿主。
// 工具入参中的命令字段为 cmd；数据目录为 TEST_DATA/<插件名>。
import { join } from 'node:path'
import { runSubprocessEntry } from '../../../src/runtime/entries/subprocess.ts'

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

await runSubprocessEntry({
  parse(check, stdin) {
    if (!isRecord(stdin) || typeof stdin.session !== 'string')
      throw new Error('session')
    const sessionId = stdin.session
    if (check === 'before-tool') {
      if (typeof stdin.tool !== 'string') throw new Error('tool')
      const input = isRecord(stdin.input) ? stdin.input : {}
      const command = typeof input.cmd === 'string' ? { command: input.cmd } : {}
      return { sessionId, tool: { name: stdin.tool, input, ...command } }
    }
    if (check === 'before-prompt') {
      if (typeof stdin.prompt !== 'string') throw new Error('prompt')
      return { sessionId, prompt: stdin.prompt }
    }
    return { sessionId }
  },
  skip(event, env) {
    return (
      __UAPA_MODULE_SESSION_ENV__ !== null &&
      env[__UAPA_MODULE_SESSION_ENV__] === event.sessionId
    )
  },
  allow: () => ({ exitCode: 0 }),
  deny: (_check, reason) => ({ exitCode: 2, stderr: `${reason}\n` }),
  rewriteShell: (input, command) => ({
    exitCode: 0,
    stdout: `${JSON.stringify({ ...input, cmd: command })}\n`,
  }),
  continueStop: reason => ({ exitCode: 0, stdout: `${JSON.stringify({ reason })}\n` }),
  dataDir: env =>
    env.TEST_DATA === undefined ? null : join(env.TEST_DATA, __UAPA_PLUGIN_NAME__),
})
