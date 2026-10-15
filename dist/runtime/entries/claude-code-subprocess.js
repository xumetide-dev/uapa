import { runSubprocessEntry } from './subprocess.js';
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
// 写入 stdout 的 JSON：不缩进，以一个换行结尾
function jsonLine(value) {
    return `${JSON.stringify(value)}\n`;
}
function hostTool(stdin) {
    if (typeof stdin.tool_name !== 'string')
        throw new Error('tool_name');
    if (!isRecord(stdin.tool_input))
        throw new Error('tool_input');
    const input = stdin.tool_input;
    const command = typeof input.command === 'string' ? { command: input.command } : {};
    return { name: stdin.tool_name, input, ...command };
}
await runSubprocessEntry({
    parse(check, stdin) {
        if (!isRecord(stdin) || typeof stdin.session_id !== 'string') {
            throw new Error('session_id');
        }
        const sessionId = stdin.session_id;
        if (check === 'before-tool')
            return { sessionId, tool: hostTool(stdin) };
        if (check === 'after-tool') {
            const tool = hostTool(stdin);
            // 值可为任意 JSON，按形状取文本（入口与打包接口第 4 节）
            if (!Object.hasOwn(stdin, 'tool_response'))
                throw new Error('tool_response');
            return { sessionId, tool, toolOutput: stdin.tool_response };
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
    replaceOutput: output => ({
        exitCode: 0,
        stdout: jsonLine({
            hookSpecificOutput: { hookEventName: 'PostToolUse', updatedToolOutput: output },
        }),
    }),
    // 只把原因附加给模型，原输出保留（残余风险由宿主模块写入构建报告）
    blockOutput: text => ({
        exitCode: 0,
        stdout: jsonLine({ decision: 'block', reason: text }),
    }),
    dataDir(env) {
        const dir = env.CLAUDE_PLUGIN_DATA;
        return dir === undefined || dir === '' ? null : dir;
    },
    optionValue: (name, env) => env[`CLAUDE_PLUGIN_OPTION_${name.toUpperCase()}`],
});
