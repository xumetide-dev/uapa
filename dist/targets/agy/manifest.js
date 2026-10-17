export const MANIFEST = 'plugin.json';
export const ALT_MANIFEST = '.antigravity-plugin/plugin.json';
const NAME = /^[a-zA-Z0-9_-]+$/;
// 合并布局中与其他宿主的根 plugin.json 冲突时附在冲突错误之后
export const MANIFEST_CONFLICT_HINT = 'agy 的根 plugin.json 只允许 name 与 description，不能与其他宿主的根 plugin.json 合并；' +
    '为 hosts.agy.dir 设置单独的目录';
// 省略 hosts.agy.manifest 时，默认布局写 plugin.json，合并布局写 .antigravity-plugin/plugin.json
export function manifestPathOf(config, sharedWith) {
    return (config.hosts?.agy?.manifest ?? (sharedWith.length > 0 ? ALT_MANIFEST : MANIFEST));
}
export function manifestErrors(config) {
    if (NAME.test(config.name))
        return [];
    return [
        `插件名 ${config.name} 不匹配 ^[a-zA-Z0-9_-]+$：agy 的 plugin.json 不接受该名称`,
    ];
}
export function manifest(config) {
    return { name: config.name, description: config.description };
}
