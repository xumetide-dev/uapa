// 'claude-code' 中 claude-code-in-process.ts 用到的部分（入口与打包接口第 1 节，F-05-05）。
// 依据 Mods 指南「常用事件与返回值」「失败处理与 .catch」「$.state 与 $.store」手写，只声明入口
// 用到的接口与字段；完整类型由 Claude Code 在加载 mod 时生成，不复制进本仓库。

declare module 'claude-code' {
  // 处理函数的第一个参数 $：入口只用到会话 id 与环境变量
  export interface Api {
    readonly session: { id(): Promise<string> }
    readonly env: {
      set(name: string, value: string | undefined): Promise<void>
    }
  }

  // 第三个参数：把事件交给后续处理者并返回其结果；called 为真表示已调用过，再调用时重放结果
  export interface Next<E, R> {
    (e: E): Promise<R>
    readonly called: boolean
  }

  export type Hook<E, R> = ($: Api, e: E, next: Next<E, R>) => R | Promise<R>

  export interface Registration<E, R> {
    // 处理函数抛错、返回形状不符或超出预算时，由 handler 作答
    catch(handler: Hook<E, R>): unknown
  }

  // tool.call：工具名与 tool_use_id 之外的字段是工具入参，Bash 的命令为 command
  export interface ToolCallEvent {
    readonly tool: string
    readonly tool_use_id: string
    readonly [field: string]: unknown
  }

  export interface PromptSubmitEvent {
    readonly text: unknown // 提示文本，入口检查为字符串后使用
    readonly [field: string]: unknown
  }

  // classic.<Event>：对应命令 hook 的 stdin 字段
  export interface ClassicEvent {
    readonly [field: string]: unknown
  }

  // 入口只构造下列字段，其余结果原样返回 next 的结果。tool.call 的 next 结果另有 ref、text、
  // isError 等字段：result 的形状同命令 hooks 的 tool_response，报错时为字符串；text 由宿主按
  // result 重新生成，只改 text 无效（本地实测「hooks 模块的 tool.call」）
  export interface ToolCallResult {
    readonly deny?: string
    readonly result?: unknown
    readonly [field: string]: unknown
  }
  export interface PromptSubmitResult {
    readonly drop?: string
  }
  export interface ClassicResult {
    readonly block?: string
  }

  export interface On {
    (
      event: 'session.start',
      hook: Hook<ClassicEvent, unknown>,
    ): Registration<ClassicEvent, unknown>
    (
      event: 'classic.SessionStart',
      matcher: { readonly source: readonly string[] },
      hook: Hook<ClassicEvent, ClassicResult>,
    ): Registration<ClassicEvent, ClassicResult>
    (
      event: 'tool.call',
      hook: Hook<ToolCallEvent, ToolCallResult>,
    ): Registration<ToolCallEvent, ToolCallResult>
    (
      event: 'prompt.submit',
      hook: Hook<PromptSubmitEvent, PromptSubmitResult>,
    ): Registration<PromptSubmitEvent, PromptSubmitResult>
    (
      event: 'classic.Stop',
      hook: Hook<ClassicEvent, ClassicResult>,
    ): Registration<ClassicEvent, ClassicResult>
  }

  // $.state 中的一个值：plugin 与 key 须为字面量，类型在插件的类型契约中声明。
  // 运行时的形状不属于公开契约，这里只以 T 区分值的类型
  const atomType: unique symbol
  export interface Atom<T> {
    readonly [atomType]: T
  }
  export function atom<T>(
    ref: { readonly plugin: string; readonly key: string },
    initial: T,
  ): Atom<T>
  export function read<T>($: Api, value: Atom<T>): Promise<T>
  export function update<T>(
    $: Api,
    value: Atom<T>,
    change: (current: T) => T,
  ): Promise<void>
}
