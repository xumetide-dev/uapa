// 目标能力数据的模型（模块接口 §4，F-03-01）。每个目标一个数据模块 <宿主>-<形态>.ts。
import type { HostName, TargetName } from '../config/targets.ts'
import type { CommandHookEvent } from '../config/types.ts'
import type { Capability, GuardCheck, ToolNameMap } from '../runtime/core/types.ts'

export type Carrier = 'package' | 'manifest' | 'none' // 包内、manifest 字段、不承载
export type FailMode = 'allow' | 'deny'
export type Component = 'skills' | 'agents' | 'mcp' | 'hooks'

export interface TargetCapabilities {
  readonly target: TargetName
  readonly host: {
    readonly name: HostName
    readonly version: string // 核对时的宿主版本，或 '>=1.0.26' 形式的下限
    readonly checked: string // 核对日期 YYYY-MM-DD
    readonly source: string // docs/research/coding-agent-plugin-manifests/ 下的文件名
  }
  readonly components: Readonly<Record<Component, Carrier>>
  readonly capabilities: Readonly<Record<Capability, boolean>> // 未实测记为 false
  // hook 进程出错（非预期退出码、崩溃、无法启动）与超时时宿主的处理
  readonly failureDefault: Readonly<
    Record<GuardCheck, { readonly error: FailMode; readonly timeout: FailMode }>
  >
  // 写入 hooks 配置的超时；null 为字段未核实、不写
  readonly hookTimeoutSeconds: number | null
  readonly defaultTimeoutSeconds: number | null // 宿主默认超时；进程内目标为 null
  readonly toolNames: ToolNameMap // 宿主工具名 → 规范名
  // 命令 hooks 声明的事件 → 宿主事件名；null 为不承载或调研未记载（command-hooks.md 第 2 节）
  readonly commandHookEvents: Readonly<Record<CommandHookEvent, string | null>>
}
