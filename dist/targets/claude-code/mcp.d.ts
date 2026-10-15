import type { McpServer } from '../../source/types.ts';
export declare const MCP_FILE = ".mcp.json";
export declare function mcpConfig(servers: readonly McpServer[]): {
    mcpServers: Record<string, unknown>;
} | null;
