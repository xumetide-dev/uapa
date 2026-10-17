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
    readonly frontmatterKeys: readonly string[];
    readonly targets: readonly TargetName[] | null;
}
export type McpServer = {
    readonly name: string;
    readonly kind: 'local';
    readonly command: string;
    readonly args?: readonly string[];
    readonly env?: Readonly<Record<string, string>>;
    readonly envVars?: readonly string[];
    readonly targets?: readonly TargetName[] | null;
} | {
    readonly name: string;
    readonly kind: 'remote';
    readonly url: string;
    readonly headers?: Readonly<Record<string, string>>;
    readonly targets?: readonly TargetName[] | null;
};
export type RuleActivation = 'always' | 'model' | 'glob';
export interface Rule {
    readonly name: string;
    readonly path: string;
    readonly activation: RuleActivation;
    readonly description: string | null;
    readonly globs: readonly string[];
    readonly body: string;
    readonly targets: readonly TargetName[] | null;
}
export interface Command {
    readonly name: string;
    readonly path: string;
    readonly description: string;
    readonly body: string;
    readonly targets: readonly TargetName[] | null;
}
export interface SourceProject {
    readonly root: string;
    readonly skills: readonly Skill[];
    readonly agents: readonly Agent[];
    readonly mcpServers: readonly McpServer[];
    readonly rules: readonly Rule[];
    readonly commands: readonly Command[];
    readonly overrides: Readonly<Partial<Record<HostName, readonly string[]>>>;
    readonly files: readonly string[];
}
