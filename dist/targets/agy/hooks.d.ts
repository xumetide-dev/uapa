import type { GuardCheck } from '../../runtime/core/types.ts';
import type { TargetPlan } from '../types.ts';
export declare const HOOKS_FILE = "hooks.json";
export declare const SUBPROCESS_ENTRY = "hooks/uapa-agy.mjs";
export declare function agyHooks(pluginName: string, checks: readonly GuardCheck[], timeout: number | null): Record<string, unknown>;
export declare function hooksConfig(pluginName: string, guardChecks: readonly GuardCheck[], plan: TargetPlan): Record<string, unknown> | null;
