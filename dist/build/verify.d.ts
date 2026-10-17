import { type HostName } from '../config/targets.ts';
import type { UapaConfig } from '../config/types.ts';
import type { HostModule } from '../targets/types.ts';
import type { TargetState } from './state.ts';
export declare function verifyHosts(config: UapaConfig, root: string, states: readonly TargetState[], hostModules: Readonly<Record<HostName, HostModule>>): Promise<void>;
