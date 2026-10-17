import type { HostOptions } from '../../config/types.ts';
import type { GuardCheck } from '../../runtime/core/types.ts';
import type { TargetPlan } from '../types.ts';
export declare const HOOKS_FILE = "hooks/hooks.json";
export declare const SUBPROCESS_ENTRY = "hooks/uapa-claude-code.mjs";
type OnFailure = HostOptions['claude-code']['onFailure'];
export declare function commandHooks(checks: readonly GuardCheck[], timeout: number | null, onFailure?: OnFailure): Record<string, unknown[]>;
export interface HooksKeyOptions {
    readonly rulesCommand: string | null;
    readonly onFailure: OnFailure;
}
export declare function hooksKey(guardChecks: readonly GuardCheck[], plan: TargetPlan | undefined, { rulesCommand, onFailure }: HooksKeyOptions): Record<string, unknown[]> | null;
export {};
