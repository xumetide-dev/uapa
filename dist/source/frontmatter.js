// 组件 frontmatter 的读取（F-01-04、F-01-07）与其中的目标限定（F-01-05）：skills 与 agents 共用。
import { parse } from 'yaml';
import { failed, loaded } from '../config/issues.js';
import { isTargetName } from '../config/targets.js';
// frontmatter 为文件开头两行 `---` 之间的 YAML 映射
export function readFrontmatter(text, file) {
    const lines = text.split(/\r?\n/);
    const end = lines[0] === '---' ? lines.indexOf('---', 1) : -1;
    if (end < 0) {
        return failed([{ file, field: null, message: '缺少以 --- 包围的 frontmatter' }]);
    }
    let value;
    try {
        value = parse(lines.slice(1, end).join('\n'));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return failed([
            { file, field: null, message: `frontmatter 不是有效的 YAML：${message}` },
        ]);
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return failed([{ file, field: null, message: 'frontmatter 应为映射' }]);
    }
    return loaded(value);
}
// 未写 targets 时为 null（适用于全部目标）；写了就必须是非空的已登记目标名列表
export function readTargets(value, file, issues) {
    if (value === undefined)
        return null;
    if (!Array.isArray(value) || value.length === 0) {
        issues.push({ file, field: 'targets', message: '应为非空的目标名列表' });
        return null;
    }
    value.forEach((target, index) => {
        if (!isTargetName(target)) {
            const shown = JSON.stringify(target);
            issues.push({ file, field: `targets[${index}]`, message: `未知目标名 ${shown}` });
        }
    });
    return value.filter(isTargetName);
}
