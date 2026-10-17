import { MANIFEST } from './manifest.js';
const TARGET = 'agy:subprocess';
// 停机计数目录取系统临时目录（SD-06）：agy 1.3.5 的 hook 进程中没有插件数据目录变量（TA-25，SD-46）
const STOP_COUNTER_RISK = '停机计数存放在系统临时目录下的 uapa-<插件名>/，该目录被清理时停机计数归零';
// PreToolUse 的 stdout 不是含 decision 的 JSON 时宿主阻断（agy-local-tests.md「本地实测」）
const PRE_TOOL_USE_RISK = '声明的 PreToolUse 命令须在 stdout 输出含 decision 的 JSON，否则 agy 阻断每次工具调用';
// F-11-15：与 Codex 共用目录且显式写根 plugin.json 时，Codex 优先读根 plugin.json 而不加载 hooks
const SHARED_CODEX_ROOT_MANIFEST_RISK = '与 Codex 共用插件目录且写根 plugin.json：Codex 优先读取根 plugin.json（AgentPlugin 格式）' +
    '并忽略 .codex-plugin/plugin.json，不加载任何 hooks';
// 安装时把 commands/ 转换为技能（F-11-11；agy-local-tests.md「v0.4.0 覆盖审查（1.3.5，容器）」）
const COMMANDS_RISK = 'agy 安装时把 commands 转换为技能，以 /<插件名>:<命令名> 调用；转换后的技能也会被模型按 ' +
    'description 自动选用';
// 未核实 agy 插件的用户配置（F-11-10）
const OPTIONS_RISK = 'agy 没有已核实的插件用户配置，守卫选项取构建时默认值';
// F-11-14：停机继续的上限（agy-local-tests.md「v0.4.0 覆盖审查（1.3.5，容器）」；CHANGELOG
// 1.1.9 称次数可配置）与 /btw（CHANGELOG 1.3.3；打印模式不支持 /btw，未实测）
const STOP_LIMIT_RISK = 'agy 在连续继续 10 次后不再采用停机前检查的 continue（1.3.5 实测，次数可由用户配置）';
const BTW_RISK = '/btw 不运行用户与工作区的 hooks，其中是否运行插件的 hooks 未实测';
// agent 的 tools 与 model 按 agy 的工具名与模型名解释（agy 文档「Custom subagents」）
const AGENT_KEYS = ['tools', 'model'];
export function agyRisks(input, plan, manifestPath, ruleRisks, mcpRisks) {
    const messages = [];
    if (plan.checks.includes('beforeStop'))
        messages.push(STOP_COUNTER_RISK);
    if (plan.commandHooks.some(hook => hook.event === 'PreToolUse')) {
        messages.push(PRE_TOOL_USE_RISK);
    }
    if (input.sharedWith.includes('codex') && manifestPath === MANIFEST) {
        messages.push(SHARED_CODEX_ROOT_MANIFEST_RISK);
    }
    const optionCount = input.guard?.options.length ?? 0;
    if (plan.checks.length > 0 && optionCount > 0)
        messages.push(OPTIONS_RISK);
    messages.push(...ruleRisks);
    if (plan.commands.length > 0)
        messages.push(COMMANDS_RISK);
    // 生成了入口的检查；没有守卫时不生成入口
    const guardChecks = input.guard === null ? [] : plan.checks;
    if (guardChecks.includes('beforeStop'))
        messages.push(STOP_LIMIT_RISK);
    if (guardChecks.includes('beforeTool'))
        messages.push(BTW_RISK);
    messages.push(...componentRisks(plan), ...mcpRisks);
    return messages.map(message => ({ target: TARGET, message }));
}
// agent 的 frontmatter 与 rule 正文中的文件引用（F-11-14）
function componentRisks(plan) {
    const messages = [];
    for (const agent of plan.agents) {
        const keys = agent.frontmatterKeys.filter(key => AGENT_KEYS.includes(key));
        if (keys.length === 0)
            continue;
        messages.push(`agent ${agent.name} 的 frontmatter 含 ${keys.join('、')}：agy 按自身的工具名与模型名` +
            '解释，写错的工具名可能使子代理挂起');
    }
    // agy 文档「Rules」：@[…] 引用的文件在加载时展开，计入规则的大小上限
    for (const rule of plan.rules.filter(r => r.body.includes('@['))) {
        messages.push(`rule ${rule.name} 的正文以 @[…] 引用文件：被引用的文件须经 files/ 或 overrides/agy/ ` +
            '提供，规则的大小上限按展开后计算');
    }
    return messages;
}
