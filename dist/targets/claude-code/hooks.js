export const HOOKS_FILE = 'hooks/hooks.json';
export const SUBPROCESS_ENTRY = 'hooks/uapa-claude-code.mjs';
// 声明中 {pluginRoot} 的替换（command-hooks.md 第 3 节）
const PLUGIN_ROOT = `\${CLAUDE_PLUGIN_ROOT}`;
const EVENTS = {
    beforeTool: 'PreToolUse',
    beforePrompt: 'UserPromptSubmit',
    beforeStop: 'Stop',
    afterTool: 'PostToolUse', // 不写 matcher，覆盖全部工具（SD-29）
};
// 入口的第一个参数（入口与打包接口第 2 节）
const CHECK_ARGS = {
    beforeTool: 'before-tool',
    beforePrompt: 'before-prompt',
    beforeStop: 'before-stop',
    afterTool: 'after-tool',
};
// 入口出错时可以阻断的检查（Claude Code 2.1.295 起，SD-43）
const BLOCKABLE = ['beforeTool', 'beforePrompt'];
function handler(command, timeout) {
    return timeout === null
        ? { type: 'command', command }
        : { type: 'command', command, timeout };
}
// 守卫条目：每个检查一个事件，每个事件一个分组；onFailure 写在 timeout 之后
export function commandHooks(checks, timeout, onFailure = undefined) {
    const hooks = {};
    for (const check of checks) {
        const command = `node "${PLUGIN_ROOT}/${SUBPROCESS_ENTRY}" ${CHECK_ARGS[check]}`;
        const entry = handler(command, timeout);
        if (onFailure !== undefined && BLOCKABLE.includes(check))
            entry.onFailure = onFailure;
        hooks[EVENTS[check]] = [{ hooks: [entry] }];
    }
    return hooks;
}
// guardChecks 为生成了入口的检查（没有守卫时为空），plan 为 claude-code:subprocess 的计划，
// 只配置 claude-code:in-process 时为 undefined。守卫条目在前，规则条目其次；每条声明一个分组，
// 按声明顺序排在同一事件的已有条目之后，去重（F-05-08）不作用于规则与声明的条目。都没有时为 null
export function hooksKey(guardChecks, plan, { rulesCommand, onFailure }) {
    const timeout = plan?.capabilities.hookTimeoutSeconds ?? null;
    const hooks = commandHooks(guardChecks, timeout, onFailure);
    if (rulesCommand !== null) {
        hooks.SessionStart = [{ hooks: [handler(rulesCommand, timeout)] }];
    }
    if (plan !== undefined) {
        for (const hook of plan.commandHooks) {
            const event = hostEvent(plan, hook);
            const command = hook.command.split('{pluginRoot}').join(PLUGIN_ROOT);
            const limit = hook.timeout ?? timeout;
            hooks[event] = [...(hooks[event] ?? []), { hooks: [handler(command, limit)] }];
        }
    }
    return Object.keys(hooks).length === 0 ? null : hooks;
}
function hostEvent(plan, hook) {
    const event = plan.capabilities.commandHookEvents[hook.event];
    // 承载检查（F-03-15）只传入本目标承载的事件
    if (event === null)
        throw new Error(`${plan.target} 不承载 ${hook.event} 事件`);
    return event;
}
