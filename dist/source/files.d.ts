import { type InputIssue, type Loaded } from '../config/issues.ts';
export declare function listMarkdownFiles(root: string, dirName: string): Promise<Loaded<string[]>>;
export declare function listFiles(dir: string, file: string, issues: InputIssue[]): Promise<string[]>;
export declare function orMissing<T>(pending: Promise<T>): Promise<T | null>;
export declare function compare(a: string, b: string): number;
