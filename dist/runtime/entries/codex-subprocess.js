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
        const dir = env.PLUGIN_DATA;
        return dir === undefined || dir === '' ? null : dir;
    },
});
