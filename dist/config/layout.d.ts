import type { InputIssue } from './issues.ts';
import { type HostName } from './targets.ts';
import type { UapaConfig } from './types.ts';
export interface PluginDir {
    readonly path: string;
    readonly hosts: readonly HostName[];
}
export declare function outDirOf(config: UapaConfig, root: string): string;
export declare function configuredHosts(config: UapaConfig): readonly HostName[];
export declare function resolvePluginDirs(config: UapaConfig, root: string): readonly PluginDir[];
export declare function checkPluginDirs(config: UapaConfig, root: string, file: string): InputIssue[];
