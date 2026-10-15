import { type BuildOutcome, build } from '../build/index.ts';
import { loadConfig } from '../config/load.ts';
export interface Io {
    stdout(text: string): void;
    stderr(text: string): void;
}
export interface CliDeps {
    readonly loadConfig: typeof loadConfig;
    readonly build: typeof build;
}
export declare function run(argv: readonly string[], cwd: string, io: Io, deps?: CliDeps): Promise<number>;
export declare function exitCodeOf(outcome: BuildOutcome): 0 | 1 | 2;
