import type { HostName, TargetName } from './targets.ts';
interface HostDir {
    dir?: string;
}
export interface HostOptions {
    'claude-code': HostDir & {
        displayName?: string;
        userConfig?: unknown;
        dependencies?: unknown;
        $schema?: string;
        manifest?: Readonly<Record<string, unknown>>;
        onFailure?: 'block';
    };
    codex: HostDir & {
        interface?: Readonly<Record<string, unknown>>;
        hooksFile?: string;
    };
    agy: HostDir & {
        manifest?: 'plugin.json' | '.antigravity-plugin/plugin.json';
    };
}
export declare const MANIFEST_RESERVED_KEYS: readonly ['name', 'version', 'description', 'author', 'keywords', 'displayName', 'userConfig', 'dependencies', '$schema', 'types', 'skills', 'agents', 'commands', 'mcpServers'];
export interface MarketplaceConfig {
    name: string;
    owner: {
        name: string;
        email?: string;
    };
    dir?: string;
}
export declare const COMMAND_HOOK_EVENTS: readonly ['SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop'];
export type CommandHookEvent = (typeof COMMAND_HOOK_EVENTS)[number];
export interface CommandHookDecl {
    readonly event: CommandHookEvent;
    readonly command: string;
    readonly targets?: readonly TargetName[];
    readonly timeout?: number;
}
export interface UapaConfig {
    name: string;
    version: string;
    description: string;
    author?: {
        name: string;
        email?: string;
        url?: string;
    };
    keywords?: readonly string[];
    guard?: string;
    targets: readonly TargetName[];
    outDir?: string;
    commandHooks?: readonly CommandHookDecl[];
    marketplace?: MarketplaceConfig;
    hosts?: {
        [H in HostName]?: HostOptions[H];
    };
}
export declare function defineConfig(config: UapaConfig): UapaConfig;
export {};
