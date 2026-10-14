// Claude Code 宿主模块。claude-code:subprocess 与 claude-code:in-process（F-05-14 起）
// 写入同一插件目录。
import type { HostModule, HostResult, TargetPlan } from '../types.ts'
import { manifest, manifestErrors } from './manifest.ts'

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

// 错误不属于单个目标时，为每个目标各返回一条相同的消息（模块接口 §5）
function failAll(
  plans: readonly TargetPlan[],
  messages: readonly string[],
): HostResult {
  const errors = plans.flatMap(plan =>
    messages.map(message => ({ target: plan.target, message })),
  )
  return { ok: false, errors }
}

export const claudeCode: HostModule = {
  host: 'claude-code',
  async generate(input) {
    const errors = manifestErrors(input.config)
    if (errors.length > 0) return failAll(input.plans, errors)
    const files = [
      { path: '.claude-plugin/plugin.json', content: json(manifest(input.config)) },
    ]
    return { ok: true, files, residualRisks: [] }
  },
}
