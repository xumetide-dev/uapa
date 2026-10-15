import type { Rule } from '../../source/types.ts';
import type { OutputFile } from '../types.ts';
export declare function ruleFiles(rules: readonly Rule[]): {
    files: OutputFile[];
    risks: string[];
};
export declare function agyGlob(pattern: string): string;
