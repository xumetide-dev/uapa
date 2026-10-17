// 读取源项目（F-01-04～F-01-08、F-01-10～F-01-12）。只读，不写文件。
import type { Loaded } from '../config/issues.ts'
import type { UapaConfig } from '../config/types.ts'
import { readAgents } from './agents.ts'
import { readCommands } from './commands.ts'
import { readMcpServers } from './mcp.ts'
import { readOverrides } from './overrides.ts'
import { readRules } from './rules.ts'
import { readSharedFiles } from './shared.ts'
import { readSkills } from './skills.ts'
import type { SourceProject } from './types.ts'

export { readGuard } from './guard.ts'

function val<T>(loaded: Loaded<T>): T {
  if (!loaded.ok) throw new Error('unreachable')
  return loaded.value
}

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
  const files = await readSharedFiles(root)
  const parts = [skills, agents, rules, commands, mcpServers, overrides, files]
  const issues = parts.flatMap(part => (part.ok ? [] : part.issues))
  if (issues.length > 0) return { ok: false, issues }
  const value: SourceProject = {
    root,
    skills: val(skills),
    agents: val(agents),
    mcpServers: val(mcpServers),
    rules: val(rules),
    commands: val(commands),
    overrides: val(overrides),
    files: val(files),
  }
  return { ok: true, value }
}
