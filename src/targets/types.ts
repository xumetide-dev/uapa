// 宿主模块与构建编排之间的契约（模块接口 §5，F-03-11）。本文件不出现具体宿主名。
import type { BundleRequest } from '../bundle/types.ts'
import type { TargetCapabilities } from '../capabilities/types.ts'
import type { HostName, TargetName } from '../config/targets.ts'
import type { CommandHookDecl, UapaConfig } from '../config/types.ts'
import type { GuardCheck } from '../runtime/core/types.ts'
import type { GuardDeclaration } from '../source/guard.ts'
import type { Skill } from '../source/types.ts'

export interface TargetPlan {
  readonly target: TargetName
  readonly capabilities: TargetCapabilities
  readonly skills: readonly Skill[] // 已按 frontmatter 与承载能力筛选
  readonly checks: readonly GuardCheck[] // 本目标要生成 hook 的检查
  readonly commandHooks: readonly CommandHookDecl[] // 本目标承载的命令 hooks 声明（F-03-15）
}

export interface HostInput {
  readonly config: UapaConfig // 已校验
  readonly plans: readonly TargetPlan[] // 该宿主通过能力检查的目标，至少一个
  readonly guard: GuardDeclaration | null
  // 与本宿主写入同一插件目录的其他宿主，按 targets.ts 中的顺序；默认布局为空
  readonly sharedWith: readonly HostName[]
  readonly bundle: (request: BundleRequest) => Promise<string>
}

export interface OutputFile {
  readonly path: string // 相对插件目录，POSIX 分隔，不含 '..'
  readonly content: string | Uint8Array
  // 合并布局中与其他宿主的同名文件冲突时，附在冲突错误之后
  readonly conflictHint?: string
}

export interface TargetNote {
  readonly target: TargetName
  readonly message: string
}

export type HostResult =
  | {
      readonly ok: true
      readonly files: readonly OutputFile[]
      readonly residualRisks: readonly TargetNote[]
    }
  | { readonly ok: false; readonly errors: readonly TargetNote[] }

export type VerifyResult =
  | { readonly status: 'passed' }
  | { readonly status: 'failed'; readonly errors: readonly string[] }
  | { readonly status: 'skipped'; readonly reason: string } // 如本机没有宿主命令

export interface HostModule {
  readonly host: HostName
  // 不读写磁盘；没有 verify 的宿主在此做字段白名单检查
  generate(input: HostInput): Promise<HostResult>
  verify?(dir: string): Promise<VerifyResult> // 宿主校验命令，dir 为绝对路径
}
