import type { UapaConfig } from '../config/types.ts';
import type { BuildReport } from '../report/types.ts';
import { type TargetState } from './state.ts';
export declare function toReport(states: readonly TargetState[]): BuildReport;
export declare function writeReport(config: UapaConfig, root: string, report: BuildReport): Promise<string>;
