// 读取 MCP 服务器（F-01-08，SD-30）：mcp/servers.json 的顶层只有 mcpServers，值为服务器名到
// 配置的映射。本地服务器为 command（必填）、args、env、envVars（F-01-13，SD-40），远程服务器为
// url（必填）、headers；{pluginRoot} 只用于本地服务器，由各宿主模块换算。
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { failed, loaded } from '../config/issues.js';
import { compare } from './files.js';
import { isEnvVarList, isRecord, isText, isTextList, isTextMap, noPluginRoot, readMcpTargets, } from './mcp-fields.js';
const FILE = 'mcp/servers.json';
const LOCAL_FIELDS = ['command', 'args', 'env'];
const REMOTE_FIELDS = ['url', 'headers'];
// 只用于本地服务器；不参与本地与远程的判断，远程服务器写它时单独报错
const ENV_VARS = 'envVars';
const TARGETS_FIELD = 'targets';
const SERVER_NAME = /^[A-Za-z0-9_-]+$/;
export async function readMcpServers(root) {
    const text = await readText(join(root, ...FILE.split('/')));
    if (text === null)
        return loaded([]);
    if (typeof text !== 'string')
        return failed([text]);
    let value;
    try {
        value = JSON.parse(text);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return failed([{ file: FILE, field: null, message: `不是有效的 JSON：${message}` }]);
    }
    const issues = [];
    const servers = readServers(value, issues);
    if (issues.length > 0)
        return failed(issues);
    return loaded(servers.sort((a, b) => compare(a.name, b.name)));
}
// 文件不存在时为 null；mcp 不是目录或 servers.json 不是文件时为 InputIssue
async function readText(path) {
    try {
        return await readFile(path, 'utf8');
    }
    catch (error) {
        const code = error.code;
        if (code === 'ENOENT')
            return null;
        if (code === 'ENOTDIR')
            return { file: 'mcp', field: null, message: 'mcp 应为目录' };
        if (code === 'EISDIR')
            return { file: FILE, field: null, message: '应为文件' };
        throw error;
    }
}
function readServers(value, issues) {
    const issue = (field, message) => issues.push({ file: FILE, field, message });
    if (!isRecord(value)) {
        issue(null, '顶层应为对象');
        return [];
    }
    for (const key of Object.keys(value).filter(k => k !== 'mcpServers')) {
        issue(key, '未知字段，顶层只有 mcpServers');
    }
    const map = value.mcpServers;
    if (!isRecord(map)) {
        issue('mcpServers', '应为服务器名到配置的映射');
        return [];
    }
    const servers = [];
    for (const [name, config] of Object.entries(map)) {
        const server = readServer(name, config, issue);
        if (server !== null)
            servers.push(server);
    }
    return servers;
}
function readServer(name, config, issue) {
    const at = `mcpServers.${name}`;
    if (!SERVER_NAME.test(name))
        issue(at, '服务器名只能含字母、数字、_、-');
    if (!isRecord(config)) {
        issue(at, '应为对象');
        return null;
    }
    const allowed = [...LOCAL_FIELDS, ...REMOTE_FIELDS, ENV_VARS, TARGETS_FIELD];
    for (const key of Object.keys(config).filter(k => !allowed.includes(k))) {
        issue(`${at}.${key}`, '未知字段');
    }
    const local = Object.keys(config).some(k => LOCAL_FIELDS.includes(k));
    const remote = Object.keys(config).some(k => REMOTE_FIELDS.includes(k));
    if (local && remote) {
        issue(at, '本地服务器（command、args、env）与远程服务器（url、headers）的字段混用');
        return null;
    }
    return remote ? readRemote(name, config, issue) : readLocal(name, config, issue);
}
function readLocal(name, config, issue) {
    const at = `mcpServers.${name}`;
    const { command, args, env, envVars } = config;
    const targets = readMcpTargets(config.targets, `${at}.targets`, issue);
    const ok = [
        isText(command, `${at}.command`, issue),
        args === undefined || isTextList(args, `${at}.args`, issue),
        env === undefined || isTextMap(env, `${at}.env`, issue),
        envVars === undefined || isEnvVarList(envVars, `${at}.envVars`, issue),
        targets !== false,
    ].every(Boolean);
    if (!ok || targets === false)
        return null;
    return {
        name,
        kind: 'local',
        command: command,
        ...(args === undefined ? {} : { args: [...args] }),
        ...(env === undefined ? {} : { env: { ...env } }),
        ...(envVars === undefined ? {} : { envVars: [...envVars] }),
        ...(targets === null ? {} : { targets }),
    };
}
function readRemote(name, config, issue) {
    const at = `mcpServers.${name}`;
    const { url, headers } = config;
    if (config.envVars !== undefined)
        issue(`${at}.envVars`, '只用于本地服务器');
    const targets = readMcpTargets(config.targets, `${at}.targets`, issue);
    const urlOk = isText(url, `${at}.url`, issue) && noPluginRoot(url, `${at}.url`, issue);
    let headersOk = headers === undefined || isTextMap(headers, `${at}.headers`, issue);
    if (headersOk && headers !== undefined) {
        const checks = Object.entries(headers).map(([key, text]) => noPluginRoot(text, `${at}.headers.${key}`, issue));
        headersOk = checks.every(Boolean);
    }
    if (!urlOk || !headersOk || config.envVars !== undefined || targets === false)
        return null;
    return {
        name,
        kind: 'remote',
        url: url,
        ...(headers === undefined
            ? {}
            : { headers: { ...headers } }),
        ...(targets === null ? {} : { targets }),
    };
}
