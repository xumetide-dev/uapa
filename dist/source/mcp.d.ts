import { type Loaded } from '../config/issues.ts';
import type { McpServer } from './types.ts';
export declare function readMcpServers(root: string): Promise<Loaded<readonly McpServer[]>>;
