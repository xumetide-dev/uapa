// 读取 skills（F-01-04）与 frontmatter 中的目标限定（F-01-05）。
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { failed, type InputIssue, type Loaded, loaded } from '../config/issues.ts'
import { compare, listFiles, orMissing } from './files.ts'
import { readFrontmatter, readTargets } from './frontmatter.ts'
import type { Skill } from './types.ts'

export async function readSkills(root: string): Promise<Loaded<readonly Skill[]>> {
  const skillsDir = join(root, 'skills')
  const info = await orMissing(stat(skillsDir))
  if (info === null) return loaded([])
  if (!info.isDirectory()) {
    return failed([{ file: 'skills', field: null, message: 'skills 应为目录' }])
  }
  const entries = await readdir(skillsDir, { withFileTypes: true })
  const skills: Skill[] = []
  const issues: InputIssue[] = []
  // 不是目录的项（如说明文件）忽略
  for (const entry of entries.filter(e => e.isDirectory())) {
    const result = await readSkill(root, entry.name)
    if (result.ok) skills.push(result.value)
    else issues.push(...result.issues)
  }
  if (issues.length > 0) return failed(issues)
  return loaded(skills.sort((a, b) => compare(a.name, b.name)))
}

async function readSkill(root: string, dirName: string): Promise<Loaded<Skill>> {
  const dir = `skills/${dirName}`
  const file = `${dir}/SKILL.md`
  const text = await orMissing(readFile(join(root, dir, 'SKILL.md'), 'utf8'))
  if (text === null)
    return failed([{ file: dir, field: null, message: '缺少 SKILL.md' }])
  const meta = readFrontmatter(text, file)
  if (!meta.ok) return meta
  const issues: InputIssue[] = []
  for (const key of ['name', 'description']) {
    const value = meta.value[key]
    if (typeof value !== 'string' || value.trim() === '') {
      issues.push({ file, field: key, message: '应为非空字符串' })
    }
  }
  const name = meta.value.name
  if (typeof name === 'string' && name !== dirName) {
    issues.push({ file, field: 'name', message: `与目录名 ${dirName} 不一致` })
  }
  const targets = readTargets(meta.value.targets, file, issues)
  const files = await listFiles(join(root, dir), file, issues)
  if (issues.length > 0) return failed(issues)
  return loaded({ name: dirName, dir, files, targets })
}
