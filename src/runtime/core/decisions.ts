// 守卫返回值检查（入口与打包接口第 4 节，F-04-04）：子进程入口与 hooks 模块入口共用。
// 返回值以检查后新建的对象传出，守卫返回的多余字段不进入宿主输出。
import type { BeforePrompt, BeforeStop, BeforeTool } from './types.ts'

export type Checked<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string }

export const INVALID_RESULT_REASON = 'uapa: 守卫返回值无效'

const invalid = { ok: false, reason: INVALID_RESULT_REASON } as const

function valid<T>(value: T): Checked<T> {
  return { ok: true, value }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isReason(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

// tool 为换算后的规范名；为 'shell' 时 rewrite.input.command 须为非空字符串
export function checkBeforeTool(value: unknown, tool: string): Checked<BeforeTool> {
  if (!isRecord(value)) return invalid
  if (value.kind === 'allow') return valid({ kind: 'allow' })
  if (value.kind === 'deny') {
    return isReason(value.reason)
      ? valid({ kind: 'deny', reason: value.reason })
      : invalid
  }
  if (value.kind !== 'rewrite') return invalid
  const { input, fallbackReason } = value
  if (!isRecord(input) || !isReason(fallbackReason)) return invalid
  const command = input.command
  if (tool === 'shell' && (typeof command !== 'string' || command === '')) {
    return invalid
  }
  return valid({ kind: 'rewrite', input: { ...input }, fallbackReason })
}

export function checkBeforePrompt(value: unknown): Checked<BeforePrompt> {
  if (!isRecord(value)) return invalid
  if (value.kind === 'allow') return valid({ kind: 'allow' })
  if (value.kind === 'block' && isReason(value.reason)) {
    return valid({ kind: 'block', reason: value.reason })
  }
  return invalid
}

export function checkBeforeStop(value: unknown): Checked<BeforeStop> {
  if (!isRecord(value)) return invalid
  if (value.kind === 'stop') return valid({ kind: 'stop' })
  if (value.kind === 'continue' && isReason(value.reason)) {
    return valid({ kind: 'continue', reason: value.reason })
  }
  return invalid
}

export function guardErrorReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return `uapa: 守卫出错: ${message}`
}
