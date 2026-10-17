export const MCP_FILE = 'mcp.json';
const TARGET = 'codex:subprocess';
const PLUGIN_ROOT = '{pluginRoot}';
const SKIP_REASON = 'Codex 不展开 MCP 配置中的插件根，command 中的 {pluginRoot} 不能换算';
const ENV_RISK = '未声明 envVars：Codex 启动本地服务器前清空环境，只传递 HOME、PATH 等少数变量与 env、' +
    'env_vars 中的变量';
const LITERAL_RISK = '含 ${：Codex 不展开 MCP 配置中的变量，按字面传递';
const USER_CONFIG_PREFIX = '${user_config.';
const USER_CONFIG_VAR = /^\$\{user_config\.([A-Za-z_][A-Za-z0-9_]*)\}$/;
const USER_CONFIG_RISK = '含 ${user_config.：Codex 不展开用户配置占位符，已从 env 中剥离';
// 以插件目录为工作目录（cwd 为 .）时，参数与环境变量中的插件根写作 .
function withRoot(text) {
    return text.split(PLUGIN_ROOT).join('.');
}
// 剥离含 ${user_config. 的 env 项（F-06-17，SD-49）
function retainedEnv(env) {
    return Object.entries(env ?? {}).filter(([, value]) => !value.includes(USER_CONFIG_PREFIX));
}
// 整值匹配 ${user_config.<KEY>} 的项将 <KEY> 并入 env_vars（去重）
function mergedEnvVars(server) {
    if (server.kind !== 'local')
        return undefined;
    const extracted = Object.values(server.env ?? {}).flatMap(value => {
        const match = USER_CONFIG_VAR.exec(value);
        return match?.[1] === undefined ? [] : [match[1]];
    });
    const combined = [...new Set([...(server.envVars ?? []), ...extracted])];
    return combined.length === 0 ? undefined : combined;
}
// 键序固定：type 在前；本地服务器为 command、args、env、env_vars、cwd，远程服务器为 url、
// http_headers
function entry(server) {
    if (server.kind === 'remote') {
        const { url, headers } = server;
        return {
            type: 'http',
            url,
            ...(headers === undefined ? {} : { http_headers: headers }),
        };
    }
    const { command, args, env } = server;
    const retained = retainedEnv(env);
    const values = [...(args ?? []), ...retained.map(([, value]) => value)];
    const usesRoot = values.some(value => value.includes(PLUGIN_ROOT));
    const envVars = mergedEnvVars(server);
    return {
        type: 'stdio',
        command,
        ...(args === undefined ? {} : { args: args.map(withRoot) }),
        ...(retained.length === 0
            ? {}
            : {
                env: Object.fromEntries(retained.map(([key, value]) => [key, withRoot(value)])),
            }),
        ...(envVars === undefined ? {} : { env_vars: envVars }),
        ...(usesRoot ? { cwd: '.' } : {}),
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
// 未声明 envVars 的本地服务器一条，剥离的 ${user_config. 字段一条，其余含 ${ 的字段一条
function risks(written) {
    const messages = [];
    const bare = written.filter(s => s.kind === 'local' && mergedEnvVars(s) === undefined);
    if (bare.length > 0) {
        messages.push(`MCP 服务器 ${bare.map(s => s.name).join('、')} ${ENV_RISK}`);
    }
    const stripped = written.flatMap(strippedFields);
    if (stripped.length > 0) {
        messages.push(`MCP 服务器的字段 ${stripped.join('、')} ${USER_CONFIG_RISK}`);
    }
    const literal = written.flatMap(literalFields);
    if (literal.length > 0)
        messages.push(`MCP 服务器的字段 ${literal.join('、')} ${LITERAL_RISK}`);
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
