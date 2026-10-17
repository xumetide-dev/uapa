import type { OutputFile, TargetPlan, TargetSkip } from '../types.ts';
export declare const RULES_ENTRY = "hooks/uapa-rules-codex.mjs";
export interface CodexRules {
    readonly files: readonly OutputFile[];
    readonly command: string | null;
    readonly skipped: readonly TargetSkip[];
    readonly risks: readonly string[];
}
export declare function codexRules(plan: TargetPlan, pluginName: string): CodexRules;
