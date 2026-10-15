// claude-code:subprocess 的子进程入口（F-05-04）：只实现 Claude Code 的字段名与输出格式，
// 其余由公共部分 runSubprocessEntry 处理（入口与打包接口第 3 节）。
// 字段名与输出写法依据 Claude Code 本地实测记录「命令 hooks」（TA-15，2.1.296）：
// - stdin 的会话 id 为 session_id，工具名为 tool_name，工具入参为 tool_input，
//   Bash 的命令为 tool_input.command，提示文本为 prompt；
// - 退出码 2 并在 stderr 写原因时拒绝工具调用，或拦下提示且不调用模型；
// - 改写只需 hookSpecificOutput.updatedInput，不需 permissionDecision；updatedInput
//   整体替换入参，因此复制原入参后只换命令；
// - Stop 输出 decision: "block" 与 reason 时会话继续。
import { runSubprocessEntry } from './subprocess.js';
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
// 写入 stdout 的 JSON：不缩进，以一个换行结尾
function jsonLine(value) {
    return `${JSON.stringify(value)}\n`;
}
await runSubprocessEntry({
    parse(check, stdin) {
        if (!isRecord(stdin) || typeof stdin.session_id !== 'string') {
            throw new Error('session_id');
        }
        const sessionId = stdin.session_id;
        if (check === 'before-tool') {
            if (typeof stdin.tool_name !== 'string')
                throw new Error('tool_name');
            if (!isRecord(stdin.tool_input))
                throw new Error('tool_input');
            const input = stdin.tool_input;
            const command = typeof input.command === 'string' ? { command: input.command } : {};
            return { sessionId, tool: { name: stdin.tool_name, input, ...command } };
        }
        if (check === 'before-prompt') {
            if (typeof stdin.prompt !== 'string')
                throw new Error('prompt');
            return { sessionId, prompt: stdin.prompt };
        }
        return { sessionId };
    },
    // 去重变量（F-05-08）：hooks 模块已在本会话运行时，变量值等于 session_id
    skip(event, env) {
        return (__UAPA_MODULE_SESSION_ENV__ !== null &&
            env[__UAPA_MODULE_SESSION_ENV__] === event.sessionId);
    },
    allow: () => ({ exitCode: 0 }),
    deny: (_check, reason) => ({ exitCode: 2, stderr: `${reason}\n` }),
    rewriteShell: (input, command) => ({
        exitCode: 0,
        stdout: jsonLine({
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                updatedInput: { ...input, command },
            },
        }),
    }),
    continueStop: reason => ({
        exitCode: 0,
        stdout: jsonLine({ decision: 'block', reason }),
    }),
    dataDir(env) {
        const dir = env.CLAUDE_PLUGIN_DATA;
        return dir === undefined || dir === '' ? null : dir;
    },
});
