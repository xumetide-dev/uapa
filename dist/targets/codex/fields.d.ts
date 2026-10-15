interface Generated {
    readonly file: string;
    readonly value: Readonly<Record<string, unknown>>;
}
export declare function fieldErrors(manifest: Readonly<Record<string, unknown>>, hooks: Generated | null, mcp?: Generated | null): string[];
export {};
