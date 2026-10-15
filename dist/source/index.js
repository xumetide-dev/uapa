import { readOverrides } from './overrides.js';
import { readSkills } from './skills.js';
export { readGuard } from './guard.js';
export async function readSource(config, root) {
    const skills = await readSkills(root);
    const overrides = await readOverrides(config, root);
    if (!skills.ok || !overrides.ok) {
        const issues = [
            ...(skills.ok ? [] : skills.issues),
            ...(overrides.ok ? [] : overrides.issues),
        ];
        return { ok: false, issues };
    }
    return { ok: true, value: { root, skills: skills.value, overrides: overrides.value } };
}
