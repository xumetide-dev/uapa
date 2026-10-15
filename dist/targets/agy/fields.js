// 字段白名单检查（F-11-05）：agy plugin validate 对结构错误也报通过，不作为宿主校验，改为在
// 生成时检查。允许的字段取自 agy-plugins.md「插件 manifest」与「Hooks」。
import { HOOKS_FILE } from './hooks.js';
import { MANIFEST } from './manifest.js';
const MANIFEST_FIELDS = ['name', 'description'];
const EVENTS = ['SessionStart', 'PreToolUse', 'PostToolUse', 'Stop'];
const MATCHED_EVENTS = ['PreToolUse', 'PostToolUse']; // 元素为 { matcher, hooks }
const ELEMENT_FIELDS = ['matcher', 'hooks'];
const HANDLER_FIELDS = ['type', 'command', 'timeout'];
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
// value 不是对象，或含 allowed 之外的键时，每处记一条错误
function checkKeys(value, allowed, where, errors) {
    if (!isRecord(value)) {
        errors.push(`${where} 不是对象`);
        return false;
    }
    for (const key of Object.keys(value).filter(k => !allowed.includes(k))) {
        errors.push(`${where} 含 agy 不允许的字段 ${key}`);
    }
    return true;
}
function checkList(value, where, errors) {
    if (Array.isArray(value))
        return value;
    errors.push(`${where} 不是数组`);
    return [];
}
function checkEvent(event, value, where, errors) {
    checkList(value, where, errors).forEach((element, index) => {
        const at = `${where}[${index}]`;
        if (!MATCHED_EVENTS.includes(event)) {
            checkKeys(element, HANDLER_FIELDS, at, errors);
            return;
        }
        if (!checkKeys(element, ELEMENT_FIELDS, at, errors))
            return;
        checkList(element.hooks, `${at}.hooks`, errors).forEach((h, i) => {
            checkKeys(h, HANDLER_FIELDS, `${at}.hooks[${i}]`, errors);
        });
    });
}
function hooksErrors(hooks, errors) {
    const definitions = Object.keys(hooks);
    if (definitions.length !== 1) {
        errors.push(`${HOOKS_FILE} 的顶层应只有一个键，实际为 ${definitions.length} 个`);
    }
    for (const name of definitions) {
        const where = `${HOOKS_FILE} 的 ${name}`;
        const events = hooks[name];
        if (!checkKeys(events, EVENTS, where, errors))
            continue;
        for (const event of Object.keys(events).filter(e => EVENTS.includes(e))) {
            checkEvent(event, events[event], `${where}.${event}`, errors);
        }
    }
}
// hooks 为 null 时不生成 hooks.json，只检查 plugin.json
export function fieldErrors(manifest, hooks) {
    const errors = [];
    checkKeys(manifest, MANIFEST_FIELDS, MANIFEST, errors);
    if (hooks !== null)
        hooksErrors(hooks, errors);
    return errors;
}
