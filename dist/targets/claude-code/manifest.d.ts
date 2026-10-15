import type { UapaConfig } from '../../config/types.ts';
export declare function manifestErrors(config: UapaConfig): string[];
export declare function manifest(config: UapaConfig, types: string | null): Record<string, unknown>;
