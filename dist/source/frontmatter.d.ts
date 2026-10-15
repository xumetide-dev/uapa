import { type InputIssue, type Loaded } from '../config/issues.ts';
import { type TargetName } from '../config/targets.ts';
export declare function readFrontmatter(text: string, file: string): Loaded<Record<string, unknown>>;
export declare function readTargets(value: unknown, file: string, issues: InputIssue[]): readonly TargetName[] | null;
