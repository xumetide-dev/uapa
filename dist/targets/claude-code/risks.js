// 插件包中只有 hooks 模块时（F-05-10）
const MODULE_ONLY_RISK = 'Claude Code 2.1.287 之前的版本不加载 hooks 模块，守卫不生效；' +
    '同时配置 claude-code:subprocess 可在这些版本上以命令 hooks 兜底';
// 计划了执行后检查时（SD-29）：按输出形状替换，Bash 与 Read 之外的工具没有可替换的形状
const SUBPROCESS_AFTER_TOOL_RISK = '命令 hooks 的执行后检查只能替换 Bash 与 Read 这类形状可替换的输出；其他工具的 replace ' +
    '与 withhold 只把文本附加给模型，模型仍读到原输出；工具报错时宿主不触发 PostToolUse，' +
    '报错的结果不受检查';
const MODULE_AFTER_TOOL_RISK = 'hooks 模块的执行后检查只能替换 Bash 与 Read 这类形状可替换的输出；其他工具的 replace ' +
    '按扣留写出，模型读到以替换文本为原因的扣留说明';
// onFailure 为 'block' 时（F-05-21）
const BLOCK_UNVERIFIED = 'Claude Code 2.1.295 之前的版本对 onFailure 的处理未核实';
const BOTH_FORMS_BLOCK_RISK = '同时配置 claude-code:in-process 时，hooks 模块生效的会话中命令入口仍会运行（随后跳过），' +
    '缺少 Node ≥ 22 时同样被阻断';
const IN_PROCESS_ONLY_BLOCK_RISK = 'hosts.claude-code.onFailure 只作用于命令 hooks，只配置 claude-code:in-process 时不生效';
// F-05-23
const SESSION_END_RISK = 'Claude Code 的 SessionEnd hooks 共用 1.5 秒的总预算，插件 hooks 写的 timeout 不提高该预算';
const MOD_OVERRIDE_RISK = '用户安装的 mod 可以放行插件 hook 拒绝的工具调用';
const HOOKS_DISABLED_RISK = 'disableAllHooks、--safe-mode、--bare 与托管设置（如 allowManagedHooksOnly）可使插件的 ' +
    'hooks 与 hooks 模块不运行，守卫不生效';
const IGNORED_AGENT_KEYS = ['permissionMode', 'hooks', 'mcpServers', 'initialPrompt'];
export function claudeCodeRisks(input, forms) {
    const { subprocess, inProcess } = forms;
    const notes = [];
    const add = (plan, messages) => notes.push(...messages.map(message => ({ target: plan.target, message })));
    if (forms.moduleWritten && subprocess === undefined && inProcess !== undefined) {
        add(inProcess, [MODULE_ONLY_RISK]);
    }
    // 没有守卫时 checks 为空
    if (subprocess !== undefined) {
        if (subprocess.checks.includes('afterTool'))
            add(subprocess, [SUBPROCESS_AFTER_TOOL_RISK]);
        add(subprocess, blockRisks(input, subprocess, forms.moduleWritten));
        add(subprocess, planRisks(subprocess, guardChecks(input, subprocess)));
    }
    if (inProcess !== undefined) {
        if (inProcess.checks.includes('afterTool'))
            add(inProcess, [MODULE_AFTER_TOOL_RISK]);
        const block = input.config.hosts?.['claude-code']?.onFailure === 'block';
        if (block && subprocess === undefined)
            add(inProcess, [IN_PROCESS_ONLY_BLOCK_RISK]);
        add(inProcess, planRisks(inProcess, guardChecks(input, inProcess)));
    }
    return notes;
}
// 生成了守卫入口或模块的检查：没有守卫时不生成，也不写依赖守卫的风险
function guardChecks(input, plan) {
    return input.guard === null ? [] : plan.checks;
}
// 命令入口出错时阻断的检查：执行前检查阻断工具调用，提示提交前检查阻断提示
function blockRisks(input, subprocess, moduleWritten) {
    if (input.config.hosts?.['claude-code']?.onFailure !== 'block')
        return [];
    const checks = guardChecks(input, subprocess);
    const blocked = [
        ...(checks.includes('beforeTool') ? ['工具调用'] : []),
        ...(checks.includes('beforePrompt') ? ['提示'] : []),
    ];
    if (blocked.length === 0)
        return [];
    const blockedText = blocked.join('与');
    const risk = `运行宿主的机器缺少 Node ≥ 22 时，每次${blockedText}都被阻断；${BLOCK_UNVERIFIED}`;
    return moduleWritten ? [risk, BOTH_FORMS_BLOCK_RISK] : [risk];
}
// 与形态无关、按计划内容写的条目
function planRisks(plan, checks) {
    const messages = [];
    if (plan.commandHooks.some(hook => hook.event === 'SessionEnd')) {
        messages.push(SESSION_END_RISK);
    }
    if (checks.includes('beforeTool')) {
        messages.push(MOD_OVERRIDE_RISK, HOOKS_DISABLED_RISK);
    }
    for (const agent of plan.agents) {
        const ignored = agent.frontmatterKeys.filter(key => IGNORED_AGENT_KEYS.includes(key));
        if (ignored.length === 0)
            continue;
        messages.push(`agent ${agent.name} 的 frontmatter 含 ${ignored.join('、')}：Claude Code 插件中的 ` +
            'agent 忽略这些键');
    }
    return messages;
}
