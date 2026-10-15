export interface MergeInput {
    readonly content: Buffer;
    readonly merge?: 'json-extensions';
}
export declare function mergeJsonExtensions(files: readonly MergeInput[]): Buffer | null;
