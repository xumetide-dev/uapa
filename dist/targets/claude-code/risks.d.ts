import type { HostInput, TargetNote, TargetPlan } from '../types.ts';
export interface ClaudeCodeForms {
    readonly subprocess: TargetPlan | undefined;
    readonly inProcess: TargetPlan | undefined;
    readonly moduleWritten: boolean;
}
export declare function claudeCodeRisks(input: HostInput, forms: ClaudeCodeForms): TargetNote[];
