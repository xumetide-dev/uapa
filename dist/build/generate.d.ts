import type { BundleRequest } from '../bundle/types.ts';
import { type HostName } from '../config/targets.ts';
import type { HostModule, OutputFile } from '../targets/types.ts';
import type { BuildInput, TargetState } from './state.ts';
export interface HostDeps {
    readonly hostModules: Readonly<Record<HostName, HostModule>>;
    readonly bundle: (request: BundleRequest) => Promise<string>;
}
export declare function generateHosts(build: BuildInput, states: readonly TargetState[], deps: HostDeps): Promise<Map<HostName, readonly OutputFile[]>>;
