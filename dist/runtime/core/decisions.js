export const INVALID_RESULT_REASON = 'uapa: 守卫返回值无效';
const invalid = { ok: false, reason: INVALID_RESULT_REASON };
function valid(value) {
    return { ok: true, value };
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isReason(value) {
    return typeof value === 'string' && value.trim() !== '';
}
// tool 为换算后的规范名；为 'shell' 时 rewrite.input.command 须为非空字符串
export function checkBeforeTool(value, tool) {
    if (!isRecord(value))
        return invalid;
    if (value.kind === 'allow')
        return valid({ kind: 'allow' });
    if (value.kind === 'deny') {
        return isReason(value.reason)
            ? valid({ kind: 'deny', reason: value.reason })
            : invalid;
    }
    if (value.kind !== 'rewrite')
        return invalid;
    const { input, fallbackReason } = value;
    if (!isRecord(input) || !isReason(fallbackReason))
        return invalid;
    const command = input.command;
    if (tool === 'shell' && (typeof command !== 'string' || command === '')) {
        return invalid;
    }
    return valid({ kind: 'rewrite', input: { ...input }, fallbackReason });
}
export function checkBeforePrompt(value) {
    if (!isRecord(value))
        return invalid;
    if (value.kind === 'allow')
        return valid({ kind: 'allow' });
    if (value.kind === 'block' && isReason(value.reason)) {
        return valid({ kind: 'block', reason: value.reason });
    }
    return invalid;
}
export function checkBeforeStop(value) {
    if (!isRecord(value))
        return invalid;
    if (value.kind === 'stop')
        return valid({ kind: 'stop' });
    if (value.kind === 'continue' && isReason(value.reason)) {
        return valid({ kind: 'continue', reason: value.reason });
    }
    return invalid;
}
export function guardErrorReason(error) {
    const message = error instanceof Error ? error.message : String(error);
    return `uapa: 守卫出错: ${message}`;
}
