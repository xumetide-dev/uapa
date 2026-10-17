import type { TargetName } from '../../config/targets.ts';
import type { HostInput, TargetNote, TargetPlan } from '../types.ts';
export declare const TARGET: TargetName;
export declare function hooksRisks(input: HostInput, plan: TargetPlan, hooksFile: string): TargetNote[];
export declare function mcpRisks(): TargetNote[];
