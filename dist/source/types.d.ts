import type { HostName, TargetName } from '../config/targets.ts';
export interface Skill {
    readonly name: string;
    readonly dir: string;
    readonly files: readonly string[];
    readonly targets: readonly TargetName[] | null;
}
export interface Agent {
    readonly name: string;
    readonly path: string;
    readonly targets: readonly TargetName[] | null;
}
export type McpServer = {
    readonly name: string;
    readonly kind: 'local';
    readonly command: string;
    readonly args?: readonly string[];
    readonly env?: Readonly<Record<string, string>>;
} | {
    readonly name: string;
    readonly kind: 'remote';
    readonly url: string;
    readonly headers?: Readonly<Record<string, string>>;
};
export interface SourceProject {
    readonly root: string;
    readonly skills: readonly Skill[];
    readonly agents: readonly Agent[];
    readonly mcpServers: readonly McpServer[];
    readonly overrides: Readonly<Partial<Record<HostName, readonly string[]>>>;
}
