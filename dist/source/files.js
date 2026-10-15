// 源项目读取共用的文件列举：skills（F-01-04）与覆盖目录（F-01-06）。
import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
// 递归列出目录下的全部文件，相对该目录、POSIX 分隔、按字典序；符号链接等不支持，
// 每个记一条错误，file 为错误所属的文件
export async function listFiles(dir, file, issues) {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        if (entry.isDirectory())
            continue;
        const path = relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/');
        if (entry.isFile())
            files.push(path);
        else
            issues.push({
                file,
                field: null,
                message: `不支持的文件类型（如符号链接）：${path}`,
            });
    }
    return files.sort(compare);
}
// 路径不存在时为 null，其他读取错误照常抛出
export async function orMissing(pending) {
    try {
        return await pending;
    }
    catch (error) {
        if (error.code === 'ENOENT')
            return null;
        throw error;
    }
}
// 按 UTF-16 码元比较，与区域设置无关
export function compare(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}
