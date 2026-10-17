import type { TargetName } from '../config/targets.ts';
import type { UapaConfig } from '../config/types.ts';
import type { TargetCapabilities } from './types.ts';
export declare const targetCapabilities: Readonly<Record<TargetName, TargetCapabilities>>;
export declare function capabilitiesFor(config: UapaConfig): Readonly<Record<TargetName, TargetCapabilities>>;
