// 计划写出的文件集合（构建产物「写出与比对」）：写出（F-03-05、F-03-06）与比对（F-03-08）都从
// 它得出。每个插件目录汇总各宿主模块生成的文件、构建编排放置的 skills、agents 与 commands
// （components.ts）、共用文件（F-03-17）与覆盖文件（F-03-12），各宿主的文件表见 placement.ts。
// 合并布局中同名文件内容不同时，标为可合并的 JSON 文件按命名空间合并（F-03-07，merge.ts），
// 其余为冲突：写入该目录的全部目标失败，该目录不进入集合。
import { resolvePluginDirs } from '../config/layout.js';
import { displayPath } from '../config/paths.js';
import { hostOf } from '../config/targets.js';
import { compare } from '../source/files.js';
import { SHARED_DIR } from '../source/shared.js';
import { componentFiles, componentPaths, componentUnion, recordComponentRisks, } from './components.js';
import { mergeJsonExtensions } from './merge.js';
import { hostView, sharedComponentConflicts, sharedFiles, shownIn, } from './placement.js';
import { succeeded } from './state.js';
export async function planOutputs(build, states, hostFiles) {
    const shared = await sharedFiles(build.root, build.source.files);
    const outputs = [];
    for (const dir of resolvePluginDirs(build.config, build.root)) {
        const output = await planDir(build, dir, states, hostFiles, shared);
        if (output !== null)
            outputs.push(output);
    }
    return outputs;
}
// 该目录的目标全部失败，或有来源冲突、合并布局冲突时返回 null：该目录不写入也不比对
async function planDir(build, dir, states, hostFiles, shared) {
    const targets = states.filter(s => dir.hosts.includes(hostOf(s.target)) && succeeded(s));
    if (targets.length === 0)
        return null;
    const atRoot = dir.path === build.root;
    if (atRoot && shared.length > 0)
        return failTargets(targets, [sharedAtRootMessage(build.root, dir)]);
    const present = atRoot ? build.source : componentUnion(targets);
    // 合并布局的目录就是源项目根目录时，组件已在原位，不复制，宿主加载源项目中的全部组件
    const copied = atRoot ? [] : await componentFiles(build.root, present);
    const layers = {
        copied,
        inPlace: atRoot ? componentPaths(present) : [],
        shared,
    };
    const { views, messages } = await placeHosts(build, dir, targets, hostFiles, layers);
    const { files, conflicts } = mergeViews(views);
    messages.push(...conflicts.map(c => conflictMessage(build.root, dir, c)));
    if (messages.length > 0)
        return failTargets(targets, messages);
    recordComponentRisks(targets, present);
    return { dir, merged: dir.hosts.length > 1, files, targets };
}
function failTargets(targets, messages) {
    for (const state of targets)
        state.errors.push(...messages);
    return null;
}
// 各宿主在该目录中的文件表，以及组件、共用文件与生成文件之间的来源冲突
async function placeHosts(build, dir, targets, hostFiles, layers) {
    const messages = sharedComponentConflicts(build.root, dir, layers);
    const views = [];
    for (const host of dir.hosts) {
        const generated = hostFiles.get(host);
        if (generated === undefined)
            continue;
        const own = targets.filter(s => hostOf(s.target) === host);
        const view = await hostView(build, dir, host, generated, layers, own);
        views.push([host, view.files]);
        messages.push(...view.conflicts);
    }
    return { views, messages };
}
function sharedAtRootMessage(root, dir) {
    return (`共用文件：插件目录 ${displayPath(root, dir.path)} 是源项目根目录，${SHARED_DIR}/ 中的文件` +
        '不复制到这里；把共用文件直接放在根目录，或改用默认布局');
}
function collectPathEntries(views) {
    const entries = new Map();
    for (const [host, view] of views) {
        for (const file of view.values()) {
            const entry = entries.get(file.path);
            const hint = file.conflictHint;
            if (entry === undefined) {
                const hints = hint === undefined ? [] : [hint];
                entries.set(file.path, {
                    file,
                    versions: [file],
                    hosts: [host],
                    hints,
                    differs: false,
                });
                continue;
            }
            entry.versions.push(file);
            entry.hosts.push(host);
            if (hint !== undefined && !entry.hints.includes(hint))
                entry.hints.push(hint);
            if (!entry.file.content.equals(file.content))
                entry.differs = true;
        }
    }
    return entries;
}
// 各宿主的同名文件内容一致时只写一次；不一致而都标为可合并时按命名空间合并，合并结果作为生成
// 的文件；否则记为冲突，列出写入该文件的全部宿主
function mergeViews(views) {
    const entries = collectPathEntries(views);
    for (const entry of entries.values()) {
        if (!entry.differs)
            continue;
        const merged = mergeJsonExtensions(entry.versions);
        if (merged === null)
            continue;
        entry.file = { path: entry.file.path, content: merged, copyFrom: null };
        entry.differs = false;
    }
    const sorted = [...entries.values()].sort((a, b) => compare(a.file.path, b.file.path));
    const files = sorted.map(({ file }) => ({
        path: file.path,
        content: file.content,
        copyFrom: file.copyFrom,
    }));
    const conflicts = sorted
        .filter(entry => entry.differs)
        .map(({ file, hosts, hints }) => ({ path: file.path, hosts, hints }));
    return { files, conflicts };
}
function conflictMessage(root, dir, conflict) {
    const shown = shownIn(root, dir, conflict.path);
    const hosts = conflict.hosts.join('、');
    const hints = conflict.hints.map(hint => `；${hint}`).join('');
    return `合并布局冲突：${shown} 由 ${hosts} 生成，内容不同${hints}`;
}
