import { type Loaded } from '../config/issues.ts';
import type { Command } from './types.ts';
export declare function readCommands(root: string): Promise<Loaded<readonly Command[]>>;
