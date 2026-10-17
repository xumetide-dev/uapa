import type { Command } from '../../source/types.ts';
import type { TargetSkip } from '../types.ts';
export declare function commandSkips(target: TargetSkip['target'], commands: readonly Command[]): TargetSkip[];
