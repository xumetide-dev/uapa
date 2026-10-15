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

// 执行后检查的结果（SD-29）：宿主不能替换输出时，replace 按 withhold 写出，text 作原因
export type AfterTool =
  | { kind: 'keep' }
  | { kind: 'replace'; text: string }
  | { kind: 'withhold'; reason: string }

export type BeforeStop = { kind: 'stop' } | { kind: 'continue'; reason: string }

export interface PromptSubmit {
  readonly sessionId: string
  readonly prompt: string // 用户提交的提示原文
}

export type BeforePrompt = { kind: 'allow' } | { kind: 'block'; reason: string }

// 守卫选项（F-02-05，SD-35）：default 必填，类型与 type 一致。Claude Code 把选项写为插件的
// userConfig，用户设置的取值传给守卫；其他宿主取 default
export type GuardOption =
  | {
      readonly type: 'string'
      readonly title: string
      readonly description: string
      readonly default: string
    }
  | {
      readonly type: 'number'
      readonly title: string
      readonly description: string
      readonly default: number
    }
  | {
      readonly type: 'boolean'
      readonly title: string
      readonly description: string
      readonly default: boolean
    }

export type GuardOptionValue = string | number | boolean

// 各检查方法的最后一个参数：本次调用的选项取值，键为选项名；没有声明选项时为空对象
export interface GuardContext {
  readonly options: Readonly<Record<string, GuardOptionValue>>
}

export interface GuardPlugin {
  readonly name: string
  readonly requires: readonly Capability[]
  readonly options?: Readonly<Record<string, GuardOption>>
  beforeTool?(call: ToolCall, ctx: GuardContext): BeforeTool | Promise<BeforeTool>
  beforePrompt?(
    p: PromptSubmit,
    ctx: GuardContext,
  ): BeforePrompt | Promise<BeforePrompt>
  // output 为工具输出的文本形式，取法见入口与打包接口第 4 节（F-02-04）
  afterTool?(
    call: ToolCall,
    output: string,
    ctx: GuardContext,
  ): AfterTool | Promise<AfterTool>
  // continuations 为连续强制继续的次数：返回 continue 时加 1，返回 stop 时清零；
  // 供插件自行设上限
  beforeStop?(
    s: { sessionId: string; continuations: number },
    ctx: GuardContext,
  ): BeforeStop | Promise<BeforeStop>
}

// 以下类型不由包入口导出

// 守卫检查名，与 GuardPlugin 的方法名一致
export type GuardCheck = 'beforeTool' | 'beforePrompt' | 'beforeStop' | 'afterTool'

export const GUARD_CHECKS: readonly GuardCheck[] = [
  'beforeTool',
  'beforePrompt',
  'beforeStop',
  'afterTool',
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
  // 守卫声明的选项，按 name 排序；没有时为空（F-04-09）
  readonly options: readonly RuntimeOption[]
}

// 入口解析取值所需的部分：title 与 description 只写入 Claude Code 的 userConfig，不进入入口
export interface RuntimeOption {
  readonly name: string
  readonly type: GuardOption['type']
  readonly default: GuardOptionValue
}
