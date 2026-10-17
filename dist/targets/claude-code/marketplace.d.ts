import type { HostInput, OutputFile } from '../types.ts';
export declare const MARKETPLACE_FILE = ".claude-plugin/marketplace.json";
export declare function marketplaceFiles(input: HostInput): readonly OutputFile[] | undefined;
