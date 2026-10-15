export declare const HOSTS: readonly ['claude-code', 'codex', 'agy'];
export type HostName = (typeof HOSTS)[number];
export declare const TARGETS: readonly ['claude-code:in-process', 'claude-code:subprocess', 'codex:subprocess', 'agy:subprocess'];
export type TargetName = (typeof TARGETS)[number];
export declare function isTargetName(value: unknown): value is TargetName;
export declare function hostOf(target: TargetName): HostName;
