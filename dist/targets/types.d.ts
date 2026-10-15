import type { BundleRequest } from '../bundle/types.ts';
import type { TargetCapabilities } from '../capabilities/types.ts';
import type { HostName, TargetName } from '../config/targets.ts';
import type { CommandHookDecl, UapaConfig } from '../config/types.ts';
import type { GuardCheck } from '../runtime/core/types.ts';
import type { GuardDeclaration } from '../source/guard.ts';
import type { Agent, McpServer, Skill } from '../source/types.ts';
export interface TargetPlan {
    readonly target: TargetName;
    readonly capabilities: TargetCapabilities;
    readonly skills: readonly Skill[];
    readonly agents: readonly Agent[];
    readonly mcpServers: readonly McpServer[];
    readonly checks: readonly GuardCheck[];
    readonly commandHooks: readonly CommandHookDecl[];
}
export interface HostInput {
    readonly config: UapaConfig;
    readonly plans: readonly TargetPlan[];
    readonly guard: GuardDeclaration | null;
    readonly sharedWith: readonly HostName[];
    readonly bundle: (request: BundleRequest) => Promise<string>;
}
export interface OutputFile {
    readonly path: string;
    readonly content: string | Uint8Array;
    readonly conflictHint?: string;
}
export interface TargetNote {
    readonly target: TargetName;
    readonly message: string;
}
export interface TargetSkip {
    readonly target: TargetName;
    readonly component: string;
    readonly reason: string;
}
export type HostResult = {
    readonly ok: true;
    readonly files: readonly OutputFile[];
    readonly skipped: readonly TargetSkip[];
    readonly residualRisks: readonly TargetNote[];
} | {
    readonly ok: false;
    readonly errors: readonly TargetNote[];
};
export type VerifyResult = {
    readonly status: 'passed';
} | {
    readonly status: 'failed';
    readonly errors: readonly string[];
} | {
    readonly status: 'skipped';
    readonly reason: string;
};
export interface HostModule {
    readonly host: HostName;
    generate(input: HostInput): Promise<HostResult>;
    verify?(dir: string): Promise<VerifyResult>;
}
