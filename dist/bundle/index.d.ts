import type { BundleRequest } from './types.ts';
export declare function entryPath(entry: string): string;
export declare function bundle(request: BundleRequest): Promise<string>;
