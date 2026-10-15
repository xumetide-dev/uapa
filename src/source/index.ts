// 读取源项目（F-01-04～F-01-08、F-01-10、F-01-11）。只读，不写文件。
import type { Loaded } from '../config/issues.ts'
import type { UapaConfig } from '../config/types.ts'
import { readAgents } from './agents.ts'
import { readCommands } from './commands.ts'
import { readMcpServers } from './mcp.ts'
import { readOverrides } from './overrides.ts'
import { readRules } from './rules.ts'
import { readSkills } from './skills.ts'
import type { SourceProject } from './types.ts'

export { readGuard } from './guard.ts'

export async function readSource(
  config: UapaConfig,
  root: string,
): Promise<Loaded<SourceProject>> {
  const skills = await readSkills(root)
  const agents = await readAgents(root)
  const rules = await readRules(root)
  const commands = await readCommands(root)
  const mcpServers = await readMcpServers(root)
  const overrides = await readOverrides(config, root)
  if (
    !skills.ok ||
    !agents.ok ||
    !rules.ok ||
    !commands.ok ||
    !mcpServers.ok ||
    !overrides.ok
  ) {
    const issues = [
      ...(skills.ok ? [] : skills.issues),
      ...(agents.ok ? [] : agents.issues),
      ...(rules.ok ? [] : rules.issues),
      ...(commands.ok ? [] : commands.issues),
      ...(mcpServers.ok ? [] : mcpServers.issues),
      ...(overrides.ok ? [] : overrides.issues),
    ]
    return { ok: false, issues }
  }
  const value = {
    root,
    skills: skills.value,
    agents: agents.value,
    mcpServers: mcpServers.value,
    rules: rules.value,
    commands: commands.value,
    overrides: overrides.value,
  }
  return { ok: true, value }
}
