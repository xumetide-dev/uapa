// 比对模式（F-03-08）：把计划写出的文件与磁盘逐字节比对，不写任何文件。默认布局另列出写入前
// 会被清除的文件；路径相对配置文件所在目录（模块接口 §2），按字典序排列。
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { displayPath } from '../config/paths.js';
import { compare } from '../source/files.js';
export async function compareOutputs(root, outputs, marketplaces = []) {
    const changes = [];
    for (const output of outputs) {
        const dir = output.dir.path;
        const shown = (path) => displayPath(root, join(dir, ...path.split('/')));
        for (const file of output.files) {
            const target = join(dir, ...file.path.split('/'));
            const change = await compareFile(target, shown(file.path), file.content);
            if (change !== null)
                changes.push(change);
        }
        if (output.merged)
            continue;
        const planned = new Set(output.files.map(file => file.path));
        for (const path of await existingFiles(dir)) {
            if (!planned.has(path))
                changes.push({ change: 'removed', path: shown(path) });
        }
    }
    for (const item of marketplaces) {
        const change = await compareFile(item.targetPath, item.shownPath, item.content);
        if (change !== null)
            changes.push(change);
    }
    return changes.sort((a, b) => compare(a.path, b.path));
}
async function compareFile(target, shownPath, content) {
    const existing = await onDisk(target);
    if (existing === 'missing')
        return { change: 'added', path: shownPath };
    if (existing === 'not-a-file' || !existing.equals(content)) {
        return { change: 'modified', path: shownPath };
    }
    return null;
}
// 路径不存在（或上级不是目录）时为 missing，是目录时为 not-a-file
async function onDisk(path) {
    try {
        return await readFile(path);
    }
    catch (error) {
        if (isMissing(error))
            return 'missing';
        if (error.code === 'EISDIR')
            return 'not-a-file';
        throw error;
    }
}
// 目录中目录以外的全部项（含符号链接），相对该目录、POSIX 分隔；目录不存在时为空
async function existingFiles(dir) {
    try {
        const entries = await readdir(dir, { recursive: true, withFileTypes: true });
        return entries
            .filter(entry => !entry.isDirectory())
            .map(entry => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'));
    }
    catch (error) {
        if (isMissing(error))
            return [];
        throw error;
    }
}
function isMissing(error) {
    const code = error.code;
    return code === 'ENOENT' || code === 'ENOTDIR';
}
