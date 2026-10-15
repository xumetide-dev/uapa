import { resolvePluginDirs } from '../config/layout.js';
import { HOSTS, hostOf } from '../config/targets.js';
// 返回各宿主生成成功的文件；失败的宿主不在结果中，其目标的 errors 已填写
export async function generateHosts(build, states, deps) {
    const { config, guard } = build;
    const dirs = resolvePluginDirs(config, build.root);
    const files = new Map();
    for (const host of HOSTS) {
        const hostStates = states.filter(state => hostOf(state.target) === host);
        const plans = hostStates.flatMap(state => (state.plan === null ? [] : [state.plan]));
        if (plans.length === 0)
            continue;
        const dirHosts = dirs.find(dir => dir.hosts.includes(host))?.hosts ?? [];
        const sharedWith = dirHosts.filter(other => other !== host);
        const input = { config, plans, guard, sharedWith, bundle: deps.bundle };
        const result = await callHost(deps.hostModules[host], input);
        for (const state of hostStates.filter(s => s.plan !== null)) {
            const own = (notes) => notes.filter(note => note.target === state.target).map(note => note.message);
            if (result.ok)
                state.hostRisks.push(...own(result.residualRisks));
            else if ('thrown' in result)
                state.errors.push(`同一宿主的生成失败: ${result.thrown}`);
            else {
                const messages = own(result.errors);
                state.errors.push(...(messages.length > 0 ? messages : ['同一宿主的生成失败']));
            }
        }
        if (result.ok)
            files.set(host, result.files);
    }
    return files;
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
