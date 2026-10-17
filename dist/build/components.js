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
// 写入该目录的成功目标所适用组件的并集，各自按名称排序。只并入原样承载（package）该类组件的
// 目标的组件：换算承载（converted）的组件由宿主模块生成，不原样复制（F-03-19）
export function componentUnion(targets) {
    const copies = (state, kind) => state.capabilities.components[kind] === 'package';
    return {
        skills: union(targets.flatMap(s => (copies(s, 'skills') ? (s.plan?.skills ?? []) : []))),
        agents: union(targets.flatMap(s => (copies(s, 'agents') ? (s.plan?.agents ?? []) : []))),
        commands: union(targets.flatMap(s => (copies(s, 'commands') ? (s.plan?.commands ?? []) : []))),
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
// 组件在插件目录中的路径，与 componentFiles 的 path 相同；插件目录是源项目根目录时一并包含源项目的
// rules/<name>.md，用于同路径检查（组件已在原位，不复制，且不得被生成文件覆盖；F-03-20）
export function componentPaths(placed) {
    const skills = placed.skills.flatMap(skill => skill.files.map(file => `skills/${skill.name}/${file}`));
    const files = FILE_KINDS.flatMap(kind => placed[kind].map(component => `${kind}/${component.name}.md`));
    const rules = (placed.rules ?? []).map(rule => `rules/${rule.name}.md`);
    return [...skills, ...files, ...rules];
}
// 每个目标依次记 skill、agent、command 的风险；不承载对应组件的目标（如 Codex 之于 agents）
// 不加载对应目录，不记
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
