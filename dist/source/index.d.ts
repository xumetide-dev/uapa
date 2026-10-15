import type { Loaded } from '../config/issues.ts';
import type { UapaConfig } from '../config/types.ts';
import type { SourceProject } from './types.ts';
export { readGuard } from './guard.ts';
export declare function readSource(config: UapaConfig, root: string): Promise<Loaded<SourceProject>>;
