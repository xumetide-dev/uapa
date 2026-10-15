// 打包请求（入口与打包接口第 1 节）：宿主模块与打包共用
import type { GuardCheck, TargetRuntimeData } from '../runtime/core/types.ts'

interface BundleBase {
  // src/runtime/entries/ 下的入口名，不含扩展名，如 'codex-subprocess'；
  // 测试可传绝对路径
  readonly entry: string
  readonly guardModule: string // GuardDeclaration.modulePath
  readonly data: TargetRuntimeData
}

export type BundleRequest =
  // 'node'：只保留 node: 内置模块。子进程入口要调用的检查由 hooks 配置列出
  | (BundleBase & { readonly external: 'node' })
  // 'claude-code'：只保留 'claude-code'。hooks 模块入口只为 checks 中的检查注册处理函数，
  // 打包时 __UAPA_CHECKS__.<检查名> 替换为布尔字面量，未列出的检查不进入打包结果
  | (BundleBase & {
      readonly external: 'claude-code'
      readonly checks: readonly GuardCheck[]
    })
