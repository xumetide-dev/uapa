import type { McpServer } from '../../source/types.ts';
import type { TargetSkip } from '../types.ts';
export declare const MCP_FILE = "mcp.json";
export interface McpOutput {
    readonly config: {
        mcpServers: Record<string, unknown>;
    } | null;
    readonly skipped: readonly TargetSkip[];
    readonly risks: readonly string[];
}
export declare function mcpConfig(servers: readonly McpServer[]): McpOutput;
