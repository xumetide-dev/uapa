import { type HostTool } from '../core/tools.ts';
export type CheckArg = 'before-tool' | 'before-prompt' | 'before-stop' | 'after-tool';
export interface HostEvent {
    readonly sessionId: string;
    readonly tool?: HostTool;
    readonly prompt?: string;
    readonly toolOutput?: unknown;
}
export interface ProcessOutput {
    readonly exitCode: 0 | 2;
    readonly stdout?: string;
    readonly stderr?: string;
}
type Env = Readonly<Record<string, string | undefined>>;
export interface SubprocessProtocol {
    parse(check: CheckArg, stdin: unknown): HostEvent;
    skip?(event: HostEvent, env: Env): boolean;
    allow(check: CheckArg): ProcessOutput;
    deny(check: CheckArg, reason: string): ProcessOutput;
    rewriteShell?(hostInput: Readonly<Record<string, unknown>>, command: string): ProcessOutput;
    continueStop(reason: string): ProcessOutput;
    replaceOutput?(output: unknown): ProcessOutput;
    blockOutput?(text: string): ProcessOutput;
    dataDir(env: Env): string | null;
}
export declare function runSubprocessEntry(protocol: SubprocessProtocol): Promise<void>;
export {};
