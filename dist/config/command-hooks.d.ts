import { z } from 'zod';
import type { InputIssue } from './issues.ts';
import { type UapaConfig } from './types.ts';
export declare const targetName: z.ZodEnum<{
    "agy:subprocess": "agy:subprocess";
    "claude-code:in-process": "claude-code:in-process";
    "claude-code:subprocess": "claude-code:subprocess";
    "codex:subprocess": "codex:subprocess";
}>;
export declare function noDuplicateTargets(targets: readonly string[], ctx: z.RefinementCtx): void;
export declare const commandHook: z.ZodObject<{
    event: z.ZodEnum<{
        PostToolUse: "PostToolUse";
        PreToolUse: "PreToolUse";
        SessionEnd: "SessionEnd";
        SessionStart: "SessionStart";
        Stop: "Stop";
        UserPromptSubmit: "UserPromptSubmit";
    }>;
    command: z.ZodString;
    targets: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        "agy:subprocess": "agy:subprocess";
        "claude-code:in-process": "claude-code:in-process";
        "claude-code:subprocess": "claude-code:subprocess";
        "codex:subprocess": "codex:subprocess";
    }>>>;
    timeout: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export declare function unconfiguredHookTargets(config: UapaConfig, file: string): InputIssue[];
