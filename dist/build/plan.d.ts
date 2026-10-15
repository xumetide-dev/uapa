import type { TargetCapabilities } from '../capabilities/types.ts';
import { type TargetName } from '../config/targets.ts';
import type { UapaConfig } from '../config/types.ts';
import type { GuardDeclaration } from '../source/guard.ts';
import type { SourceProject } from '../source/types.ts';
import { type TargetState } from './state.ts';
export declare function planTargets(config: UapaConfig, source: SourceProject, guard: GuardDeclaration | null, capabilities: Readonly<Record<TargetName, TargetCapabilities>>): TargetState[];
