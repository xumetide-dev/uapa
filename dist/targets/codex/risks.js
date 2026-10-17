import { DEFAULT_HOOKS_FILE, HOOKS_CONFLICT_HINT } from './hooks.js';
export const TARGET = 'codex:subprocess';
// 信任状态未通过的非托管 hook 不注册、不告警（codex-plugins.md「源码核对」）；有守卫条目时
// 另写守卫的后果，always 规则的后果见 rules.ts
const TRUST_RISK = 'Codex 只运行已信任的 hooks：安装后或 hooks 配置改动后须在 Codex 的 /hooks 中信任，' +
    '未信任的 hook 被静默跳过';
const GUARD_UNTRUSTED = '，守卫不生效';
const DIRECTORY_RISK = '含 hooks 的插件不能进入 Codex 的公开插件目录';
// 配置使插件 hooks 不运行（codex-plugins.md「Hooks」，F-06-16）
const MANAGED_RISK = 'Codex 配置 allow_managed_hooks_only = true 或 [features].hooks = false 时，插件的 hooks ' +
    '不运行';
// 声明的 SessionEnd 写 timeout: 3（F-06-14；codex-source-review.md「matcher、命令执行与超时」）
const SESSION_END_RISK = 'Codex 的 SessionEnd 超时上限 3 秒：声明的 SessionEnd 命令运行超过 3 秒即被终止';
// 计划了执行后检查时（SD-29；codex-source-review.md「PostToolUse」）
const AFTER_TOOL_RISK = 'Codex 只对执行成功的调用触发 PostToolUse：处理器报错与 MCP 结果 isError 为真的调用' +
    '不受执行后检查';
// 服务器名不加命名空间，重名时按配置名排序后先出现的生效，用户配置中的同名项覆盖插件的服务器
// （codex-source-review.md「插件中的 MCP 服务器」）
const MCP_NAME_RISK = 'Codex 不为插件的 MCP 服务器名加命名空间：与用户配置或其他插件的服务器重名时，插件的服务器' +
    '可能不生效';
// Codex 的插件没有用户配置（F-06-10；codex-source-review.md「commands、rules 与用户配置」）
const OPTIONS_RISK = 'Codex 没有插件用户配置，守卫选项取构建时默认值';
// Claude Code 按目录加载 hooks/hooks.json，不经 manifest 指定
const SHARED_HOOKS_RISK = '与 Claude Code 共用插件目录时，Claude Code 也加载 hooks/hooks.json 并运行其中为 Codex ' +
    `生成的命令；${HOOKS_CONFLICT_HINT}`;
export function hooksRisks(input, plan, hooksFile) {
    // 没有守卫时 checks 为空
    const trust = plan.checks.length > 0 ? TRUST_RISK + GUARD_UNTRUSTED : TRUST_RISK;
    const messages = [trust, DIRECTORY_RISK, MANAGED_RISK];
    if (plan.commandHooks.some(hook => hook.event === 'SessionEnd' && (hook.timeout === undefined || hook.timeout > 3))) {
        messages.push(SESSION_END_RISK);
    }
    if (plan.checks.includes('afterTool'))
        messages.push(AFTER_TOOL_RISK);
    const optionCount = input.guard?.options.length ?? 0;
    if (plan.checks.length > 0 && optionCount > 0)
        messages.push(OPTIONS_RISK);
    if (input.sharedWith.includes('claude-code') && hooksFile === DEFAULT_HOOKS_FILE) {
        messages.push(SHARED_HOOKS_RISK);
    }
    return messages.map(message => ({ target: TARGET, message }));
}
export function mcpRisks() {
    return [{ target: TARGET, message: MCP_NAME_RISK }];
}
