// Codex 的 rules 换算（F-06-11，SD-38）：model 与有 description 的 glob 规则写为技能，内容与
// Claude Code 逐字一致；always 规则由 SessionStart 命令 hook 运行 hooks/uapa-rules-codex.mjs
// 输出，宿主把以 0 退出的纯文本 stdout 加入上下文（rust-v0.162.1 hooks/src/events/
// session_start.rs，codex-source-review.md）。Codex 的技能须有 description，不读 paths。
import { alwaysRulesText, ruleSkillFile, rulesScript } from '../rule-skills.ts'
import type { OutputFile, TargetPlan, TargetSkip } from '../types.ts'

export const RULES_ENTRY = 'hooks/uapa-rules-codex.mjs'
const RULES_COMMAND = `node "\${PLUGIN_ROOT}/${RULES_ENTRY}"`

const GLOB_RISK =
  'Codex 不按 paths 加载技能：glob 规则写为技能后由模型按 description 决定是否加载'
const ALWAYS_RISK =
  'always 规则由 SessionStart 命令 hook 输出：插件的 hooks 在 Codex 的 /hooks 中信任之前不运行，' +
  '规则不进入上下文'

export interface CodexRules {
  readonly files: readonly OutputFile[]
  readonly command: string | null // SessionStart 条目的命令；没有 always 规则时为 null
  readonly skipped: readonly TargetSkip[]
  readonly risks: readonly string[]
}

export function codexRules(plan: TargetPlan): CodexRules {
  const files: OutputFile[] = []
  const skipped: TargetSkip[] = []
  const risks: string[] = []
  for (const rule of plan.rules) {
    if (rule.activation === 'always') continue
    if (rule.description === null) {
      skipped.push({
        target: plan.target,
        component: `rules/${rule.name}.md`,
        reason:
          'Codex 的技能须有 description，没有 description 的 glob 规则不能写为技能',
      })
      continue
    }
    files.push(ruleSkillFile(rule))
  }
  if (plan.rules.some(r => r.activation === 'glob' && r.description !== null)) {
    risks.push(GLOB_RISK)
  }
  const text = alwaysRulesText(plan.rules)
  if (text === null) return { files, command: null, skipped, risks }
  files.push({ path: RULES_ENTRY, content: rulesScript(text) })
  risks.push(ALWAYS_RISK)
  return { files, command: RULES_COMMAND, skipped, risks }
}
