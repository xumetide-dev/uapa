import type { UapaConfig } from '../../config/types.ts';
export declare const MANIFEST = ".codex-plugin/plugin.json";
export declare function manifestErrors(config: UapaConfig): string[];
export declare const NO_HOOKS: Readonly<Record<string, unknown>>;
export declare const NO_MCP_SERVERS: Readonly<Record<string, unknown>>;
export interface ManifestRefs {
    readonly hooks: string | typeof NO_HOOKS | null;
    readonly mcpServers: string | typeof NO_MCP_SERVERS | null;
}
export declare function manifest(config: UapaConfig, refs: ManifestRefs): Record<string, unknown>;
