import { resolvePluginDirs } from '../config/layout.js';
import { marketplaceSourceOf } from '../config/marketplace.js';
import { HOSTS, hostOf } from '../config/targets.js';
// 返回各宿主生成成功的文件；失败的宿主不在结果中，其目标的 errors 已填写
export async function generateHosts(build, states, deps) {
    const dirs = resolvePluginDirs(build.config, build.root);
    const hostFiles = new Map();
    const marketplaceFiles = new Map();
    for (const host of HOSTS) {
        const hostStates = states.filter(state => hostOf(state.target) === host);
        const plans = hostStates.flatMap(state => (state.plan === null ? [] : [state.plan]));
        if (plans.length === 0)
            continue;
        const pluginDir = dirs.find(dir => dir.hosts.includes(host));
        const input = hostInput(build, host, plans, pluginDir, deps);
        const result = await callHost(deps.hostModules[host], input);
        for (const state of hostStates.filter(s => s.plan !== null)) {
            applyHostResult(state, result);
        }
        if (!result.ok)
            continue;
        hostFiles.set(host, result.files);
        if (result.marketplaceFiles !== undefined && result.marketplaceFiles.length > 0) {
            marketplaceFiles.set(host, result.marketplaceFiles);
        }
    }
    return { hostFiles, marketplaceFiles };
}
function hostInput(build, host, plans, pluginDir, deps) {
    const { config, guard, root } = build;
    return {
        config,
        plans,
        guard,
        sharedWith: (pluginDir?.hosts ?? []).filter(other => other !== host),
        marketplaceSource: pluginDir === undefined
            ? null
            : marketplaceSourceOf(config, root, pluginDir.path),
        hasMcpServers: build.source.mcpServers.length > 0,
        bundle: deps.bundle,
    };
}
function applyHostResult(state, result) {
    const own = (notes) => notes.filter(note => note.target === state.target).map(note => note.message);
    if (result.ok) {
        // 宿主模块的跳过项排在能力检查的跳过项之后（构建报告「skipped」）
        for (const skip of result.skipped.filter(s => s.target === state.target)) {
            state.skipped.push({ component: skip.component, reason: skip.reason });
        }
        state.hostRisks.push(...own(result.residualRisks));
    }
    else if ('thrown' in result) {
        state.errors.push(`同一宿主的生成失败: ${result.thrown}`);
    }
    else {
        const messages = own(result.errors);
        state.errors.push(...(messages.length > 0 ? messages : ['同一宿主的生成失败']));
    }
}
// generate 抛错（含打包失败）时该宿主的目标全部失败，错误为异常消息
async function callHost(module, input) {
    try {
        return await module.generate(input);
    }
    catch (error) {
        return { ok: false, thrown: error instanceof Error ? error.message : String(error) };
    }
}
