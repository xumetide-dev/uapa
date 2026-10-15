import { type Loaded } from './issues.ts';
export declare function importModule(path: string, root: string): Promise<Loaded<Record<string, unknown>>>;
