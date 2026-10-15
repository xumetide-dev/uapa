import type { UapaConfig } from '../../config/types.ts';
export declare const MANIFEST = ".codex-plugin/plugin.json";
export declare function manifestErrors(config: UapaConfig): string[];
export declare const NO_HOOKS: Readonly<Record<string, unknown>>;
export declare function manifest(config: UapaConfig, hooks: string | typeof NO_HOOKS | null): Record<string, unknown>;
