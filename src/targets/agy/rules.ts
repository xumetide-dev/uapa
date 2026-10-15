// agy 的 rules（F-11-09，SD-32）：按 TargetPlan.rules 生成 rules/<name>.md。frontmatter 换为
// agy 的写法，正文为 Rule.body 原文；依据 agy-plugins.md「rules（1.3.5，容器）」与文档 [A5]。
import { stringify } from 'yaml'
import type { Rule, RuleActivation } from '../../source/types.ts'
import type { OutputFile } from '../types.ts'

// 文档记载的单个规则文件上限，超出部分被截断（agy-plugins.md [A5]）
const MAX_RULE_BYTES = 24_000

const TRIGGERS: Readonly<Record<RuleActivation, string>> = {
  always: 'always_on',
  model: 'model_decision',
  glob: 'glob',
}

// 生成的文件与残余风险：生成后超过上限的规则各写一条
export function ruleFiles(rules: readonly Rule[]): {
  files: OutputFile[]
  risks: string[]
} {
  const encoder = new TextEncoder()
  const files: OutputFile[] = []
  const risks: string[] = []
  for (const rule of rules) {
    const path = `rules/${rule.name}.md`
    const content = ruleText(rule)
    files.push({ path, content })
    if (encoder.encode(content).length > MAX_RULE_BYTES) {
      risks.push(`${path} 超过 agy 规则文件的 24,000 字节上限，超出部分被宿主截断`)
    }
  }
  return { files, risks }
}

// 键依次为 trigger、description（有值时）、globs（glob 时为以 , 连接的一个字符串：YAML 列表
// 不生效，已实测）。lineWidth 为 0 使长字符串不折行
function ruleText(rule: Rule): string {
  const meta: Record<string, string> = { trigger: TRIGGERS[rule.activation] }
  if (rule.description !== null) meta.description = rule.description
  if (rule.activation === 'glob') meta.globs = rule.globs.join(',')
  return `---\n${stringify(meta, { lineWidth: 0 })}---\n${rule.body}`
}
