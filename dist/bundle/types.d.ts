import type { GuardCheck, TargetRuntimeData } from '../runtime/core/types.ts';
interface BundleBase {
    readonly entry: string;
    readonly guardModule: string;
    readonly data: TargetRuntimeData;
}
export type BundleRequest = (BundleBase & {
    readonly external: 'node';
}) | (BundleBase & {
    readonly external: 'claude-code';
    readonly checks: readonly GuardCheck[];
});
export {};
