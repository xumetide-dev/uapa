// 打包请求（入口与打包接口第 1 节）：宿主模块与打包共用
import type { TargetRuntimeData } from '../runtime/core/types.ts'

export interface BundleRequest {
  // src/runtime/entries/ 下的入口名，不含扩展名，如 'codex-subprocess'；
  // 测试可传绝对路径
  readonly entry: string
  readonly guardModule: string // GuardDeclaration.modulePath
  readonly data: TargetRuntimeData
  // 'node'：只保留 node: 内置模块；'claude-code'：只保留 'claude-code'
  readonly external: 'node' | 'claude-code'
}
