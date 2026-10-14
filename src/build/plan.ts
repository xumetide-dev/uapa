// 能力检查（F-03-02）：按 frontmatter 与组件承载为每个目标筛选 skills，
// 得出 TargetPlan。
import type { TargetCapabilities } from '../capabilities/types.ts'
import type { TargetName } from '../config/targets.ts'
import type { UapaConfig } from '../config/types.ts'
import type { GuardDeclaration } from '../source/guard.ts'
import type { Skill, SourceProject } from '../source/types.ts'
import { newState, type TargetState } from './state.ts'

export function planTargets(
  config: UapaConfig,
  source: SourceProject,
  guard: GuardDeclaration | null,
  capabilities: Readonly<Record<TargetName, TargetCapabilities>>,
): TargetState[] {
  return config.targets.map(target => {
    const state = newState(target, capabilities[target])
    const skills = planSkills(state, source.skills)
    if (state.errors.length === 0) {
      state.plan = {
        target,
        capabilities: state.capabilities,
        skills,
        checks: guard?.checks ?? [],
      }
    }
    return state
  })
}

// 不适用本目标的 skill 不计；本目标不能承载 skills 时，
// 显式写了本目标的 skill 使目标失败，未写 targets 的 skill 列为跳过
function planSkills(state: TargetState, skills: readonly Skill[]): Skill[] {
  const carried = state.capabilities.components.skills !== 'none'
  const planned: Skill[] = []
  for (const skill of skills) {
    if (skill.targets !== null && !skill.targets.includes(state.target)) continue
    if (carried) planned.push(skill)
    else if (skill.targets !== null) {
      state.errors.push(`skill ${skill.name} 显式限定了本目标，但本目标不能承载 skills`)
    } else {
      state.skipped.push({
        component: `skills/${skill.name}`,
        reason: '本目标不能承载 skills',
      })
    }
  }
  return planned
}
