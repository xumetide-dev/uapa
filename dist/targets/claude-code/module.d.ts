import type { HostInput, OutputFile, TargetPlan } from '../types.ts';
export declare const MODULE_ENTRY = "hooks/register.ts";
export declare const MODULE_GUARD = "hooks/uapa-guard.mjs";
export declare const TYPES_FILE = "types/index.d.ts";
export declare const MODULES: string[];
export declare function moduleSessionEnv(pluginName: string): string;
export interface ModuleFiles {
    readonly files: readonly OutputFile[];
    readonly types: string | null;
}
export declare function moduleFiles(input: HostInput, plan: TargetPlan, sessionEnv: string | null): Promise<ModuleFiles | null>;
