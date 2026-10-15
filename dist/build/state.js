export function newState(target, capabilities) {
    return {
        target,
        capabilities,
        errors: [],
        skipped: [],
        degraded: [],
        overridden: [],
        omitted: [],
        sharedSkillRisks: [],
        hostRisks: [],
        plan: null,
        unit: null,
        hostValidation: 'none',
    };
}
export function succeeded(state) {
    return state.errors.length === 0;
}
