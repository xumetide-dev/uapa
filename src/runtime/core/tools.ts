// 工具名与入参换算（F-04-01）、改写的反向换算与降级（F-04-02），见 hooks 适配 §3。
// 映射表由调用方传入，本文件不引用 src/capabilities/。
import type { BeforeTool, ToolCall, ToolNameMap } from './types.ts'

// 宿主输入中的一次工具调用；command 为宿主入参中该宿主的命令字段（是字符串时）
export interface HostTool {
  readonly name: string
  readonly input: Readonly<Record<string, unknown>>
  readonly command?: string
}

export type ToolCallResult =
  | { readonly ok: true; readonly call: ToolCall }
  | { readonly ok: false; readonly field: string } // 无法解析的字段

// 守卫决策落到宿主上的三种结果
export type ToolDecision =
  | { readonly kind: 'allow' }
  | { readonly kind: 'deny'; readonly reason: string }
  | {
      readonly kind: 'rewriteShell'
      readonly command: string
      readonly fallbackReason: string
    }

// 不在映射表中的宿主工具以 host:<原名> 传给守卫；只认映射表自身的键
export function canonicalToolName(hostName: string, toolNames: ToolNameMap): string {
  const canonical = Object.hasOwn(toolNames, hostName) ? toolNames[hostName] : undefined
  return canonical ?? `host:${hostName}`
}

// 规范名为 shell 时入参换算为 { command }，命令文本缺失时按输入无法解析处理；
// 其余工具的入参原样传入
export function toToolCall(
  sessionId: string,
  tool: HostTool,
  toolNames: ToolNameMap,
): ToolCallResult {
  const name = canonicalToolName(tool.name, toolNames)
  if (name !== 'shell') {
    return { ok: true, call: { sessionId, tool: name, input: tool.input } }
  }
  if (tool.command === undefined) return { ok: false, field: 'tool.command' }
  return { ok: true, call: { sessionId, tool: name, input: { command: tool.command } } }
}

// rewrite 只对 shell 且目标能改写入参时生效；其余情况按 fallbackReason 拒绝，
// 不放行原始入参。decision 须已经过 checkBeforeTool 检查
export function resolveToolDecision(
  decision: BeforeTool,
  tool: string,
  rewriteInput: boolean,
): ToolDecision {
  if (decision.kind !== 'rewrite') return decision
  const { command } = decision.input
  if (tool === 'shell' && rewriteInput && typeof command === 'string') {
    return { kind: 'rewriteShell', command, fallbackReason: decision.fallbackReason }
  }
  return { kind: 'deny', reason: decision.fallbackReason }
}
