// 构建编排按插件目录放置的组件（模块接口 §5）：skills（F-03-04）、agents（SD-30）与 commands
// （F-03-16，SD-33）。复制写入该目录的成功目标所适用组件的并集；宿主按目录加载这些组件，目录中
// 有而不适用于某目标的组件记为该目标的残余风险。
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { compare } from '../source/files.js';
const FILE_KINDS = ['agents', 'commands'];
const LABELS = {
    agents: 'agent',
    commands: 'command',
};
// 写入该目录的成功目标所适用组件的并集，各自按名称排序
export function componentUnion(targets) {
    return {
        skills: union(targets.flatMap(state => state.plan?.skills ?? [])),
        agents: union(targets.flatMap(state => state.plan?.agents ?? [])),
        commands: union(targets.flatMap(state => state.plan?.commands ?? [])),
    };
}
export async function componentFiles(root, placed) {
    const files = [];
    for (const skill of placed.skills) {
        for (const file of skill.files) {
            const from = join(root, skill.dir, ...file.split('/'));
            const path = `skills/${skill.name}/${file}`;
            files.push({ path, content: await readFile(from), copyFrom: from });
        }
    }
    for (const kind of FILE_KINDS) {
        for (const component of placed[kind]) {
            const from = join(root, ...component.path.split('/'));
            const path = `${kind}/${component.name}.md`;
            files.push({ path, content: await readFile(from), copyFrom: from });
        }
    }
    return files;
}
// 每个目标依次记 skill、agent、command 的风险；不承载 agents 或 commands 的目标（如 Codex 之于
// agents、agy 之于 commands）不加载对应目录，不记
export function recordComponentRisks(targets, present) {
    for (const state of targets) {
        recordShared(state, 'skill', state.plan?.skills ?? [], present.skills);
        for (const kind of FILE_KINDS) {
            if (state.capabilities.components[kind] === 'none')
                continue;
            recordShared(state, LABELS[kind], state.plan?.[kind] ?? [], present[kind]);
        }
    }
}
function recordShared(state, label, own, present) {
    const ownNames = new Set(own.map(component => component.name));
    for (const component of present.filter(c => !ownNames.has(c.name))) {
        state.sharedRisks.push(`${label} ${component.name} 不适用于本目标，但与其他目标共用插件目录，宿主仍会加载`);
    }
}
function union(components) {
    const byName = new Map();
    for (const component of components)
        byName.set(component.name, component);
    return [...byName.values()].sort((a, b) => compare(a.name, b.name));
}
