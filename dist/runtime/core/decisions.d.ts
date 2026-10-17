import type { AfterTool, BeforePrompt, BeforeStop, BeforeTool } from './types.ts';
export type Checked<T> = {
    readonly ok: true;
    readonly value: T;
} | {
    readonly ok: false;
    readonly reason: string;
};
export declare const INVALID_RESULT_REASON = "uapa: \u5B88\u536B\u8FD4\u56DE\u503C\u65E0\u6548";
export declare function checkBeforeTool(value: unknown, tool: string): Checked<BeforeTool>;
export declare function checkBeforePrompt(value: unknown): Checked<BeforePrompt>;
export declare function checkBeforeStop(value: unknown): Checked<BeforeStop>;
export declare function checkAfterTool(value: unknown): Checked<AfterTool>;
export declare function guardErrorReason(error: unknown): string;
