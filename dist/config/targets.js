// 目标名与宿主标识的唯一定义处（模块接口 §1）。新增目标时在 TARGETS 中登记，
// 新宿主另在 HOSTS 中登记；HOSTS 的顺序决定插件目录与报告中宿主的先后。
// 未登记的目标名按未知目标名处理。
export const HOSTS = ['claude-code', 'codex', 'agy'];
export const TARGETS = [
    'claude-code:in-process',
    'claude-code:subprocess',
    'codex:subprocess',
    'agy:subprocess',
];
const targetHostsRegistered = true;
void targetHostsRegistered;
export function isTargetName(value) {
    return typeof value === 'string' && TARGETS.includes(value);
}
export function hostOf(target) {
    // 上方的类型断言保证宿主部分已登记
    return target.slice(0, target.indexOf(':'));
}
