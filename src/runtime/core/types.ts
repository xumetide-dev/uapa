// 守卫公共类型（hooks 适配 §2）与目标运行时数据的类型。
// 本目录不做 I/O、不引用 Node 类型，由 tsconfig.runtime-core.json 检查。
// 包入口只导出插件作者用到的部分（F-02-01、F-02-02）。

export type Capability =
  | 'rewriteInput'
  | 'replaceOutput'
  | 'withholdOutput'
  | 'stopGate'
  | 'promptGate'

export const CAPABILITIES: readonly Capability[] = [
  'rewriteInput',
  'replaceOutput',
  'withholdOutput',
  'stopGate',
  'promptGate',
]

export interface ToolCall {
  readonly sessionId: string
  readonly tool: string // 适配器换算后的规范工具名，见 hooks 适配 §3
  readonly input: Readonly<Record<string, unknown>>
}

export type BeforeTool =
  | { kind: 'allow' }
  | { kind: 'deny'; reason: string }
  // 宿主不能改写入参时，按 fallbackReason 拒绝，不放行原始入参
  | { kind: 'rewrite'; input: Record<string, unknown>; fallbackReason: string }

export type BeforeStop = { kind: 'stop' } | { kind: 'continue'; reason: string }

export interface PromptSubmit {
  readonly sessionId: string
  readonly prompt: string // 用户提交的提示原文
}

export type BeforePrompt = { kind: 'allow' } | { kind: 'block'; reason: string }

// v0.1.0 不含 afterTool（SD-20）；v0.2.0 由 F-02-04 加入
export interface GuardPlugin {
  readonly name: string
  readonly requires: readonly Capability[]
  beforeTool?(call: ToolCall): BeforeTool | Promise<BeforeTool>
  beforePrompt?(p: PromptSubmit): BeforePrompt | Promise<BeforePrompt>
  // continuations 为连续强制继续的次数：返回 continue 时加 1，返回 stop 时清零；
  // 供插件自行设上限
  beforeStop?(s: {
    sessionId: string
    continuations: number
  }): BeforeStop | Promise<BeforeStop>
}

// 以下类型不由包入口导出

// 守卫检查名，与 GuardPlugin 的方法名一致；v0.2.0 增加 'afterTool'
export type GuardCheck = 'beforeTool' | 'beforePrompt' | 'beforeStop'

export const GUARD_CHECKS: readonly GuardCheck[] = [
  'beforeTool',
  'beforePrompt',
  'beforeStop',
]

// 规范工具名（hooks 适配 §3）；不在映射表中的宿主工具以 `host:<原名>` 传给守卫
export type CanonicalTool =
  | 'shell'
  | 'read_file'
  | 'edit_file'
  | 'write_file'
  | 'glob'
  | 'grep'
  | 'web_fetch'
  | 'web_search'
  | 'subagent'
  | 'todo'

// 宿主工具名 → 规范名；一个规范名可对应多个宿主工具名
export type ToolNameMap = Readonly<Record<string, CanonicalTool>>

// 打包时内联为只读常量（入口与打包接口第 1 节）
export interface TargetRuntimeData {
  readonly pluginName: string // UapaConfig.name
  readonly toolNames: ToolNameMap
  readonly capabilities: Readonly<Record<Capability, boolean>> // 取自能力数据
  // Claude Code 双形态去重的会话变量名；
  // 只在两个 Claude Code 目标都进入 plans 时有值（F-05-08）
  readonly moduleSessionEnv: string | null
}
