// 不在映射表中的宿主工具以 host:<原名> 传给守卫；只认映射表自身的键
export function canonicalToolName(hostName, toolNames) {
    const canonical = Object.hasOwn(toolNames, hostName) ? toolNames[hostName] : undefined;
    return canonical ?? `host:${hostName}`;
}
// 规范名为 shell 时入参换算为 { command }，命令文本缺失时按输入无法解析处理；
// 其余工具的入参原样传入
export function toToolCall(sessionId, tool, toolNames) {
    const name = canonicalToolName(tool.name, toolNames);
    if (name !== 'shell') {
        return { ok: true, call: { sessionId, tool: name, input: tool.input } };
    }
    if (tool.command === undefined)
        return { ok: false, field: 'tool.command' };
    return { ok: true, call: { sessionId, tool: name, input: { command: tool.command } } };
}
// rewrite 只对 shell 且目标能改写入参时生效；其余情况按 fallbackReason 拒绝，
// 不放行原始入参。decision 须已经过 checkBeforeTool 检查
export function resolveToolDecision(decision, tool, rewriteInput) {
    if (decision.kind !== 'rewrite')
        return decision;
    const { command } = decision.input;
    if (tool === 'shell' && rewriteInput && typeof command === 'string') {
        return { kind: 'rewriteShell', command, fallbackReason: decision.fallbackReason };
    }
    return { kind: 'deny', reason: decision.fallbackReason };
}
