import { type Loaded } from '../config/issues.ts';
import type { UapaConfig } from '../config/types.ts';
import type { SourceProject } from './types.ts';
export declare const OVERRIDES_DIR = "overrides";
export declare function readOverrides(config: UapaConfig, root: string): Promise<Loaded<SourceProject['overrides']>>;
