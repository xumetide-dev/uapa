import type { HostName } from '../../config/targets.ts';
import type { UapaConfig } from '../../config/types.ts';
export declare const MANIFEST = "plugin.json";
export declare const ALT_MANIFEST = ".antigravity-plugin/plugin.json";
export declare const MANIFEST_CONFLICT_HINT: string;
export declare function manifestPathOf(config: UapaConfig, sharedWith: readonly HostName[]): 'plugin.json' | '.antigravity-plugin/plugin.json';
export declare function manifestErrors(config: UapaConfig): string[];
export declare function manifest(config: UapaConfig): Record<string, unknown>;
