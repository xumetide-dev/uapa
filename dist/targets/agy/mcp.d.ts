import type { McpServer } from '../../source/types.ts';
import type { TargetSkip } from '../types.ts';
export declare const MCP_FILE = "mcp_config.json";
export interface McpOutput {
    readonly config: {
        mcpServers: Record<string, unknown>;
    } | null;
    readonly skipped: readonly TargetSkip[];
}
export declare function mcpConfig(servers: readonly McpServer[]): McpOutput;
