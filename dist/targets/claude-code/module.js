export const MODULE_ENTRY = 'hooks/register.ts';
export const MODULE_GUARD = 'hooks/uapa-guard.mjs';
export const TYPES_FILE = 'types/index.d.ts';
// hooks/hooks.json 的 modules 键，路径相对该文件
export const MODULES = ['./register.ts'];
// register 须在 hooks.json 列出的文件中以 const 函数导出：validate 拒绝从另一文件转导出，
// 但跟踪传给引入函数的 on，因此在这里调用守卫文件的 register
const REGISTER_SOURCE = "import type { Register } from 'claude-code'\n" +
    "import { register as guard } from './uapa-guard.mjs'\n" +
    '\n' +
    'export const register: Register = on => guard(on)\n';
// 两个 Claude Code 目标都进入 plans 时的去重变量名（F-05-08）。配置 name 已校验为 kebab-case
export function moduleSessionEnv(pluginName) {
    return `UAPA_MODULE_SESSION_${pluginName.toUpperCase().replaceAll('-', '_')}`;
}
// 停机门禁计数的引用为 { plugin: <配置 name>, key: 'uapaStopContinuations' }（F-05-07）
function typesContract(pluginName) {
    return ("declare module 'claude-code' {\n" +
        '  interface PluginState {\n' +
        `    '${pluginName}': { uapaStopContinuations: number }\n` +
        '  }\n' +
        '}\n');
}
// 没有守卫或本目标没有要检查的事件时不生成 hooks 模块，返回 null
export async function moduleFiles(input, plan, sessionEnv) {
    const guard = input.guard;
    if (guard === null || plan.checks.length === 0)
        return null;
    const files = [
        { path: MODULE_ENTRY, content: REGISTER_SOURCE },
        await guardFile(input, plan, guard, sessionEnv),
    ];
    if (!plan.checks.includes('beforeStop'))
        return { files, types: null };
    files.push({ path: TYPES_FILE, content: typesContract(input.config.name) });
    return { files, types: `./${TYPES_FILE}` };
}
async function guardFile(input, plan, guard, sessionEnv) {
    const content = await input.bundle({
        entry: 'claude-code-in-process',
        guardModule: guard.modulePath,
        data: {
            pluginName: input.config.name,
            toolNames: plan.capabilities.toolNames,
            capabilities: plan.capabilities.capabilities,
            moduleSessionEnv: sessionEnv,
        },
        external: 'claude-code',
        checks: plan.checks,
    });
    return { path: MODULE_GUARD, content };
}
