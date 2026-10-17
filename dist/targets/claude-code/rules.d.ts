import type { OutputFile, TargetNote, TargetPlan } from '../types.ts';
export declare const RULES_ENTRY = "hooks/uapa-rules-claude-code.mjs";
export interface ClaudeCodeRules {
    readonly files: readonly OutputFile[];
    readonly command: string | null;
    readonly risks: readonly TargetNote[];
}
export declare function claudeCodeRules(plans: readonly TargetPlan[]): ClaudeCodeRules;
