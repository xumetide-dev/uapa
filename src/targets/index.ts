// 宿主模块的登记处：构建编排只经此取得宿主模块。漏登记已登记的宿主时 tsc 报错。
import type { HostName } from '../config/targets.ts'
import { agy } from './agy/index.ts'
import { claudeCode } from './claude-code/index.ts'
import type { HostModule } from './types.ts'

export const hostModules: Readonly<Record<HostName, HostModule>> = {
  'claude-code': claudeCode,
  agy,
}
