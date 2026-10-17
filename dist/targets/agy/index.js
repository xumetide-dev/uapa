// agy 宿主模块（agy:subprocess）。agy plugin validate 对结构错误也报通过，本宿主不实现
// verify，由字段白名单检查（F-11-05）在生成时代替。MCP 服务器写入 mcp_config.json（F-11-08），
// rules 写入 rules/（F-11-09）。commands 由构建编排原样复制，本模块只写残余风险（F-11-11）。
import { runtimeOptions } from '../../source/guard.js';
import { fieldErrors } from './fields.js';
import { HOOKS_FILE, hooksConfig, SUBPROCESS_ENTRY } from './hooks.js';
import { MANIFEST, MANIFEST_CONFLICT_HINT, manifest, manifestErrors, manifestPathOf, } from './manifest.js';
import { MCP_FILE, mcpConfig } from './mcp.js';
import { agyRisks } from './risks.js';
import { ruleFiles } from './rules.js';
const TARGET = 'agy:subprocess';
function json(value) {
    return `${JSON.stringify(value, null, 2)}\n`;
}
// 错误不属于单个目标时，为每个目标各返回一条相同的消息（模块接口 §5）
function failAll(plans, messages) {
    const errors = plans.flatMap(plan => messages.map(message => ({ target: plan.target, message })));
    return { ok: false, errors };
}
// 子进程入口（F-11-04）
async function entryFile(input, plan, guard) {
    const entry = await input.bundle({
        entry: 'agy-subprocess',
        guardModule: guard.modulePath,
        data: {
            pluginName: input.config.name,
            toolNames: plan.capabilities.toolNames,
            capabilities: plan.capabilities.capabilities,
            moduleSessionEnv: null,
            options: runtimeOptions(guard),
        },
        external: 'node',
    });
    return { path: SUBPROCESS_ENTRY, content: entry };
}
function manifestOutput(manifestPath, pluginManifest) {
    return {
        path: manifestPath,
        content: json(pluginManifest),
        ...(manifestPath === MANIFEST ? { conflictHint: MANIFEST_CONFLICT_HINT } : {}),
    };
}
export const agy = {
    host: 'agy',
    async generate(input) {
        const nameErrors = manifestErrors(input.config);
        if (nameErrors.length > 0)
            return failAll(input.plans, nameErrors);
        const plan = input.plans.find(p => p.target === TARGET);
        const guard = input.guard;
        const manifestPath = manifestPathOf(input.config, input.sharedWith);
        // 有守卫且 checks 非空时才生成入口；checks 与 commandHooks 都为空时不生成 hooks.json
        const withEntry = plan !== undefined && plan.checks.length > 0 && guard !== null;
        const pluginManifest = manifest(input.config);
        const hooks = plan === undefined
            ? null
            : hooksConfig(input.config.name, withEntry ? plan.checks : [], plan);
        const mcp = mcpConfig(plan?.mcpServers ?? []);
        const errors = fieldErrors(pluginManifest, hooks, mcp.config, manifestPath);
        if (errors.length > 0)
            return failAll(input.plans, errors);
        const rules = ruleFiles(plan?.rules ?? []);
        const files = [manifestOutput(manifestPath, pluginManifest)];
        if (hooks !== null)
            files.push({ path: HOOKS_FILE, content: json(hooks) });
        if (withEntry)
            files.push(await entryFile(input, plan, guard));
        if (mcp.config !== null)
            files.push({ path: MCP_FILE, content: json(mcp.config) });
        files.push(...rules.files);
        const residualRisks = plan === undefined
            ? []
            : agyRisks(input, plan, manifestPath, rules.risks, mcp.risks);
        return { ok: true, files, skipped: mcp.skipped, residualRisks };
    },
};
