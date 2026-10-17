import { type Loaded } from '../config/issues.ts';
export declare const SHARED_DIR = "files";
export declare function readSharedFiles(root: string): Promise<Loaded<string[]>>;
