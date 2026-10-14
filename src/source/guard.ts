// 构建时读取守卫声明（F-02-03）：导入配置 guard 指定的守卫逻辑，
// 检查默认导出是否符合 GuardPlugin。
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
} from '../runtime/core/types.ts'

export interface GuardDeclaration {
  readonly modulePath: string // 守卫逻辑的绝对路径，供打包使用
  readonly name: string // 只用于错误信息，不写入构建报告
  readonly requires: readonly Capability[]
  readonly checks: readonly GuardCheck[] // 默认导出上存在的方法
}

// v0.1.0 不支持执行后检查（SD-20）
const AFTER_TOOL_ONLY: readonly Capability[] = ['replaceOutput', 'withholdOutput']
const NO_AFTER_TOOL = 'v0.1.0 不支持执行后检查（SD-20）'

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
  const issues = checkGuard(guard, file)
  if (issues.length > 0) return failed(issues)
  return loaded({
    modulePath,
    name: guard.name as string,
    requires: guard.requires as Capability[],
    checks: GUARD_CHECKS.filter(check => typeof guard[check] === 'function'),
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
      } else if (AFTER_TOOL_ONLY.includes(capability as Capability)) {
        issue(field, `${NO_AFTER_TOOL}，不能声明 ${capability}`)
      }
    })
  }
  if (guard.afterTool !== undefined) issue('afterTool', NO_AFTER_TOOL)
  for (const check of GUARD_CHECKS) {
    if (guard[check] !== undefined && typeof guard[check] !== 'function') {
      issue(check, '应为函数')
    }
  }
  return issues
}
