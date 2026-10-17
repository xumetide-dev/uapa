// 守卫选项的取值（F-04-09，入口与打包接口第 3 节）：子进程入口解析宿主给出的文本，hooks 模块
// 入口检查宿主传入的取值。宿主没有给出某个选项时取 default；取值无效时返回该选项名，由入口按
// 守卫出错收口。不做 I/O。
import type { Checked } from './decisions.ts'
import type { GuardContext, GuardOptionValue, RuntimeOption } from './types.ts'

export type OptionsResult =
  | { readonly ok: true; readonly options: Readonly<Record<string, GuardOptionValue>> }
  | { readonly ok: false; readonly name: string } // 按 name 顺序第一个无效的选项

// 文本的解析：string 原样取用；number 要求去掉首尾空白后非空且为有限数；boolean 只接受
// true 与 false
export function optionsFromText(
  declared: readonly RuntimeOption[],
  text: (name: string) => string | undefined,
): OptionsResult {
  return resolve(declared, option => {
    const raw = text(option.name)
    return raw === undefined ? option.default : parseText(option, raw)
  })
}

// values 为 hooks 模块收到的取值（Claude Code 按 userConfig 的类型传入）；不是对象时视为
// 没有取值。缺少该键或为 undefined 时取 default，类型不符或 number 不是有限数时无效
export function optionsFromValues(
  declared: readonly RuntimeOption[],
  values: unknown,
): OptionsResult {
  const given = isRecord(values) ? values : {}
  return resolve(declared, option => {
    const value = Object.hasOwn(given, option.name) ? given[option.name] : undefined
    if (value === undefined) return option.default
    return isValueOf(option, value) ? value : null
  })
}

function resolve(
  declared: readonly RuntimeOption[],
  pick: (option: RuntimeOption) => GuardOptionValue | null,
): OptionsResult {
  const options: Record<string, GuardOptionValue> = {}
  for (const option of declared) {
    const value = pick(option)
    if (value === null) return { ok: false, name: option.name }
    options[option.name] = value
  }
  return { ok: true, options }
}

function parseText(option: RuntimeOption, raw: string): GuardOptionValue | null {
  if (option.type === 'string') return raw
  if (option.type === 'boolean') {
    if (raw === 'true') return true
    if (raw === 'false') return false
    return null
  }
  if (raw.trim() === '') return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function isValueOf(option: RuntimeOption, value: unknown): value is GuardOptionValue {
  if (typeof value !== option.type) return false
  return typeof value !== 'number' || Number.isFinite(value)
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// 传给检查方法的 GuardContext；取值无效时为守卫出错的原因（F-04-09），两种入口都在
// callGuard 中据此不调用守卫，按守卫出错收口
export function guardContext(
  result: OptionsResult,
  cwd: string | null = null,
): Checked<GuardContext> {
  if (!result.ok) return { ok: false, reason: `uapa: 守卫选项无效: ${result.name}` }
  return { ok: true, value: { options: result.options, cwd } }
}
