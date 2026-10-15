import type { HostName, TargetName } from '../config/targets.ts';
export interface Skill {
    readonly name: string;
    readonly dir: string;
    readonly files: readonly string[];
    readonly targets: readonly TargetName[] | null;
}
export interface SourceProject {
    readonly root: string;
    readonly skills: readonly Skill[];
    readonly overrides: Readonly<Partial<Record<HostName, readonly string[]>>>;
}
