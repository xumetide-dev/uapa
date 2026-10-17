import type { TargetCapabilities } from '../capabilities/types.ts';
import type { TargetName } from '../config/targets.ts';
import type { UapaConfig } from '../config/types.ts';
import type { GuardCheck } from '../runtime/core/types.ts';
import type { GuardDeclaration } from '../source/guard.ts';
import type { SourceProject } from '../source/types.ts';
import type { TargetPlan } from '../targets/types.ts';
export interface BuildInput {
    readonly config: UapaConfig;
    readonly root: string;
    readonly source: SourceProject;
    readonly guard: GuardDeclaration | null;
}
export type GatedCheck = Exclude<GuardCheck, 'beforeTool'>;
export interface TargetState {
    readonly target: TargetName;
    readonly capabilities: TargetCapabilities;
    readonly errors: string[];
    readonly skipped: {
        component: string;
        reason: string;
    }[];
    readonly degraded: {
        decision: string;
        as: string;
        reason: string;
    }[];
    readonly overridden: string[];
    readonly omitted: GatedCheck[];
    readonly sharedRisks: string[];
    readonly hostRisks: string[];
    plan: TargetPlan | null;
    unit: string | null;
    readonly marketplaceUnits: string[];
    hostValidation: 'passed' | 'failed' | 'skipped' | 'none';
}
export declare function newState(target: TargetName, capabilities: TargetCapabilities): TargetState;
export declare function succeeded(state: TargetState): boolean;
