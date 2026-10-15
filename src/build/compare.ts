// 比对模式（F-03-08）：把计划写出的文件与磁盘逐字节比对，不写任何文件。默认布局另列出写入前
// 会被清除的文件；路径相对配置文件所在目录（模块接口 §2），按字典序排列。
import { readdir, readFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { displayPath } from '../config/paths.ts'
import { compare } from '../source/files.ts'
import type { FileChange } from './index.ts'
import type { DirOutput } from './outputs.ts'

export async function compareOutputs(
  root: string,
  outputs: readonly DirOutput[],
): Promise<FileChange[]> {
  const changes: FileChange[] = []
  for (const output of outputs) {
    const dir = output.dir.path
    const shown = (path: string) => displayPath(root, join(dir, ...path.split('/')))
    for (const file of output.files) {
      const existing = await onDisk(join(dir, ...file.path.split('/')))
      if (existing === 'missing')
        changes.push({ change: 'added', path: shown(file.path) })
      else if (existing === 'not-a-file' || !existing.equals(file.content)) {
        changes.push({ change: 'modified', path: shown(file.path) })
      }
    }
    if (output.merged) continue
    const planned = new Set(output.files.map(file => file.path))
    for (const path of await existingFiles(dir)) {
      if (!planned.has(path)) changes.push({ change: 'removed', path: shown(path) })
    }
  }
  return changes.sort((a, b) => compare(a.path, b.path))
}

// 路径不存在（或上级不是目录）时为 missing，是目录时为 not-a-file
async function onDisk(path: string): Promise<Buffer | 'missing' | 'not-a-file'> {
  try {
    return await readFile(path)
  } catch (error) {
    if (isMissing(error)) return 'missing'
    if ((error as { code?: unknown }).code === 'EISDIR') return 'not-a-file'
    throw error
  }
}

// 目录中目录以外的全部项（含符号链接），相对该目录、POSIX 分隔；目录不存在时为空
async function existingFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true })
    return entries
      .filter(entry => !entry.isDirectory())
      .map(entry =>
        relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'),
      )
  } catch (error) {
    if (isMissing(error)) return []
    throw error
  }
}

function isMissing(error: unknown): boolean {
  const code = (error as { code?: unknown }).code
  return code === 'ENOENT' || code === 'ENOTDIR'
}
