import { readAgents } from './agents.js';
import { readCommands } from './commands.js';
import { readMcpServers } from './mcp.js';
import { readOverrides } from './overrides.js';
import { readRules } from './rules.js';
import { readSkills } from './skills.js';
export { readGuard } from './guard.js';
export async function readSource(config, root) {
    const skills = await readSkills(root);
    const agents = await readAgents(root);
    const rules = await readRules(root);
    const commands = await readCommands(root);
    const mcpServers = await readMcpServers(root);
    const overrides = await readOverrides(config, root);
    if (!skills.ok ||
        !agents.ok ||
        !rules.ok ||
        !commands.ok ||
        !mcpServers.ok ||
        !overrides.ok) {
        const issues = [
            ...(skills.ok ? [] : skills.issues),
            ...(agents.ok ? [] : agents.issues),
            ...(rules.ok ? [] : rules.issues),
            ...(commands.ok ? [] : commands.issues),
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
        rules: rules.value,
        commands: commands.value,
        overrides: overrides.value,
    };
    return { ok: true, value };
}
