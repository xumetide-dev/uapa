import type { Checked } from './decisions.ts';
import type { GuardContext, GuardOptionValue, RuntimeOption } from './types.ts';
export type OptionsResult = {
    readonly ok: true;
    readonly options: Readonly<Record<string, GuardOptionValue>>;
} | {
    readonly ok: false;
    readonly name: string;
};
export declare function optionsFromText(declared: readonly RuntimeOption[], text: (name: string) => string | undefined): OptionsResult;
export declare function optionsFromValues(declared: readonly RuntimeOption[], values: unknown): OptionsResult;
export declare function guardContext(result: OptionsResult): Checked<GuardContext>;
