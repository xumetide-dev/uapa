export interface InputIssue {
    readonly file: string | null;
    readonly field: string | null;
    readonly message: string;
}
export type Loaded<T> = {
    readonly ok: true;
    readonly value: T;
} | {
    readonly ok: false;
    readonly issues: readonly InputIssue[];
};
export declare function loaded<T>(value: T): Loaded<T>;
export declare function failed<T>(issues: readonly InputIssue[]): Loaded<T>;
export declare function fieldPath(path: readonly PropertyKey[]): string | null;
