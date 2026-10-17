export const HOOKS_FILE = 'hooks.json';
export const SUBPROCESS_ENTRY = 'hooks/uapa-agy.mjs';
// 声明中 {pluginRoot} 的替换（command-hooks.md 第 3 节）
const PLUGIN_ROOT = '.';
const MATCHED_EVENTS = ['PreToolUse', 'PostToolUse'];
// 入口的第一个参数（入口与打包接口第 2 节）
const CHECK_ARGS = {
    beforeTool: 'before-tool',
    beforePrompt: 'before-prompt',
    beforeStop: 'before-stop',
    afterTool: 'after-tool', // 能力数据记 withholdOutput 为不支持，不生成（SD-29）
};
// 处理器的键序固定为 type、command、timeout；timeout 为 null 时不写
function handler(command, timeout) {
    return timeout === null
        ? { type: 'command', command }
        : { type: 'command', command, timeout };
}
// 事件数组的一个元素
function element(event, command, timeout) {
    const entry = handler(command, timeout);
    return MATCHED_EVENTS.includes(event) ? { matcher: '', hooks: [entry] } : entry;
}
function guardEvents(checks, timeout) {
    const events = {};
    for (const check of checks) {
        const command = `node ${SUBPROCESS_ENTRY} ${CHECK_ARGS[check]}`;
        if (check === 'beforeTool') {
            events.PreToolUse = [element('PreToolUse', command, timeout)];
        }
        else if (check === 'beforeStop') {
            events.Stop = [element('Stop', command, timeout)];
        }
        else if (check === 'beforePrompt') {
            // 能力数据记 promptGate 为不支持，构建编排不会传入提示提交前检查
            throw new Error('agy 没有提示提交事件，不能生成 beforePrompt 的 hook');
        }
        else {
            // 能力数据记 withholdOutput 为不支持，构建编排不会传入执行后检查
            throw new Error('agy 不能扣留工具输出，不能生成 afterTool 的 hook');
        }
    }
    return events;
}
// 守卫事件
export function agyHooks(pluginName, checks, timeout) {
    return { [pluginName]: guardEvents(checks, timeout) };
}
// guardChecks 为生成了入口的检查（没有守卫时为空）。守卫元素在前；每条声明一个元素，按声明顺序
// 排在同一事件的守卫元素之后。两者都没有时为 null
export function hooksConfig(pluginName, guardChecks, plan) {
    const timeout = plan.capabilities.hookTimeoutSeconds;
    const events = guardEvents(guardChecks, timeout);
    for (const hook of plan.commandHooks) {
        const event = hostEvent(plan, hook);
        const command = hook.command.split('{pluginRoot}').join(PLUGIN_ROOT);
        const limit = hook.timeout ?? timeout;
        events[event] = [...(events[event] ?? []), element(event, command, limit)];
    }
    return Object.keys(events).length === 0 ? null : { [pluginName]: events };
}
function hostEvent(plan, hook) {
    const event = plan.capabilities.commandHookEvents[hook.event];
    // 承载检查（F-03-15）只传入本目标承载的事件
    if (event === null)
        throw new Error(`${plan.target} 不承载 ${hook.event} 事件`);
    return event;
}
