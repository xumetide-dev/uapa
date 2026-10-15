export function loaded(value) {
    return { ok: true, value };
}
export function failed(issues) {
    return { ok: false, issues };
}
// 字段路径：['targets', 2] → 'targets[2]'，
// ['hosts', 'claude-code', 'dir'] → 'hosts.claude-code.dir'
export function fieldPath(path) {
    let out = '';
    for (const key of path) {
        if (typeof key === 'number')
            out += `[${key}]`;
        else
            out += out === '' ? String(key) : `.${String(key)}`;
    }
    return out === '' ? null : out;
}
