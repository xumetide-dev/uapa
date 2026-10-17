import type { PluginDir } from '../config/layout.ts';
import type { HostName } from '../config/targets.ts';
import type { OutputFile } from '../targets/types.ts';
import type { PlannedFile } from './outputs.ts';
import type { BuildInput, TargetState } from './state.ts';
export interface HostFile extends PlannedFile {
    readonly conflictHint?: string;
    readonly merge?: 'json-extensions';
}
export interface DirLayers {
    readonly copied: readonly PlannedFile[];
    readonly inPlace: readonly string[];
    readonly shared: readonly PlannedFile[];
}
export interface PlacedFiles {
    readonly files: ReadonlyMap<string, HostFile>;
    readonly conflicts: readonly string[];
}
export declare function sharedFiles(root: string, paths: readonly string[]): Promise<PlannedFile[]>;
export declare function sharedComponentConflicts(root: string, dir: PluginDir, layers: DirLayers): string[];
export declare function hostView(build: BuildInput, dir: PluginDir, host: HostName, generated: readonly OutputFile[], layers: DirLayers, own: readonly TargetState[]): Promise<PlacedFiles>;
export declare function shownIn(root: string, dir: PluginDir, path: string): string;
