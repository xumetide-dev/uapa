import type { Agent, Command, Skill } from '../source/types.ts';
import type { PlannedFile } from './outputs.ts';
import type { TargetState } from './state.ts';
export interface PlacedComponents {
    readonly skills: readonly Skill[];
    readonly agents: readonly Agent[];
    readonly commands: readonly Command[];
}
export declare function componentUnion(targets: readonly TargetState[]): PlacedComponents;
export declare function componentFiles(root: string, placed: PlacedComponents): Promise<PlannedFile[]>;
export declare function componentPaths(placed: PlacedComponents & {
    readonly rules?: readonly {
        readonly name: string;
    }[];
}): string[];
export declare function recordComponentRisks(targets: readonly TargetState[], present: PlacedComponents): void;
