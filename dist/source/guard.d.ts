import { type Loaded } from '../config/issues.ts';
import type { UapaConfig } from '../config/types.ts';
import { type Capability, type GuardCheck, type GuardOption, type RuntimeOption } from '../runtime/core/types.ts';
export type GuardOptionDecl = GuardOption & {
    readonly name: string;
};
export interface GuardDeclaration {
    readonly modulePath: string;
    readonly name: string;
    readonly requires: readonly Capability[];
    readonly checks: readonly GuardCheck[];
    readonly options: readonly GuardOptionDecl[];
}
export declare function readGuard(config: UapaConfig, root: string): Promise<Loaded<GuardDeclaration | null>>;
export declare function runtimeOptions(guard: GuardDeclaration): RuntimeOption[];
