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
export type AfterTool = {
    kind: 'keep';
} | {
    kind: 'replace';
    text: string;
} | {
    kind: 'withhold';
    reason: string;
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
export type GuardOption = {
    readonly type: 'string';
    readonly title: string;
    readonly description: string;
    readonly default: string;
} | {
    readonly type: 'number';
    readonly title: string;
    readonly description: string;
    readonly default: number;
} | {
    readonly type: 'boolean';
    readonly title: string;
    readonly description: string;
    readonly default: boolean;
};
export type GuardOptionValue = string | number | boolean;
export interface GuardContext {
    readonly options: Readonly<Record<string, GuardOptionValue>>;
}
export interface GuardPlugin {
    readonly name: string;
    readonly requires: readonly Capability[];
    readonly options?: Readonly<Record<string, GuardOption>>;
    beforeTool?(call: ToolCall, ctx: GuardContext): BeforeTool | Promise<BeforeTool>;
    beforePrompt?(p: PromptSubmit, ctx: GuardContext): BeforePrompt | Promise<BeforePrompt>;
    afterTool?(call: ToolCall, output: string, ctx: GuardContext): AfterTool | Promise<AfterTool>;
    beforeStop?(s: {
        sessionId: string;
        continuations: number;
    }, ctx: GuardContext): BeforeStop | Promise<BeforeStop>;
}
export type GuardCheck = 'beforeTool' | 'beforePrompt' | 'beforeStop' | 'afterTool';
export declare const GUARD_CHECKS: readonly GuardCheck[];
export type CanonicalTool = 'shell' | 'read_file' | 'edit_file' | 'write_file' | 'glob' | 'grep' | 'web_fetch' | 'web_search' | 'subagent' | 'todo';
export type ToolNameMap = Readonly<Record<string, CanonicalTool>>;
export interface TargetRuntimeData {
    readonly pluginName: string;
    readonly toolNames: ToolNameMap;
    readonly capabilities: Readonly<Record<Capability, boolean>>;
    readonly moduleSessionEnv: string | null;
    readonly options: readonly RuntimeOption[];
}
export interface RuntimeOption {
    readonly name: string;
    readonly type: GuardOption['type'];
    readonly default: GuardOptionValue;
}
