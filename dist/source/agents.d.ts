import { type Loaded } from '../config/issues.ts';
import type { Agent } from './types.ts';
export declare function readAgents(root: string): Promise<Loaded<readonly Agent[]>>;
