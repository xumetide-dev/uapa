import type { UapaConfig } from '../../config/types.ts';
import type { GuardCheck } from '../../runtime/core/types.ts';
import type { TargetPlan } from '../types.ts';
export declare const DEFAULT_HOOKS_FILE = "hooks/hooks.json";
export declare const SUBPROCESS_ENTRY = "hooks/uapa-codex.mjs";
export declare const HOOKS_CONFLICT_HINT = "\u8BBE\u7F6E hosts.codex.hooksFile \u6539\u7528\u72EC\u7ACB\u7684 hooks \u6587\u4EF6";
export declare function hooksFileOf(config: UapaConfig): string;
export declare function codexHooks(checks: readonly GuardCheck[], timeout: number | null): {
    hooks: Record<string, unknown[]>;
};
export declare function hooksConfig(guardChecks: readonly GuardCheck[], plan: TargetPlan, rulesCommand: string | null): {
    hooks: Record<string, unknown[]>;
} | null;
