// 构建报告的类型（构建报告文档）：不引用其他模块的类型。
// targets 按配置中的目标顺序排列。
export interface BuildReport {
  readonly targets: readonly TargetReport[]
}

export interface TargetReport {
  readonly target: string
  readonly status: 'ok' | 'failed'
  readonly errors: readonly string[]
  readonly host: {
    readonly name: string
    readonly version: string
    readonly checked: string
    readonly source: string
  }
  readonly units: readonly { readonly kind: string; readonly path: string }[]
  // component 为相对插件目录的组件路径，如 'skills/review'
  readonly skipped: readonly { readonly component: string; readonly reason: string }[]
  readonly degraded: readonly {
    readonly decision: string
    readonly as: string
    readonly reason: string
  }[]
  readonly overridden: readonly string[] // 相对插件目录
  // none 为本次未调用 verify：宿主模块未实现，或该宿主未写出文件
  readonly hostValidation: 'passed' | 'failed' | 'skipped' | 'none'
  readonly residualRisks: readonly string[]
}
