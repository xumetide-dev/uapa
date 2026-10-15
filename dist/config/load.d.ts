import { type Loaded } from './issues.ts';
import type { UapaConfig } from './types.ts';
export declare function loadConfig(configPath: string): Promise<Loaded<UapaConfig>>;
