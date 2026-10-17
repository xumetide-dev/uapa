export const MANIFEST = '.codex-plugin/plugin.json';
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function manifestErrors(config) {
    if (KEBAB_CASE.test(config.name))
        return [];
    return [`插件名 ${config.name} 不是 kebab-case：Codex 以插件名作为组件命名空间`];
}
// 不加载任何 hooks 的 manifest hooks 取值：内联的空 hooks 对象被解析为内联 hooks，空条目跳过且
// 不回退到默认的 hooks/hooks.json；空数组 [] 被解析为未写，仍会读取默认文件
// （codex-source-review.md「manifest 的发现与格式」）
export const NO_HOOKS = { hooks: {} };
// 不读取任何 MCP 服务器的 manifest mcpServers 取值：内联的空对象没有服务器，不回退到插件根的
// .mcp.json（codex-source-review.md「插件中的 MCP 服务器」，按代码推断）
export const NO_MCP_SERVERS = {};
// refs 的字段为 null 时不写。manifest 写了 hooks 或 mcpServers 时 Codex 不再读取默认的
// hooks/hooks.json 或 .mcp.json。键序固定；未配置的可选字段不写；Codex 不读取 author，不写
export function manifest(config, refs) {
    const options = config.hosts?.codex ?? {};
    const { hooks, mcpServers } = refs;
    return {
        name: config.name,
        version: config.version,
        description: config.description,
        ...(config.keywords === undefined ? {} : { keywords: config.keywords }),
        ...(hooks === null ? {} : { hooks }),
        ...(mcpServers === null ? {} : { mcpServers }),
        ...(options.interface === undefined ? {} : { interface: options.interface }),
    };
}
