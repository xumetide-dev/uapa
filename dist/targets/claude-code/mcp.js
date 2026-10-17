export const MCP_FILE = '.mcp.json';
const PLUGIN_ROOT = `\${CLAUDE_PLUGIN_ROOT}`;
function withRoot(text) {
    return text.split('{pluginRoot}').join(PLUGIN_ROOT);
}
// 键序固定：本地服务器为 command、args、env，远程服务器为 type、url、headers；未写的字段不写
function entry(server) {
    if (server.kind === 'remote') {
        const { url, headers } = server;
        return { type: 'http', url, ...(headers === undefined ? {} : { headers }) };
    }
    const { command, args, env } = server;
    return {
        command: withRoot(command),
        ...(args === undefined ? {} : { args: args.map(withRoot) }),
        ...(env === undefined
            ? {}
            : {
                env: Object.fromEntries(Object.entries(env).map(([key, value]) => [key, withRoot(value)])),
            }),
    };
}
// servers 已按名称排序；没有服务器时为 null，不生成该文件
export function mcpConfig(servers) {
    if (servers.length === 0)
        return null;
    return { mcpServers: Object.fromEntries(servers.map(s => [s.name, entry(s)])) };
}
