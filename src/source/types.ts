// 源项目模型（模块接口 §3）
import type { HostName, TargetName } from '../config/targets.ts'

export interface Skill {
  readonly name: string
  readonly dir: string // 相对源项目根，如 'skills/review'
  // 相对 dir，递归列出全部文件（含 SKILL.md），按字典序
  readonly files: readonly string[]
  readonly targets: readonly TargetName[] | null // frontmatter 的 targets；未写为 null
}

export interface SourceProject {
  readonly root: string // 配置文件所在目录的绝对路径
  readonly skills: readonly Skill[] // 按 name 排序
  // overrides/<宿主>/ 下的文件，相对该目录，按字典序
  readonly overrides: Readonly<Partial<Record<HostName, readonly string[]>>>
}
