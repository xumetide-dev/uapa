export type Capability = 'rewriteInput' | 'replaceOutput' | 'withholdOutput' | 'stopGate' | 'promptGate';
export declare const CAPABILITIES: readonly Capability[];
export interface ToolCall {
    readonly sessionId: string;
    readonly tool: string;
    readonly input: Readonly<Record<string, unknown>>;
}
export type BeforeTool = {
    kind: 'allow';
} | {
    kind: 'deny';
    reason: string;
} | {
    kind: 'rewrite';
    input: Record<string, unknown>;
    fallbackReason: string;
};
export type BeforeStop = {
    kind: 'stop';
} | {
    kind: 'continue';
    reason: string;
};
export interface PromptSubmit {
    readonly sessionId: string;
    readonly prompt: string;
}
export type BeforePrompt = {
    kind: 'allow';
} | {
    kind: 'block';
    reason: string;
};
export interface GuardPlugin {
    readonly name: string;
    readonly requires: readonly Capability[];
    beforeTool?(call: ToolCall): BeforeTool | Promise<BeforeTool>;
    beforePrompt?(p: PromptSubmit): BeforePrompt | Promise<BeforePrompt>;
    beforeStop?(s: {
        sessionId: string;
        continuations: number;
    }): BeforeStop | Promise<BeforeStop>;
}
export type GuardCheck = 'beforeTool' | 'beforePrompt' | 'beforeStop';
export declare const GUARD_CHECKS: readonly GuardCheck[];
export type CanonicalTool = 'shell' | 'read_file' | 'edit_file' | 'write_file' | 'glob' | 'grep' | 'web_fetch' | 'web_search' | 'subagent' | 'todo';
export type ToolNameMap = Readonly<Record<string, CanonicalTool>>;
export interface TargetRuntimeData {
    readonly pluginName: string;
    readonly toolNames: ToolNameMap;
    readonly capabilities: Readonly<Record<Capability, boolean>>;
    readonly moduleSessionEnv: string | null;
}
