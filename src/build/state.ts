// 构建过程中每个目标的状态：各步骤依次填写，最后转为构建报告的一行。
import type { TargetCapabilities } from '../capabilities/types.ts'
import type { TargetName } from '../config/targets.ts'
import type { GuardCheck } from '../runtime/core/types.ts'
import type { TargetPlan } from '../targets/types.ts'

// 缺少对应能力时可省略的检查；执行前检查不省略（缺 rewriteInput 时降级）
export type GatedCheck = Exclude<GuardCheck, 'beforeTool'>

export interface TargetState {
  readonly target: TargetName
  readonly capabilities: TargetCapabilities
  readonly errors: string[] // 非空即该目标失败
  readonly skipped: { component: string; reason: string }[]
  readonly degraded: { decision: string; as: string; reason: string }[]
  readonly overridden: string[]
  readonly omitted: GatedCheck[] // 因 stopGate、promptGate 缺失而省略的检查（F-03-13）
  readonly sharedSkillRisks: string[] // 共用插件目录中不适用于本目标的 skill
  readonly hostRisks: string[] // HostResult.residualRisks 中本目标的条目
  plan: TargetPlan | null // 未通过能力检查时为 null
  unit: string | null // 写出的插件目录（显示路径）
  hostValidation: 'passed' | 'failed' | 'skipped' | 'none'
}

export function newState(
  target: TargetName,
  capabilities: TargetCapabilities,
): TargetState {
  return {
    target,
    capabilities,
    errors: [],
    skipped: [],
    degraded: [],
    overridden: [],
    omitted: [],
    sharedSkillRisks: [],
    hostRisks: [],
    plan: null,
    unit: null,
    hostValidation: 'none',
  }
}

export function succeeded(state: TargetState): boolean {
  return state.errors.length === 0
}
