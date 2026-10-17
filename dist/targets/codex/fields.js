// 字段白名单检查（F-06-05）：Codex 对 manifest、事件表、处理器与 MCP 服务器中的未知字段静默
// 忽略，对 hooks 文件根对象的未知键整份拒绝，因此在生成时检查。允许的字段取自 codex-plugins.md
// 「源码核对（rust-v0.162.1）」中的兼容 manifest 与 hooks 文件结构，以及 codex-source-review.md
// 「插件中的 MCP 服务器」。
import { MANIFEST } from './manifest.js';
const MANIFEST_FIELDS = [
    'name',
    'version',
    'description',
    'keywords',
    'skills',
    'mcpServers',
    'apps',
    'hooks',
    'interface',
];
// websiteURL、privacyPolicyURL、termsOfServiceURL 是对应 *Url 字段的别名
const INTERFACE_FIELDS = [
    'displayName',
    'shortDescription',
    'longDescription',
    'developerName',
    'category',
    'capabilities',
    'websiteUrl',
    'websiteURL',
    'privacyPolicyUrl',
    'privacyPolicyURL',
    'termsOfServiceUrl',
    'termsOfServiceURL',
    'defaultPrompt',
    'brandColor',
    'composerIcon',
    'logo',
    'logoDark',
    'screenshots',
];
const HOOKS_FILE_FIELDS = ['description', 'hooks'];
const EVENTS = [
    'PreToolUse',
    'PermissionRequest',
    'PostToolUse',
    'PreCompact',
    'PostCompact',
    'SessionStart',
    'SessionEnd',
    'UserPromptSubmit',
    'SubagentStart',
    'SubagentStop',
    'Stop',
    'Interrupt',
];
const GROUP_FIELDS = ['matcher', 'hooks'];
// 宿主另接受 async、statusMessage 等字段；UAPA 只写这三个，async 为 true 时不能阻断
const HANDLER_FIELDS = ['type', 'command', 'timeout'];
const MCP_FILE_FIELDS = ['mcpServers'];
// 宿主另接受 bearer_token_env_var、env_http_headers；UAPA 只写这些（env_vars 见 F-06-12）
const MCP_SERVER_FIELDS = [
    'type',
    'command',
    'args',
    'env',
    'env_vars',
    'cwd',
    'url',
    'http_headers',
];
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
        errors.push(`${where} 含 Codex 不允许的字段 ${key}`);
    }
    return true;
}
function checkList(value, where, errors) {
    if (Array.isArray(value))
        return value;
    errors.push(`${where} 不是数组`);
    return [];
}
function manifestErrors(manifest, errors) {
    if (!checkKeys(manifest, MANIFEST_FIELDS, MANIFEST, errors))
        return;
    if (manifest.interface === undefined)
        return;
    checkKeys(manifest.interface, INTERFACE_FIELDS, `${MANIFEST} 的 interface`, errors);
}
function hooksErrors(file, hooks, errors) {
    if (!checkKeys(hooks, HOOKS_FILE_FIELDS, file, errors))
        return;
    const events = hooks.hooks;
    if (!checkKeys(events, EVENTS, `${file} 的 hooks`, errors))
        return;
    for (const event of Object.keys(events).filter(e => EVENTS.includes(e))) {
        const where = `${file} 的 hooks.${event}`;
        checkList(events[event], where, errors).forEach((group, index) => {
            const at = `${where}[${index}]`;
            if (!checkKeys(group, GROUP_FIELDS, at, errors))
                return;
            checkList(group.hooks, `${at}.hooks`, errors).forEach((handler, i) => {
                checkKeys(handler, HANDLER_FIELDS, `${at}.hooks[${i}]`, errors);
            });
        });
    }
}
function mcpErrors(file, config, errors) {
    if (!checkKeys(config, MCP_FILE_FIELDS, file, errors))
        return;
    const servers = config.mcpServers;
    if (!isRecord(servers)) {
        errors.push(`${file} 的 mcpServers 不是对象`);
        return;
    }
    for (const [name, server] of Object.entries(servers)) {
        checkKeys(server, MCP_SERVER_FIELDS, `${file} 的 mcpServers.${name}`, errors);
    }
}
// hooks 或 mcp 为 null 时不生成该文件，只检查生成的文件；manifest 总是检查
export function fieldErrors(manifest, hooks, mcp = null) {
    const errors = [];
    manifestErrors(manifest, errors);
    if (hooks !== null)
        hooksErrors(hooks.file, hooks.value, errors);
    if (mcp !== null)
        mcpErrors(mcp.file, mcp.value, errors);
    return errors;
}
