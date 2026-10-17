export const MCP_FILE = 'mcp_config.json';
const TARGET = 'agy:subprocess';
const PLUGIN_ROOT = '{pluginRoot}';
const SKIP_REASON = 'agy 不展开 MCP 配置中的插件根，command 的相对路径按哪个目录解析依赖平台，' +
    'command 中的 {pluginRoot} 不能换算';
const LITERAL_RISK = '含 ${：agy 不展开 MCP 配置中的变量，按字面传递';
const USER_CONFIG_PREFIX = '${user_config.';
const USER_CONFIG_RISK = '含 ${user_config.：agy 不展开用户配置占位符，已从 env 中剥离';
function withRoot(text) {
    return text.split(PLUGIN_ROOT).join('.');
}
// 剥离含 ${user_config. 的 env 项（F-11-15，SD-49）
function retainedEnv(env) {
    return Object.entries(env ?? {}).filter(([, value]) => !value.includes(USER_CONFIG_PREFIX));
}
// 键序固定：本地服务器为 command、args、env，远程服务器为 serverUrl、headers
function entry(server) {
    if (server.kind === 'remote') {
        const { url, headers } = server;
        return { serverUrl: url, ...(headers === undefined ? {} : { headers }) };
    }
    const { command, args, env } = server;
    const retained = retainedEnv(env);
    return {
        command,
        ...(args === undefined ? {} : { args: args.map(withRoot) }),
        ...(retained.length === 0
            ? {}
            : {
                env: Object.fromEntries(retained.map(([key, value]) => [key, withRoot(value)])),
            }),
    };
}
// servers 已按名称排序；command 含 {pluginRoot} 的服务器不写入，列为跳过
export function mcpConfig(servers) {
    const skipped = [];
    const written = [];
    for (const server of servers) {
        if (server.kind === 'local' && server.command.includes(PLUGIN_ROOT)) {
            const component = `mcpServers.${server.name}`;
            skipped.push({ target: TARGET, component, reason: SKIP_REASON });
        }
        else {
            written.push(server);
        }
    }
    const config = written.length === 0
        ? null
        : { mcpServers: Object.fromEntries(written.map(s => [s.name, entry(s)])) };
    return { config, skipped, risks: risks(written) };
}
function risks(written) {
    const messages = [];
    const stripped = written.flatMap(strippedFields);
    if (stripped.length > 0) {
        messages.push(`MCP 服务器的字段 ${stripped.join('、')} ${USER_CONFIG_RISK}`);
    }
    const literal = written.flatMap(literalFields);
    if (literal.length > 0) {
        messages.push(`MCP 服务器的字段 ${literal.join('、')} ${LITERAL_RISK}`);
    }
    return messages;
}
function strippedFields(server) {
    if (server.kind !== 'local')
        return [];
    return Object.entries(server.env ?? {})
        .filter(([, text]) => text.includes(USER_CONFIG_PREFIX))
        .map(([key]) => `mcpServers.${server.name}.env.${key}`);
}
// 含 ${ 的保留字段，路径与读取 mcp/servers.json 时的错误相同，如 mcpServers.docs.args[0]
function literalFields(server) {
    const at = `mcpServers.${server.name}`;
    const map = (field, values = {}) => Object.entries(values).map(([key, text]) => [`${at}.${field}.${key}`, text]);
    const fields = server.kind === 'remote'
        ? [[`${at}.url`, server.url], ...map('headers', server.headers)]
        : [
            [`${at}.command`, server.command],
            ...(server.args ?? []).map((text, i) => [`${at}.args[${i}]`, text]),
            ...retainedEnv(server.env).map(([key, text]) => [`${at}.env.${key}`, text]),
        ];
    return fields.filter(([, text]) => text.includes('${')).map(([field]) => field);
}
