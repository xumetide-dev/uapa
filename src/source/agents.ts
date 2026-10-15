// 读取 agents（F-01-07，SD-30）：agents/ 下一层的 <name>.md 与 frontmatter。
// 子目录与其他文件忽略：Claude Code 把子目录计入 agent 名，agy 不计，只读一层使两者一致。
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { failed, type InputIssue, type Loaded, loaded } from '../config/issues.ts'
import { compare, orMissing } from './files.ts'
import { readFrontmatter, readTargets } from './frontmatter.ts'
import type { Agent } from './types.ts'

const EXTENSION = '.md'

export async function readAgents(root: string): Promise<Loaded<readonly Agent[]>> {
  const agentsDir = join(root, 'agents')
  const info = await orMissing(stat(agentsDir))
  if (info === null) return loaded([])
  if (!info.isDirectory()) {
    return failed([{ file: 'agents', field: null, message: 'agents 应为目录' }])
  }
  const entries = await readdir(agentsDir, { withFileTypes: true })
  const agents: Agent[] = []
  const issues: InputIssue[] = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(EXTENSION)) continue
    const result = await readAgent(root, entry.name)
    if (result.ok) agents.push(result.value)
    else issues.push(...result.issues)
  }
  if (issues.length > 0) return failed(issues)
  return loaded(agents.sort((a, b) => compare(a.name, b.name)))
}

async function readAgent(root: string, fileName: string): Promise<Loaded<Agent>> {
  const path = `agents/${fileName}`
  const meta = readFrontmatter(await readFile(join(root, path), 'utf8'), path)
  if (!meta.ok) return meta
  const issues: InputIssue[] = []
  for (const key of ['name', 'description']) {
    const value = meta.value[key]
    if (typeof value !== 'string' || value.trim() === '') {
      issues.push({ file: path, field: key, message: '应为非空字符串' })
    }
  }
  const stem = fileName.slice(0, -EXTENSION.length)
  const name = meta.value.name
  if (typeof name === 'string' && name.trim() !== '' && name !== stem) {
    issues.push({ file: path, field: 'name', message: `与文件名 ${stem} 不一致` })
  }
  const targets = readTargets(meta.value.targets, path, issues)
  if (issues.length > 0) return failed(issues)
  return loaded({ name: stem, path, targets })
}
