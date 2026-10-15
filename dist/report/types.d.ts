export interface BuildReport {
    readonly targets: readonly TargetReport[];
}
export interface TargetReport {
    readonly target: string;
    readonly status: 'ok' | 'failed';
    readonly errors: readonly string[];
    readonly host: {
        readonly name: string;
        readonly version: string;
        readonly checked: string;
        readonly source: string;
    };
    readonly units: readonly {
        readonly kind: string;
        readonly path: string;
    }[];
    readonly skipped: readonly {
        readonly component: string;
        readonly reason: string;
    }[];
    readonly degraded: readonly {
        readonly decision: string;
        readonly as: string;
        readonly reason: string;
    }[];
    readonly overridden: readonly string[];
    readonly hostValidation: 'passed' | 'failed' | 'skipped' | 'none';
    readonly residualRisks: readonly string[];
}
