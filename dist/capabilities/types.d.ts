import type { HostName, TargetName } from '../config/targets.ts';
import type { CommandHookEvent } from '../config/types.ts';
import type { Capability, GuardCheck, ToolNameMap } from '../runtime/core/types.ts';
export type Carrier = 'package' | 'manifest' | 'none';
export type FailMode = 'allow' | 'deny';
export type Component = 'skills' | 'agents' | 'mcp' | 'hooks';
export interface TargetCapabilities {
    readonly target: TargetName;
    readonly host: {
        readonly name: HostName;
        readonly version: string;
        readonly checked: string;
        readonly source: string;
    };
    readonly components: Readonly<Record<Component, Carrier>>;
    readonly capabilities: Readonly<Record<Capability, boolean>>;
    readonly failureDefault: Readonly<Record<GuardCheck, {
        readonly error: FailMode;
        readonly timeout: FailMode;
    }>>;
    readonly hookTimeoutSeconds: number | null;
    readonly defaultTimeoutSeconds: number | null;
    readonly toolNames: ToolNameMap;
    readonly commandHookEvents: Readonly<Record<CommandHookEvent, string | null>>;
}
