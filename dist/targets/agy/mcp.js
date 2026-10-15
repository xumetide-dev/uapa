export const MCP_FILE = 'mcp_config.json';
const TARGET = 'agy:subprocess';
const PLUGIN_ROOT = '{pluginRoot}';
const SKIP_REASON = 'agy 不展开 MCP 配置中的插件根，command 的相对路径按哪个目录解析依赖平台，' +
    'command 中的 {pluginRoot} 不能换算';
function withRoot(text) {
    return text.split(PLUGIN_ROOT).join('.');
}
// 键序固定：本地服务器为 command、args、env，远程服务器为 serverUrl、headers
function entry(server) {
    if (server.kind === 'remote') {
        const { url, headers } = server;
        return { serverUrl: url, ...(headers === undefined ? {} : { headers }) };
    }
    const { command, args, env } = server;
    return {
        command,
        ...(args === undefined ? {} : { args: args.map(withRoot) }),
        ...(env === undefined
            ? {}
            : {
                env: Object.fromEntries(Object.entries(env).map(([key, value]) => [key, withRoot(value)])),
            }),
    };
}
// servers 已按名称排序；command 含 {pluginRoot} 的服务器不写入，列为跳过
export function mcpConfig(servers) {
    const skipped = [];
    const entries = [];
    for (const server of servers) {
        if (server.kind === 'local' && server.command.includes(PLUGIN_ROOT)) {
            const component = `mcpServers.${server.name}`;
            skipped.push({ target: TARGET, component, reason: SKIP_REASON });
        }
        else {
            entries.push([server.name, entry(server)]);
        }
    }
    const config = entries.length === 0 ? null : { mcpServers: Object.fromEntries(entries) };
    return { config, skipped };
}
