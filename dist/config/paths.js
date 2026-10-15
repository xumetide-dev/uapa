// 报告、摘要与错误输出中的路径写法（模块接口 §2）：相对配置文件所在目录，POSIX 分隔，
// 不以 ./ 开头，不带结尾 /；该目录本身写作 '.'。
import { isAbsolute, relative, sep } from 'node:path';
export function displayPath(root, absolute) {
    const rel = relative(root, absolute).split(sep).join('/');
    return rel === '' ? '.' : rel;
}
// inner 位于 outer 之内（不含相等）
export function isInside(outer, inner) {
    const rel = relative(outer, inner);
    if (rel === '' || isAbsolute(rel))
        return false;
    return rel !== '..' && !rel.startsWith(`..${sep}`);
}
