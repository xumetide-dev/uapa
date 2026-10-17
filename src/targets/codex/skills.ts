// skills 的名称与嵌套（F-06-16，SD-43）：Codex 在兼容格式的插件中递归注册 skills/ 下隐藏目录以外的
// 每个 SKILL.md，技能目录中嵌套的也算；名称至多 64 个字符，<插件名>:<技能名> 至多 129 个字符，
// 超出时不加载（rust-v0.162.1 ext/skills/src/loader/discovery.rs、skills/src/parser.rs、
// ext/skills/src/loader/host.rs；codex-source-review.md「skills 的递归与名称」）。
import type { Skill } from '../../source/types.ts'
import type { TargetSkip } from '../types.ts'

const MAX_NAME_LENGTH = 64
const MAX_QUALIFIED_LENGTH = 129

// 名称按字符计；符合时为 null。规则换算出的技能同样适用
export function skillNameReason(pluginName: string, name: string): string | null {
  if ([...name].length > MAX_NAME_LENGTH) {
    return `技能名 ${name} 超过 64 个字符，Codex 不加载`
  }
  const qualified = `${pluginName}:${name}`
  if ([...qualified].length > MAX_QUALIFIED_LENGTH) {
    return `${qualified} 超过 129 个字符，Codex 不加载`
  }
  return null
}

export function skillSkips(
  target: TargetSkip['target'],
  pluginName: string,
  skills: readonly Skill[],
): TargetSkip[] {
  return skills.flatMap(skill => {
    const reason = skillNameReason(pluginName, skill.name)
    return reason === null
      ? []
      : [{ target, component: `skills/${skill.name}`, reason }]
  })
}

// 技能目录中嵌套的 SKILL.md（不含隐藏目录中的）各自注册为一个技能
export function nestedSkillRisks(skills: readonly Skill[]): string[] {
  return skills.flatMap(skill => {
    const nested = skill.files.filter(
      file =>
        file.endsWith('/SKILL.md') &&
        !file.split('/').some(part => part.startsWith('.')),
    )
    if (nested.length === 0) return []
    return [
      `skill ${skill.name} 的目录中另有 ${nested.join('、')}：Codex 把每个 SKILL.md 各注册为` +
        '一个技能',
    ]
  })
}
