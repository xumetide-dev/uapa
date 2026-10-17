import { readAgents } from './agents.js';
import { readCommands } from './commands.js';
import { readMcpServers } from './mcp.js';
import { readOverrides } from './overrides.js';
import { readRules } from './rules.js';
import { readSharedFiles } from './shared.js';
import { readSkills } from './skills.js';
export { readGuard } from './guard.js';
function val(loaded) {
    if (!loaded.ok)
        throw new Error('unreachable');
    return loaded.value;
}
export async function readSource(config, root) {
    const skills = await readSkills(root);
    const agents = await readAgents(root);
    const rules = await readRules(root);
    const commands = await readCommands(root);
    const mcpServers = await readMcpServers(root);
    const overrides = await readOverrides(config, root);
    const files = await readSharedFiles(root);
    const parts = [skills, agents, rules, commands, mcpServers, overrides, files];
    const issues = parts.flatMap(part => (part.ok ? [] : part.issues));
    if (issues.length > 0)
        return { ok: false, issues };
    const value = {
        root,
        skills: val(skills),
        agents: val(agents),
        mcpServers: val(mcpServers),
        rules: val(rules),
        commands: val(commands),
        overrides: val(overrides),
        files: val(files),
    };
    return { ok: true, value };
}
