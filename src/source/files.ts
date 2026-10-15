// 源项目读取共用的文件列举：skills（F-01-04）、覆盖目录（F-01-06）与单文件组件 agents、rules、
// commands（F-01-07、F-01-10、F-01-11）。
import { readdir, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { failed, type InputIssue, type Loaded, loaded } from '../config/issues.ts'

// 单文件组件目录下一层的 .md 文件名，按字典序；目录不存在时为空列表，不是目录时失败。子目录与
// 其他文件忽略：Claude Code 把子目录计入组件名，agy 不计，只读一层使两者一致
export async function listMarkdownFiles(
  root: string,
  dirName: string,
): Promise<Loaded<string[]>> {
  const dir = join(root, dirName)
  const info = await orMissing(stat(dir))
  if (info === null) return loaded([])
  if (!info.isDirectory()) {
    return failed([{ file: dirName, field: null, message: `${dirName} 应为目录` }])
  }
  const entries = await readdir(dir, { withFileTypes: true })
  const names = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry => entry.name)
  return loaded(names.sort(compare))
}

// 递归列出目录下的全部文件，相对该目录、POSIX 分隔、按字典序；符号链接等不支持，
// 每个记一条错误，file 为错误所属的文件
export async function listFiles(
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
export async function orMissing<T>(pending: Promise<T>): Promise<T | null> {
  try {
    return await pending
  } catch (error) {
    if ((error as { code?: unknown }).code === 'ENOENT') return null
    throw error
  }
}

// 按 UTF-16 码元比较，与区域设置无关
export function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
