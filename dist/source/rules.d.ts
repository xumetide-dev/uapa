import { type Loaded } from '../config/issues.ts';
import type { Rule } from './types.ts';
export declare function readRules(root: string): Promise<Loaded<readonly Rule[]>>;
