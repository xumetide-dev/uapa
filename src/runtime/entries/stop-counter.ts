// 子进程入口的停机计数（入口与打包接口第 3 节，F-04-05）：按会话保存连续强制继续的次数。
// 读写失败不阻止结束，原因记在 notes 中，由入口写到 stderr。
import {
  accessSync,
  constants,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

export interface StopCounter {
  read(): number
  write(continuations: number): void
  readonly notes: string[] // 写到 stderr 的原因：计数不可用、读写失败与守卫出错
}

// 计数文件为 <dataDir>/uapa-stop-<encodeURIComponent(会话 id)>.json；
// 目录为 null 或不可写时按 0 计，不写文件
export function openStopCounter(dir: string | null, sessionId: string): StopCounter {
  const notes: string[] = []
  if (dir === null) notes.push('uapa: 没有插件数据目录，停机计数按 0 处理')
  const usable = dir !== null && prepareDir(dir, notes)
  const file = usable
    ? join(dir, `uapa-stop-${encodeURIComponent(sessionId)}.json`)
    : null
  return {
    notes,
    read: () => (file === null ? 0 : readCount(file, notes)),
    write(continuations) {
      if (file === null) return
      try {
        const temp = `${file}.${process.pid}.tmp`
        writeFileSync(temp, `${JSON.stringify({ continuations })}\n`)
        renameSync(temp, file)
      } catch (error) {
        notes.push(`uapa: 停机计数写入失败: ${messageOf(error)}`)
      }
    },
  }
}

// 目录不存在时递归创建；不可写时记下原因
function prepareDir(dir: string, notes: string[]): boolean {
  try {
    mkdirSync(dir, { recursive: true })
    accessSync(dir, constants.W_OK)
    return true
  } catch (error) {
    notes.push(`uapa: 插件数据目录不可写，停机计数按 0 处理: ${messageOf(error)}`)
    return false
  }
}

// 文件不存在时为 0（本会话尚未继续过）；读取失败或内容不是非负整数计数时按 0 计并记下原因
function readCount(file: string, notes: string[]): number {
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch (error) {
    if ((error as { code?: unknown }).code === 'ENOENT') return 0
    notes.push(`uapa: 停机计数读取失败，按 0 处理: ${messageOf(error)}`)
    return 0
  }
  const count = continuationsOf(text)
  if (count === null) notes.push(`uapa: 停机计数文件内容无效，按 0 处理: ${file}`)
  return count ?? 0
}

function continuationsOf(text: string): number | null {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null) return null
  const count = (value as Readonly<Record<string, unknown>>).continuations
  return typeof count === 'number' && Number.isInteger(count) && count >= 0
    ? count
    : null
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
