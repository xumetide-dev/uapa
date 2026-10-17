// marketplace 目录（F-01-14，SD-41）：配置校验与构建编排共用。marketplace 文件写在该目录，
// 其中的插件条目以相对该目录的路径指向 Claude Code 与 Codex 的插件目录。
import { relative, resolve, sep } from 'node:path';
import { outDirOf, resolvePluginDirs } from './layout.js';
import { displayPath, isInside } from './paths.js';
// 生成 marketplace 文件的宿主；agy 只支持官方 marketplace，不生成文件
export const MARKETPLACE_HOSTS = ['claude-code', 'codex'];
// marketplace 目录的绝对路径，默认为 outDir；未配置 marketplace 时为 null
export function marketplaceDirOf(config, root) {
    const { marketplace } = config;
    if (marketplace === undefined)
        return null;
    if (marketplace.dir === undefined)
        return outDirOf(config, root);
    return resolve(root, marketplace.dir);
}
// 从 marketplace.dir 到插件目录的相对路径，以 ./ 开头；两者相同时为 './'；未配置时为 null
export function marketplaceSourceOf(config, root, pluginDir) {
    const dir = marketplaceDirOf(config, root);
    if (dir === null)
        return null;
    const rel = relative(dir, pluginDir).split(sep).join('/');
    return rel === '' ? './' : `./${rel}`;
}
export function checkMarketplace(config, root, file) {
    const dir = marketplaceDirOf(config, root);
    if (dir === null)
        return [];
    const pluginDirs = resolvePluginDirs(config, root);
    const listed = pluginDirs.filter(d => d.hosts.some(h => MARKETPLACE_HOSTS.includes(h)));
    if (listed.length === 0) {
        const message = 'targets 中没有 Claude Code 或 Codex 的目标：agy 只支持官方 marketplace，' +
            '不生成 marketplace 文件';
        return [{ file, field: 'marketplace', message }];
    }
    // 默认目录即 outDir：默认布局的插件目录不得等于或包含 outDir，已由 checkPluginDirs 报告
    const cleared = config.marketplace?.dir === undefined ? [] : clearedDirs(root, dir, pluginDirs);
    const messages = [...cleared, ...outsideDirs(root, dir, listed)];
    return messages.map(message => ({ file, field: 'marketplace.dir', message }));
}
// marketplace 目录等于或位于默认布局的插件目录内：该插件目录写入前会被清空
function clearedDirs(root, dir, pluginDirs) {
    const shown = displayPath(root, dir);
    return pluginDirs.flatMap(pluginDir => {
        const [host] = pluginDir.hosts;
        if (host === undefined || pluginDir.hosts.length > 1)
            return [];
        if (dir !== pluginDir.path && !isInside(pluginDir.path, dir))
            return [];
        const at = displayPath(root, pluginDir.path);
        return [
            `marketplace 目录 ${shown} 等于或位于 ${host} 的插件目录 ${at} 之内：` +
                '该插件目录写入前会被清空',
        ];
    });
}
// Claude Code 与 Codex 的插件目录不在 marketplace 目录内：两个宿主的 marketplace 条目只接受
// 以 ./ 开头、不含 .. 的相对路径
function outsideDirs(root, dir, listed) {
    const shown = displayPath(root, dir);
    return listed.flatMap(pluginDir => {
        if (pluginDir.path === dir || isInside(dir, pluginDir.path))
            return [];
        const hosts = pluginDir.hosts.filter(h => MARKETPLACE_HOSTS.includes(h)).join('、');
        const at = displayPath(root, pluginDir.path);
        return [
            `${hosts} 的插件目录 ${at} 不在 marketplace 目录 ${shown} 之内：` +
                'marketplace 条目只接受以 ./ 开头、不含 .. 的相对路径',
        ];
    });
}
