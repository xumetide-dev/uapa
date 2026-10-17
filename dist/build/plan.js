import { hostOf } from '../config/targets.js';
import { newState } from './state.js';
export function planTargets(config, source, guard, capabilities) {
    return config.targets.map(target => planTarget(target, config, source, guard, capabilities));
}
function planTarget(target, config, source, guard, capabilities) {
    const state = newState(target, capabilities[target]);
    const skills = planComponents(state, 'skills', source.skills);
    const agents = planComponents(state, 'agents', source.agents);
    const rules = planComponents(state, 'rules', source.rules);
    const commands = planComponents(state, 'commands', source.commands);
    const mcpServers = planMcpServers(state, source.mcpServers);
    const checks = guard === null ? [] : planChecks(state, guard);
    const commandHooks = planCommandHooks(state, config, capabilities);
    if (state.errors.length === 0) {
        state.plan = {
            target,
            capabilities: state.capabilities,
            skills,
            agents,
            mcpServers,
            rules,
            commands,
            checks,
            commandHooks,
        };
    }
    return state;
}
// 跳过项的 component 与错误信息中的写法
const COMPONENT_KINDS = {
    skills: { label: 'skill', path: (name) => `skills/${name}` },
    agents: { label: 'agent', path: (name) => `agents/${name}.md` },
    rules: { label: 'rule', path: (name) => `rules/${name}.md` },
    commands: { label: 'command', path: (name) => `commands/${name}.md` },
};
// 不适用本目标的组件不计；本目标不能承载该类组件时，
// 显式写了本目标的组件使目标失败，未写 targets 的列为跳过
function planComponents(state, kind, components) {
    const carried = state.capabilities.components[kind] !== 'none';
    const { label, path } = COMPONENT_KINDS[kind];
    const planned = [];
    for (const component of components) {
        const { name, targets } = component;
        if (targets !== null && !targets.includes(state.target))
            continue;
        if (carried)
            planned.push(component);
        else if (targets !== null) {
            state.errors.push(`${label} ${name} 显式限定了本目标，但本目标不能承载 ${kind}`);
        }
        else {
            state.skipped.push({ component: path(name), reason: `本目标不能承载 ${kind}` });
        }
    }
    return planned;
}
// MCP 服务器按 targets 与承载能力筛选（F-03-20，SD-49）：不适用本目标的服务器不计；
// 本目标不能承载 MCP 时，显式写了本目标的服务器使目标失败，未写 targets 的列为跳过
function planMcpServers(state, servers) {
    const carried = state.capabilities.components.mcp !== 'none';
    const planned = [];
    for (const server of servers) {
        const targets = server.targets ?? null;
        if (targets !== null && !targets.includes(state.target))
            continue;
        if (carried)
            planned.push(server);
        else if (targets !== null) {
            state.errors.push(`MCP 服务器 ${server.name} 显式限定了本目标，但本目标不能承载 MCP 服务器`);
        }
        else {
            state.skipped.push({
                component: `mcpServers.${server.name}`,
                reason: '本目标不能承载 MCP 服务器',
            });
        }
    }
    return planned;
}
// 缺失时省略对应 hook 的能力（hooks 适配第 6 节）；rewriteInput 与 replaceOutput 缺失按降级处理
const GATE_OF_CHECK = {
    beforePrompt: 'promptGate',
    beforeStop: 'stopGate',
    afterTool: 'withholdOutput',
};
// requires 中有本目标缺失的能力时目标失败；未列入 requires 的缺失能力记为降级或省略检查
function planChecks(state, guard) {
    const supported = state.capabilities.capabilities;
    for (const capability of guard.requires.filter(c => !supported[c])) {
        state.errors.push(`守卫的 requires 声明了 ${capability}，本目标缺少该能力`);
    }
    if (state.errors.length > 0)
        return [];
    recordDegradedChecks(state, guard, supported);
    return guard.checks.filter(check => {
        if (check === 'beforeTool' || supported[GATE_OF_CHECK[check]])
            return true;
        state.omitted.push(check);
        return false;
    });
}
function recordDegradedChecks(state, guard, supported) {
    if (guard.checks.includes('beforeTool') && !supported.rewriteInput) {
        state.degraded.push({
            decision: 'rewrite',
            as: 'deny',
            reason: '本目标不能改写入参，rewrite 按 fallbackReason 拒绝',
        });
    }
    // 执行后检查被省略时（缺 withholdOutput）没有 replace 可降级（SD-29）
    if (guard.checks.includes('afterTool') &&
        supported.withholdOutput &&
        !supported.replaceOutput) {
        state.degraded.push({
            decision: 'replace',
            as: 'withhold',
            reason: '本目标不能替换输出，replace 的 text 作为扣留说明写出',
        });
    }
}
// 命令 hooks 声明的承载检查（command-hooks.md 第 4 节）：适用且本目标承载该事件的声明按声明
// 顺序列入；不承载时，targets 显式列出本目标则失败，否则列为跳过，同一宿主的另一目标承载时不写
function planCommandHooks(state, config, capabilities) {
    const planned = [];
    for (const [index, hook] of (config.commandHooks ?? []).entries()) {
        const explicit = hook.targets !== undefined;
        if (explicit && !hook.targets.includes(state.target))
            continue;
        if (state.capabilities.commandHookEvents[hook.event] !== null) {
            planned.push(hook);
            continue;
        }
        const reason = `本目标不承载 ${hook.event} 事件`;
        if (explicit) {
            state.errors.push(`commandHooks[${index}] 显式限定了本目标，但${reason}`);
            continue;
        }
        const carriedBySibling = config.targets.some(other => other !== state.target &&
            hostOf(other) === hostOf(state.target) &&
            capabilities[other].commandHookEvents[hook.event] !== null);
        if (!carriedBySibling)
            state.skipped.push({ component: `commandHooks[${index}]`, reason });
    }
    return planned;
}
