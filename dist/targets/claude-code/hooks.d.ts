import type { GuardCheck } from '../../runtime/core/types.ts';
import type { TargetPlan } from '../types.ts';
export declare const HOOKS_FILE = "hooks/hooks.json";
export declare const SUBPROCESS_ENTRY = "hooks/uapa-claude-code.mjs";
export declare function commandHooks(checks: readonly GuardCheck[], timeout: number | null): Record<string, unknown[]>;
export declare function hooksKey(guardChecks: readonly GuardCheck[], plan: TargetPlan): Record<string, unknown[]> | null;
