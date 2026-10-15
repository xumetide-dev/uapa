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
function handler(command, timeout) {
    return timeout === null
        ? { type: 'command', command }
        : { type: 'command', command, timeout };
}
// 守卫条目：每个检查一个事件，每个事件一个分组
export function commandHooks(checks, timeout) {
    const hooks = {};
    for (const check of checks) {
        const command = `node "${PLUGIN_ROOT}/${SUBPROCESS_ENTRY}" ${CHECK_ARGS[check]}`;
        hooks[EVENTS[check]] = [{ hooks: [handler(command, timeout)] }];
    }
    return hooks;
}
// guardChecks 为生成了入口的检查（没有守卫时为空）。守卫条目在前；每条声明一个分组，按声明顺序
// 排在同一事件的守卫条目之后，去重（F-05-08）不作用于这些条目。两者都没有时为 null
export function hooksKey(guardChecks, plan) {
    const timeout = plan.capabilities.hookTimeoutSeconds;
    const hooks = commandHooks(guardChecks, timeout);
    for (const hook of plan.commandHooks) {
        const event = hostEvent(plan, hook);
        const command = hook.command.split('{pluginRoot}').join(PLUGIN_ROOT);
        hooks[event] = [...(hooks[event] ?? []), { hooks: [handler(command, timeout)] }];
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
