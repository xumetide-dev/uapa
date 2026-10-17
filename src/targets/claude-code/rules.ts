// Claude Code 的 rules 换算（F-05-19，SD-38）：model 与 glob 规则写为技能，always 规则由
// SessionStart 命令 hook 运行 hooks/uapa-rules-claude-code.mjs 输出。宿主把以 0 退出的纯文本
// stdout 加入上下文（claude-code-local-tests.md「v0.4.0 覆盖审查（2.1.296，容器）」）。
import {
  alwaysRulesText,
  plannedRules,
  ruleSkillFile,
  rulesScript,
  sharedRuleRisks,
} from '../rule-skills.ts'
import type { OutputFile, TargetNote, TargetPlan } from '../types.ts'

export const RULES_ENTRY = 'hooks/uapa-rules-claude-code.mjs'
const RULES_COMMAND = `node "\${CLAUDE_PLUGIN_ROOT}/${RULES_ENTRY}"`

// 注入上下文的上限（claude-code-hooks.md「上下文注入与事件」）
const MAX_CONTEXT_CHARS = 10_000

const NODE_RISK =
  'always 规则由 SessionStart 命令 hook 以 node 运行输出：只配置 claude-code:in-process 时' +
  '也需要本机有 Node，没有时规则不进入上下文'

export interface ClaudeCodeRules {
  readonly files: readonly OutputFile[]
  readonly command: string | null // SessionStart 条目的命令；没有 always 规则时为 null
  readonly risks: readonly TargetNote[]
}

export function claudeCodeRules(plans: readonly TargetPlan[]): ClaudeCodeRules {
  const rules = plannedRules(plans)
  const files = rules.filter(rule => rule.activation !== 'always').map(ruleSkillFile)
  const risks = sharedRuleRisks(plans, rules)
  const text = alwaysRulesText(rules)
  if (text === null) return { files, command: null, risks }
  files.push({ path: RULES_ENTRY, content: rulesScript(text) })
  const length = [...text].length
  for (const plan of plans) {
    if (length > MAX_CONTEXT_CHARS) {
      risks.push({
        target: plan.target,
        message:
          `always 规则的输出为 ${length} 字符，超过 Claude Code 注入上下文的 10,000 字符` +
          '上限，超出部分不进入上下文',
      })
    }
  }
  if (plans.every(plan => plan.target === 'claude-code:in-process')) {
    risks.push(...plans.map(plan => ({ target: plan.target, message: NODE_RISK })))
  }
  return { files, command: RULES_COMMAND, risks }
}
