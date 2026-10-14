// 能力数据的登记处：构建编排只经此取得。漏登记已登记的目标名时 tsc 报错。
import type { TargetName } from '../config/targets.ts'
import { claudeCodeSubprocess } from './claude-code-subprocess.ts'
import type { TargetCapabilities } from './types.ts'

export const targetCapabilities: Readonly<Record<TargetName, TargetCapabilities>> = {
  'claude-code:subprocess': claudeCodeSubprocess,
}
