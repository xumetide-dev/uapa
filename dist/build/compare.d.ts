import type { FileChange } from './index.ts';
import type { DirOutput } from './outputs.ts';
export declare function compareOutputs(root: string, outputs: readonly DirOutput[]): Promise<FileChange[]>;
