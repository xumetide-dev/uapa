// 读取 agents（F-01-07，SD-30）：agents/ 下一层的 <name>.md 与 frontmatter。
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { failed, loaded } from '../config/issues.js';
import { compare, listMarkdownFiles } from './files.js';
import { readFrontmatter, readTargets } from './frontmatter.js';
const EXTENSION = '.md';
export async function readAgents(root) {
    const fileNames = await listMarkdownFiles(root, 'agents');
    if (!fileNames.ok)
        return fileNames;
    const agents = [];
    const issues = [];
    for (const fileName of fileNames.value) {
        const result = await readAgent(root, fileName);
        if (result.ok)
            agents.push(result.value);
        else
            issues.push(...result.issues);
    }
    if (issues.length > 0)
        return failed(issues);
    return loaded(agents.sort((a, b) => compare(a.name, b.name)));
}
async function readAgent(root, fileName) {
    const path = `agents/${fileName}`;
    const meta = readFrontmatter(await readFile(join(root, path), 'utf8'), path);
    if (!meta.ok)
        return meta;
    const issues = [];
    for (const key of ['name', 'description']) {
        const value = meta.value[key];
        if (typeof value !== 'string' || value.trim() === '') {
            issues.push({ file: path, field: key, message: '应为非空字符串' });
        }
    }
    const stem = fileName.slice(0, -EXTENSION.length);
    const name = meta.value.name;
    if (typeof name === 'string' && name.trim() !== '' && name !== stem) {
        issues.push({ file: path, field: 'name', message: `与文件名 ${stem} 不一致` });
    }
    const targets = readTargets(meta.value.targets, path, issues);
    if (issues.length > 0)
        return failed(issues);
    return loaded({ name: stem, path, frontmatterKeys: Object.keys(meta.value), targets });
}
