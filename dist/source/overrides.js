// 读取覆盖目录（F-01-06）：列出 overrides/<宿主>/ 下的文件，不复制。目录名不是 targets 中已配置
// 的宿主时为输入错误；overrides/ 下不是目录的项（如说明文件）忽略。
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { failed, loaded } from '../config/issues.js';
import { configuredHosts } from '../config/layout.js';
import { compare, listFiles, orMissing } from './files.js';
export const OVERRIDES_DIR = 'overrides';
export async function readOverrides(config, root) {
    const dir = join(root, OVERRIDES_DIR);
    const info = await orMissing(stat(dir));
    if (info === null)
        return loaded({});
    if (!info.isDirectory()) {
        return failed([{ file: OVERRIDES_DIR, field: null, message: 'overrides 应为目录' }]);
    }
    const hosts = configuredHosts(config);
    const entries = await readdir(dir, { withFileTypes: true });
    const names = entries.filter(e => e.isDirectory()).map(e => e.name);
    const overrides = {};
    const issues = [];
    for (const name of names.sort(compare)) {
        const file = `${OVERRIDES_DIR}/${name}`;
        const host = hosts.find(h => h === name);
        if (host === undefined) {
            const message = `不是已配置的宿主（已配置：${hosts.join('、')}）`;
            issues.push({ file, field: null, message });
            continue;
        }
        overrides[host] = await listFiles(join(dir, name), file, issues);
    }
    return issues.length > 0 ? failed(issues) : loaded(overrides);
}
