import type { BeforeTool, ToolCall, ToolNameMap } from './types.ts';
export interface HostTool {
    readonly name: string;
    readonly input: Readonly<Record<string, unknown>>;
    readonly command?: string;
}
export type ToolCallResult = {
    readonly ok: true;
    readonly call: ToolCall;
} | {
    readonly ok: false;
    readonly field: string;
};
export type ToolDecision = {
    readonly kind: 'allow';
} | {
    readonly kind: 'deny';
    readonly reason: string;
} | {
    readonly kind: 'rewriteShell';
    readonly command: string;
    readonly fallbackReason: string;
};
export declare function canonicalToolName(hostName: string, toolNames: ToolNameMap): string;
export declare function toToolCall(sessionId: string, tool: HostTool, toolNames: ToolNameMap): ToolCallResult;
export declare function resolveToolDecision(decision: BeforeTool, tool: string, rewriteInput: boolean): ToolDecision;
