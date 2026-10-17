var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
// 以 Node 类型剥离导入源项目中的 .ts 模块（配置与守卫逻辑共用），
// 把导入失败转成 InputIssue。
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { failed, loaded } from './issues.js';
import { displayPath } from './paths.js';
export async function importModule(path, root) {
    if (!existsSync(path)) {
        return failed([
            { file: displayPath(root, path), field: null, message: '文件不存在' },
        ]);
    }
    try {
        return loaded(await import(__rewriteRelativeImportExtension(pathToFileURL(path).href)));
    }
    catch (error) {
        return failed([importIssue(error, path, root)]);
    }
}
function importIssue(error, path, root) {
    const e = (typeof error === 'object' && error !== null ? error : {});
    const message = typeof e.message === 'string' ? e.message : String(error);
    // 不可擦除语法（enum、namespace、参数属性等）：
    // 出错文件写在 stack 的第一行 `<路径>:<行>`
    if (e.code === 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX') {
        const location = typeof e.stack === 'string' ? e.stack.split('\n')[0] : undefined;
        const file = location?.replace(/:\d+$/, '');
        return {
            file: displayPath(root, file && existsSync(file) ? file : path),
            field: null,
            message: `使用了 Node 类型剥离不支持的语法：${message}`,
        };
    }
    // 相对导入缺 .ts 扩展名：url 指向不存在的模块，补上 .ts 后存在
    if (e.code === 'ERR_MODULE_NOT_FOUND' && typeof e.url === 'string') {
        return missingModuleIssue(e.url, message, path, root);
    }
    return { file: displayPath(root, path), field: null, message: `导入失败：${message}` };
}
function missingModuleIssue(url, message, path, root) {
    const missing = url.startsWith('file:') ? fileURLToPath(url) : url;
    const importer = message.split(' imported from ')[1]?.trim();
    const file = displayPath(root, importer && existsSync(importer) ? importer : path);
    if (existsSync(`${missing}.ts`)) {
        const target = displayPath(root, missing);
        return { file, field: null, message: `相对导入缺少 .ts 扩展名：${target}` };
    }
    return {
        file,
        field: null,
        message: `找不到导入的模块：${displayPath(root, missing)}`,
    };
}
