// 构建时读取守卫声明（F-02-03、F-02-05）：导入配置 guard 指定的守卫逻辑，
// 检查默认导出是否符合 GuardPlugin，并得出按名称排序的选项。
import { resolve } from 'node:path'
import { importModule } from '../config/import.ts'
import { failed, type InputIssue, type Loaded, loaded } from '../config/issues.ts'
import { displayPath } from '../config/paths.ts'
import type { UapaConfig } from '../config/types.ts'
import {
  CAPABILITIES,
  type Capability,
  GUARD_CHECKS,
  type GuardCheck,
  type GuardOption,
  type RuntimeOption,
} from '../runtime/core/types.ts'
import { compare } from './files.ts'

export type GuardOptionDecl = GuardOption & { readonly name: string }

export interface GuardDeclaration {
  readonly modulePath: string // 守卫逻辑的绝对路径，供打包使用
  readonly name: string // 只用于错误信息，不写入构建报告
  readonly requires: readonly Capability[]
  readonly checks: readonly GuardCheck[] // 默认导出上存在的方法
  readonly options: readonly GuardOptionDecl[] // 默认导出的 options，按 name 排序；没有时为空
}

// 选项名以字母开头，只含字母、数字与 _：Claude Code 以全大写的选项名作环境变量名
const OPTION_NAME = /^[A-Za-z][A-Za-z0-9_]*$/
const OPTION_TYPES = ['string', 'number', 'boolean']
const OPTION_KEYS = ['type', 'title', 'description', 'default']

export async function readGuard(
  config: UapaConfig,
  root: string,
): Promise<Loaded<GuardDeclaration | null>> {
  if (config.guard === undefined) return loaded(null)
  const modulePath = resolve(root, config.guard)
  const module = await importModule(modulePath, root)
  if (!module.ok) return module
  const file = displayPath(root, modulePath)
  const value = module.value.default
  if (typeof value !== 'object' || value === null) {
    return failed([
      { file, field: null, message: '默认导出缺失或不是 GuardPlugin 对象' },
    ])
  }
  const guard = value as Record<string, unknown>
  const issues = [...checkGuard(guard, file), ...checkOptions(guard.options, file)]
  if (issues.length > 0) return failed(issues)
  return loaded({
    modulePath,
    name: guard.name as string,
    requires: guard.requires as Capability[],
    checks: GUARD_CHECKS.filter(check => typeof guard[check] === 'function'),
    options: optionsOf(guard.options),
  })
}

function checkGuard(guard: Record<string, unknown>, file: string): InputIssue[] {
  const issues: InputIssue[] = []
  const issue = (field: string, message: string) =>
    issues.push({ file, field, message })
  if (typeof guard.name !== 'string' || guard.name.trim() === '') {
    issue('name', '应为非空字符串')
  }
  if (!Array.isArray(guard.requires)) issue('requires', '应为能力名列表')
  else {
    guard.requires.forEach((capability: unknown, index) => {
      const field = `requires[${index}]`
      if (!CAPABILITIES.includes(capability as Capability)) {
        issue(field, `未知能力 ${JSON.stringify(capability)}`)
      }
    })
  }
  for (const check of GUARD_CHECKS) {
    if (guard[check] !== undefined && typeof guard[check] !== 'function') {
      issue(check, '应为函数')
    }
  }
  return issues
}

// 写入打包数据的选项（F-04-09）：title 与 description 只写入 Claude Code 的 userConfig
export function runtimeOptions(guard: GuardDeclaration): RuntimeOption[] {
  return guard.options.map(({ name, type, default: value }) => ({
    name,
    type,
    default: value,
  }))
}

// 选项（F-02-05）：名称、全大写后不重名、四个键，title 与 description 为非空单行字符串，
// default 与 type 一致且 number 为有限数。sensitive、multiple 等其他键不支持（SD-35）
function checkOptions(options: unknown, file: string): InputIssue[] {
  if (options === undefined) return []
  if (!isRecord(options)) {
    return [{ file, field: 'options', message: '应为选项名到选项的映射' }]
  }
  const issues: InputIssue[] = []
  const upperNames = new Map<string, string>()
  for (const [name, option] of Object.entries(options)) {
    const at = `options.${name}`
    if (!OPTION_NAME.test(name)) {
      issues.push({ file, field: at, message: '选项名应以字母开头，只含字母、数字、_' })
    }
    const same = upperNames.get(name.toUpperCase())
    if (same !== undefined) {
      issues.push({ file, field: at, message: `全大写后与选项 ${same} 相同` })
    }
    upperNames.set(name.toUpperCase(), name)
    issues.push(...checkOption(option, file, at))
  }
  return issues
}

function checkOption(option: unknown, file: string, at: string): InputIssue[] {
  if (!isRecord(option)) return [{ file, field: at, message: '应为对象' }]
  const issues: InputIssue[] = []
  const issue = (key: string, message: string) =>
    issues.push({ file, field: `${at}.${key}`, message })
  for (const key of Object.keys(option).filter(k => !OPTION_KEYS.includes(k))) {
    issue(key, '不支持的键')
  }
  const type = option.type
  if (typeof type !== 'string' || !OPTION_TYPES.includes(type)) {
    issue('type', '应为 string、number 或 boolean')
  }
  for (const key of ['title', 'description']) {
    if (!isSingleLine(option[key])) issue(key, '应为非空单行字符串')
  }
  const value = option.default
  if (typeof type === 'string' && OPTION_TYPES.includes(type)) {
    const matches =
      typeof value === type && (typeof value !== 'number' || Number.isFinite(value))
    if (!matches) issue('default', `应为与 type 一致的 ${type} 取值`)
  }
  return issues
}

// 已通过 checkOptions 的选项，按名称排序
function optionsOf(options: unknown): GuardOptionDecl[] {
  if (!isRecord(options)) return []
  const declared = Object.entries(options).map(
    ([name, option]) => ({ ...(option as GuardOption), name }) as GuardOptionDecl,
  )
  return declared.sort((a, b) => compare(a.name, b.name))
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSingleLine(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim() !== '' &&
    !value.includes('\n') &&
    !value.includes('\r')
  )
}
