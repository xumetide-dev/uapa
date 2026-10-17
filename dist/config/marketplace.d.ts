import type { InputIssue } from './issues.ts';
import type { HostName } from './targets.ts';
import type { UapaConfig } from './types.ts';
export declare const MARKETPLACE_HOSTS: readonly HostName[];
export declare function marketplaceDirOf(config: UapaConfig, root: string): string | null;
export declare function marketplaceSourceOf(config: UapaConfig, root: string, pluginDir: string): string | null;
export declare function checkMarketplace(config: UapaConfig, root: string, file: string): InputIssue[];
