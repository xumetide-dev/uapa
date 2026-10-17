// 构建编排的入口（模块接口 §8）：cli 与构建编排之间的契约。
import { bundle } from '../bundle/index.ts'
import { capabilitiesFor } from '../capabilities/index.ts'
import type { InputIssue } from '../config/issues.ts'
import type { UapaConfig } from '../config/types.ts'
import type { BuildReport } from '../report/types.ts'
import { hostModules } from '../targets/index.ts'
import { runBuild } from './run.ts'

export interface FileChange {
  readonly change: 'added' | 'modified' | 'removed'
  readonly path: string // 写法见模块接口 §2
}

export type BuildOutcome =
  | { readonly kind: 'input-error'; readonly issues: readonly InputIssue[] }
  | {
      readonly kind: 'done'
      readonly report: BuildReport
      readonly reportPath: string | null // --check 时为 null
      readonly changes: readonly FileChange[] | null // 只在 --check 时非 null
    }

// root 为配置文件所在目录的绝对路径
export function build(
  config: UapaConfig,
  root: string,
  options: { readonly check: boolean },
): Promise<BuildOutcome> {
  const targetCapabilities = capabilitiesFor(config)
  return runBuild(config, root, options, { hostModules, targetCapabilities, bundle })
}
