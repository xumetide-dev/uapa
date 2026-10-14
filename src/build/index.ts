// 构建编排的入口（模块接口 §8）：cli 与构建编排之间的契约。
import type { BundleRequest } from '../bundle/types.ts'
import { targetCapabilities } from '../capabilities/index.ts'
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

// F-04-06 完成前，传给宿主模块的 bundle 抛出“未实现”（F-03-11）
async function bundle(_request: BundleRequest): Promise<string> {
  throw new Error('打包尚未实现（F-04-06）')
}

// root 为配置文件所在目录的绝对路径
export function build(
  config: UapaConfig,
  root: string,
  options: { readonly check: boolean },
): Promise<BuildOutcome> {
  return runBuild(config, root, options, { hostModules, targetCapabilities, bundle })
}
