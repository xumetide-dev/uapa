import type { TargetCapabilities } from '../capabilities/types.ts';
import type { TargetName } from '../config/targets.ts';
import type { UapaConfig } from '../config/types.ts';
import { type HostDeps } from './generate.ts';
import type { BuildOutcome } from './index.ts';
export interface BuildDeps extends HostDeps {
    readonly targetCapabilities: Readonly<Record<TargetName, TargetCapabilities>>;
}
export declare function runBuild(config: UapaConfig, root: string, options: {
    readonly check: boolean;
}, deps: BuildDeps): Promise<BuildOutcome>;
