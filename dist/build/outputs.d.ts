import { type PluginDir } from '../config/layout.ts';
import { type HostName } from '../config/targets.ts';
import type { OutputFile } from '../targets/types.ts';
import { type BuildInput, type TargetState } from './state.ts';
export interface PlannedFile {
    readonly path: string;
    readonly content: Buffer;
    readonly copyFrom: string | null;
}
export interface DirOutput {
    readonly dir: PluginDir;
    readonly merged: boolean;
    readonly files: readonly PlannedFile[];
    readonly targets: readonly TargetState[];
}
export declare function planOutputs(build: BuildInput, states: readonly TargetState[], hostFiles: ReadonlyMap<HostName, readonly OutputFile[]>): Promise<DirOutput[]>;
