// 命令 hooks 声明的 schema 与目标限定检查（F-01-09、F-01-15，SD-48）：
// matcher 等字段按未知字段拒绝，timeout 为可选正整数秒，targets 只能含已配置的目标。
import { z } from 'zod';
import { TARGETS } from './targets.js';
import { COMMAND_HOOK_EVENTS } from './types.js';
export const targetName = z.enum(TARGETS, {
    error: issue => `未知目标名 ${JSON.stringify(issue.input)}`,
});
// 列表中第二次及以后出现的目标各记一条
export function noDuplicateTargets(targets, ctx) {
    targets.forEach((target, index) => {
        if (targets.indexOf(target) !== index) {
            ctx.addIssue({ code: 'custom', path: [index], message: `重复的目标 ${target}` });
        }
    });
}
export const commandHook = z.strictObject({
    event: z.enum(COMMAND_HOOK_EVENTS, {
        error: issue => `未知事件 ${JSON.stringify(issue.input)}`,
    }),
    command: z
        .string()
        .min(1, { error: '不能为空', abort: true })
        .refine(command => !command.includes('\n') && !command.includes('\r'), {
        error: '应为单行，不能含换行',
    }),
    targets: z
        .array(targetName)
        .min(1, '至少列出一个目标')
        .superRefine(noDuplicateTargets)
        .optional(),
    timeout: z
        .number({ error: '应为正整数' })
        .int('应为正整数')
        .positive('应为正整数')
        .optional(),
});
// 命令 hooks 声明的 targets 只能含已配置的目标
export function unconfiguredHookTargets(config, file) {
    const issues = [];
    for (const [index, hook] of (config.commandHooks ?? []).entries()) {
        for (const [at, target] of (hook.targets ?? []).entries()) {
            if (config.targets.includes(target))
                continue;
            const field = `commandHooks[${index}].targets[${at}]`;
            issues.push({ file, field, message: `${target} 不在 targets 中` });
        }
    }
    return issues;
}
