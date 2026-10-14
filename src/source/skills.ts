// 读取 skills（F-01-04）与 frontmatter 中的目标限定（F-01-05）。
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { parse } from 'yaml'
import { failed, type InputIssue, type Loaded, loaded } from '../config/issues.ts'
import { isTargetName, type TargetName } from '../config/targets.ts'
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

// frontmatter 为文件开头两行 `---` 之间的 YAML 映射
function readFrontmatter(text: string, file: string): Loaded<Record<string, unknown>> {
  const lines = text.split(/\r?\n/)
  const end = lines[0] === '---' ? lines.indexOf('---', 1) : -1
  if (end < 0) {
    return failed([{ file, field: null, message: '缺少以 --- 包围的 frontmatter' }])
  }
  let value: unknown
  try {
    value = parse(lines.slice(1, end).join('\n'))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return failed([
      { file, field: null, message: `frontmatter 不是有效的 YAML：${message}` },
    ])
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return failed([{ file, field: null, message: 'frontmatter 应为映射' }])
  }
  return loaded(value as Record<string, unknown>)
}

// 未写 targets 时为 null（适用于全部目标）；写了就必须是非空的已登记目标名列表
function readTargets(
  value: unknown,
  file: string,
  issues: InputIssue[],
): readonly TargetName[] | null {
  if (value === undefined) return null
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ file, field: 'targets', message: '应为非空的目标名列表' })
    return null
  }
  value.forEach((target, index) => {
    if (!isTargetName(target)) {
      const shown = JSON.stringify(target)
      issues.push({ file, field: `targets[${index}]`, message: `未知目标名 ${shown}` })
    }
  })
  return value.filter(isTargetName)
}

// 递归列出目录下的全部文件，相对该目录、POSIX 分隔、按字典序；符号链接等不支持
async function listFiles(
  dir: string,
  file: string,
  issues: InputIssue[],
): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (entry.isDirectory()) continue
    const path = relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/')
    if (entry.isFile()) files.push(path)
    else
      issues.push({
        file,
        field: null,
        message: `不支持的文件类型（如符号链接）：${path}`,
      })
  }
  return files.sort(compare)
}

// 路径不存在时为 null，其他读取错误照常抛出
async function orMissing<T>(pending: Promise<T>): Promise<T | null> {
  try {
    return await pending
  } catch (error) {
    if ((error as { code?: unknown }).code === 'ENOENT') return null
    throw error
  }
}

// 按 UTF-16 码元比较，与区域设置无关
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
