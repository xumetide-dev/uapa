// 按命名空间合并共用的 JSON 文件（F-03-07，模块接口 §5）。合并布局中，同一路径上各宿主的文件
// 都由宿主模块标为 'json-extensions' 时，extensions 以外的字段按值比较（与键序无关），
// extensions 按命名空间合并；不能合并时由调用方按同名文件冲突处理。
import { isDeepStrictEqual } from 'node:util';
import { compare } from '../source/files.js';
const EXTENSIONS = 'extensions';
// files 按宿主在 src/config/targets.ts 中的顺序排列，第一个为基准：结果保留它的键序（基准没有
// extensions 时追加在末尾），extensions 的命名空间按字典序写出，两空格缩进、结尾换行。
// 任一文件未标合并、不是 JSON 对象、extensions 不是对象，extensions 以外的字段与基准不同，
// 或同一命名空间的内容不同时，返回 null
export function mergeJsonExtensions(files) {
    if (files.some(file => file.merge !== 'json-extensions'))
        return null;
    const documents = files.map(file => parseObject(file.content));
    const base = documents[0];
    if (base === undefined || base === null)
        return null;
    const namespaces = new Map();
    let hasExtensions = false;
    for (const document of documents) {
        if (document === null)
            return null;
        if (!isDeepStrictEqual(withoutExtensions(document), withoutExtensions(base)))
            return null;
        const own = document[EXTENSIONS];
        if (own === undefined)
            continue;
        if (!isObject(own))
            return null;
        hasExtensions = true;
        for (const [name, value] of Object.entries(own)) {
            const existing = namespaces.get(name);
            if (namespaces.has(name) && !isDeepStrictEqual(existing, value))
                return null;
            namespaces.set(name, value);
        }
    }
    if (!hasExtensions)
        return serialize(base);
    const names = [...namespaces.keys()].sort(compare);
    const extensions = Object.fromEntries(names.map(name => [name, namespaces.get(name)]));
    // 对象展开覆盖已有的键时保留其原位置
    return serialize({ ...base, [EXTENSIONS]: extensions });
}
function parseObject(content) {
    let value;
    try {
        value = JSON.parse(content.toString('utf8'));
    }
    catch {
        // 不是 JSON 的文件不能合并，由调用方按同名文件冲突处理
        return null;
    }
    return isObject(value) ? value : null;
}
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function withoutExtensions(document) {
    const { [EXTENSIONS]: _extensions, ...rest } = document;
    return rest;
}
function serialize(document) {
    return Buffer.from(`${JSON.stringify(document, null, 2)}\n`, 'utf8');
}
