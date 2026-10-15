import type { InputIssue } from '../config/issues.ts';
import type { UapaConfig } from '../config/types.ts';
import type { BuildReport } from '../report/types.ts';
export interface FileChange {
    readonly change: 'added' | 'modified' | 'removed';
    readonly path: string;
}
export type BuildOutcome = {
    readonly kind: 'input-error';
    readonly issues: readonly InputIssue[];
} | {
    readonly kind: 'done';
    readonly report: BuildReport;
    readonly reportPath: string | null;
    readonly changes: readonly FileChange[] | null;
};
export declare function build(config: UapaConfig, root: string, options: {
    readonly check: boolean;
}): Promise<BuildOutcome>;
