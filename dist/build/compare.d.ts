import type { FileChange } from './index.ts';
import type { PlannedMarketplace } from './marketplace.ts';
import type { DirOutput } from './outputs.ts';
export declare function compareOutputs(root: string, outputs: readonly DirOutput[], marketplaces?: readonly PlannedMarketplace[]): Promise<FileChange[]>;
