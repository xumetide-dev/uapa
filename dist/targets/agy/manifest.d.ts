import type { UapaConfig } from '../../config/types.ts';
export declare const MANIFEST = "plugin.json";
export declare const MANIFEST_CONFLICT_HINT: string;
export declare function manifestErrors(config: UapaConfig): string[];
export declare function manifest(config: UapaConfig): Record<string, unknown>;
