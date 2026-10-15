import { type Loaded } from './issues.ts';
import { type UapaConfig } from './types.ts';
export declare function validateConfig(value: unknown, file: string, root: string): Loaded<UapaConfig>;
