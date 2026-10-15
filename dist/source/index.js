import { readAgents } from './agents.js';
import { readMcpServers } from './mcp.js';
import { readOverrides } from './overrides.js';
import { readSkills } from './skills.js';
export { readGuard } from './guard.js';
export async function readSource(config, root) {
    const skills = await readSkills(root);
    const agents = await readAgents(root);
    const mcpServers = await readMcpServers(root);
    const overrides = await readOverrides(config, root);
    if (!skills.ok || !agents.ok || !mcpServers.ok || !overrides.ok) {
        const issues = [
            ...(skills.ok ? [] : skills.issues),
            ...(agents.ok ? [] : agents.issues),
            ...(mcpServers.ok ? [] : mcpServers.issues),
            ...(overrides.ok ? [] : overrides.issues),
        ];
        return { ok: false, issues };
    }
    const value = {
        root,
        skills: skills.value,
        agents: agents.value,
        mcpServers: mcpServers.value,
        overrides: overrides.value,
    };
    return { ok: true, value };
}
