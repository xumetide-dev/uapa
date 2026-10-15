import { type Loaded } from '../config/issues.ts';
import type { UapaConfig } from '../config/types.ts';
import { type Capability, type GuardCheck } from '../runtime/core/types.ts';
export interface GuardDeclaration {
    readonly modulePath: string;
    readonly name: string;
    readonly requires: readonly Capability[];
    readonly checks: readonly GuardCheck[];
}
export declare function readGuard(config: UapaConfig, root: string): Promise<Loaded<GuardDeclaration | null>>;
