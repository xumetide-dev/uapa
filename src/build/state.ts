// 构建过程中每个目标的状态：各步骤依次填写，最后转为构建报告的一行。
import type { TargetCapabilities } from '../capabilities/types.ts'
import type { TargetName } from '../config/targets.ts'
import type { TargetPlan } from '../targets/types.ts'

export interface TargetState {
  readonly target: TargetName
  readonly capabilities: TargetCapabilities
  readonly errors: string[] // 非空即该目标失败
  readonly skipped: { component: string; reason: string }[]
  readonly degraded: { decision: string; as: string; reason: string }[]
  readonly overridden: string[]
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
