import { type Loaded } from '../config/issues.ts';
import type { Skill } from './types.ts';
export declare function readSkills(root: string): Promise<Loaded<readonly Skill[]>>;
