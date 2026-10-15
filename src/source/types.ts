// 源项目模型（模块接口 §3）
import type { HostName, TargetName } from '../config/targets.ts'

export interface Skill {
  readonly name: string
  readonly dir: string // 相对源项目根，如 'skills/review'
  // 相对 dir，递归列出全部文件（含 SKILL.md），按字典序
  readonly files: readonly string[]
  readonly targets: readonly TargetName[] | null // frontmatter 的 targets；未写为 null
}

// agents/ 下一层的 <name>.md（F-01-07，SD-30）
export interface Agent {
  readonly name: string // frontmatter 的 name，与文件名去掉 .md 相同
  readonly path: string // 相对源项目根，如 'agents/reviewer.md'
  readonly targets: readonly TargetName[] | null // 同 Skill.targets
}

// mcp/servers.json 的 mcpServers（F-01-08，SD-30）；未写的字段不出现。
// 插件根写作 {pluginRoot}，只出现在本地服务器的 command、args 与 env 的值中
export type McpServer =
  | {
      readonly name: string
      readonly kind: 'local'
      readonly command: string
      readonly args?: readonly string[]
      readonly env?: Readonly<Record<string, string>>
    }
  | {
      readonly name: string
      readonly kind: 'remote'
      readonly url: string
      readonly headers?: Readonly<Record<string, string>>
    }

// rules/ 下一层的 <name>.md（F-01-10，SD-32）；宿主模块按自身格式重写 frontmatter
export type RuleActivation = 'always' | 'model' | 'glob'

export interface Rule {
  readonly name: string // 文件名去掉 .md
  readonly path: string // 相对源项目根，如 'rules/style.md'
  readonly activation: RuleActivation
  readonly description: string | null // 未写为 null；activation 为 'model' 时不为 null
  readonly globs: readonly string[] // activation 为 'glob' 时非空，其余为空
  readonly body: string // frontmatter 结束行之后的原文，换行符不变
  readonly targets: readonly TargetName[] | null // 同 Skill.targets
}

// commands/ 下一层的 <name>.md（F-01-11，SD-33）；整个文件原样复制
export interface Command {
  readonly name: string // 文件名去掉 .md
  readonly path: string // 相对源项目根，如 'commands/review.md'
  readonly targets: readonly TargetName[] | null // 同 Skill.targets
}

export interface SourceProject {
  readonly root: string // 配置文件所在目录的绝对路径
  readonly skills: readonly Skill[] // 按 name 排序
  readonly agents: readonly Agent[] // 按 name 排序，没有 agents/ 时为空
  readonly mcpServers: readonly McpServer[] // 按 name 排序，没有 mcp/servers.json 时为空
  readonly rules: readonly Rule[] // 按 name 排序，没有 rules/ 时为空
  readonly commands: readonly Command[] // 按 name 排序，没有 commands/ 时为空
  // overrides/<宿主>/ 下的文件，相对该目录，按字典序
  readonly overrides: Readonly<Partial<Record<HostName, readonly string[]>>>
}
