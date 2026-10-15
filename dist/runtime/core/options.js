// 文本的解析：string 原样取用；number 要求去掉首尾空白后非空且为有限数；boolean 只接受
// true 与 false
export function optionsFromText(declared, text) {
    return resolve(declared, option => {
        const raw = text(option.name);
        return raw === undefined ? option.default : parseText(option, raw);
    });
}
// values 为 hooks 模块收到的取值（Claude Code 按 userConfig 的类型传入）；不是对象时视为
// 没有取值。缺少该键或为 undefined 时取 default，类型不符或 number 不是有限数时无效
export function optionsFromValues(declared, values) {
    const given = isRecord(values) ? values : {};
    return resolve(declared, option => {
        const value = Object.hasOwn(given, option.name) ? given[option.name] : undefined;
        if (value === undefined)
            return option.default;
        return isValueOf(option, value) ? value : null;
    });
}
function resolve(declared, pick) {
    const options = {};
    for (const option of declared) {
        const value = pick(option);
        if (value === null)
            return { ok: false, name: option.name };
        options[option.name] = value;
    }
    return { ok: true, options };
}
function parseText(option, raw) {
    if (option.type === 'string')
        return raw;
    if (option.type === 'boolean') {
        if (raw === 'true')
            return true;
        if (raw === 'false')
            return false;
        return null;
    }
    if (raw.trim() === '')
        return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
}
function isValueOf(option, value) {
    if (typeof value !== option.type)
        return false;
    return typeof value !== 'number' || Number.isFinite(value);
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
// 传给检查方法的 GuardContext；取值无效时为守卫出错的原因（F-04-09），两种入口都在
// callGuard 中据此不调用守卫，按守卫出错收口
export function guardContext(result) {
    if (!result.ok)
        return { ok: false, reason: `uapa: 守卫选项无效: ${result.name}` };
    return { ok: true, value: { options: result.options } };
}
