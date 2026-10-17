import { type HostName } from '../config/targets.ts';
import type { GeneratedHosts } from './generate.ts';
import { type DirOutput } from './outputs.ts';
import { type BuildInput, type TargetState } from './state.ts';
export interface PlannedMarketplace {
    readonly host: HostName;
    readonly targetPath: string;
    readonly shownPath: string;
    readonly content: Buffer;
}
export declare function planMarketplaces(build: BuildInput, states: readonly TargetState[], generated: GeneratedHosts, initialOutputs: readonly DirOutput[]): Promise<{
    outputs: readonly DirOutput[];
    marketplaces: PlannedMarketplace[];
}>;
export declare function writeMarketplaces(states: readonly TargetState[], marketplaces: readonly PlannedMarketplace[]): Promise<void>;
