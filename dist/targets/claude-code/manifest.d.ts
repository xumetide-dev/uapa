import type { UapaConfig } from '../../config/types.ts';
import type { GuardOptionDecl } from '../../source/guard.ts';
export declare function manifestErrors(config: UapaConfig): string[];
export type UserConfigResult = {
    readonly ok: true;
    readonly value: unknown;
} | {
    readonly ok: false;
    readonly errors: readonly string[];
};
export declare function userConfig(config: UapaConfig, guardOptions: readonly GuardOptionDecl[]): UserConfigResult;
export declare function manifest(config: UapaConfig, types: string | null, userConfigValue: unknown): Record<string, unknown>;
