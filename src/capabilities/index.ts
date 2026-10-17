// 能力数据的登记处：构建编排只经此取得。漏登记已登记的目标名时 tsc 报错。
import type { TargetName } from '../config/targets.ts'
import type { UapaConfig } from '../config/types.ts'
import { agySubprocess } from './agy-subprocess.ts'
import { claudeCodeInProcess } from './claude-code-in-process.ts'
import { claudeCodeSubprocess } from './claude-code-subprocess.ts'
import { codexSubprocess } from './codex-subprocess.ts'
import type { TargetCapabilities } from './types.ts'

export const targetCapabilities: Readonly<Record<TargetName, TargetCapabilities>> = {
  'claude-code:in-process': claudeCodeInProcess,
  'claude-code:subprocess': claudeCodeSubprocess,
  'codex:subprocess': codexSubprocess,
  'agy:subprocess': agySubprocess,
}

const block = { error: 'deny', timeout: 'deny' } as const

// 随配置变化的能力数据。hosts['claude-code'].onFailure 为 'block' 时，claude-code:subprocess 的
// 执行前与提示提交前守卫条目写 onFailure: "block"，入口出错、无法启动与超时都按拒绝处理
// （claude-code-hooks.md「失败处理与 onFailure」，2.1.296 容器实测；F-05-21）
export function capabilitiesFor(
  config: UapaConfig,
): Readonly<Record<TargetName, TargetCapabilities>> {
  if (config.hosts?.['claude-code']?.onFailure !== 'block') return targetCapabilities
  const subprocess: TargetCapabilities = {
    ...claudeCodeSubprocess,
    failureDefault: {
      ...claudeCodeSubprocess.failureDefault,
      beforeTool: block,
      beforePrompt: block,
    },
  }
  return { ...targetCapabilities, 'claude-code:subprocess': subprocess }
}
