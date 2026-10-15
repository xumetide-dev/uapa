import type { InputIssue } from '../config/issues.ts';
export declare function listFiles(dir: string, file: string, issues: InputIssue[]): Promise<string[]>;
export declare function orMissing<T>(pending: Promise<T>): Promise<T | null>;
export declare function compare(a: string, b: string): number;
