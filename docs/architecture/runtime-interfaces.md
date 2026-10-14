# UAPA 入口与打包接口

本文是[模块接口](module-interfaces.md) §6 的内容：打包请求、入口文件与 hooks 命令、子进程入口
的公共部分与宿主协议、守卫返回值检查。模块职责与依赖方向见
[架构 §1](architecture.md#1-组成与模块)。代码块中的类型是实现时的约定，字段名与文件位置以本文
为准；宿主行为以宿主调研文档为准。

## 1. 打包

```ts
// src/runtime/core/types.ts（F-02-01），不由包入口导出；入口源码经 uapa:target-data 取得
export interface TargetRuntimeData { // 打包时内联为只读常量
  readonly pluginName: string // UapaConfig.name
  readonly toolNames: ToolNameMap
  readonly capabilities: Readonly<Record<Capability, boolean>> // 取自能力数据
  // Claude Code 双形态去重的会话变量名；只在两个 Claude Code 目标都进入 plans 时有值（F-05-08）
  readonly moduleSessionEnv: string | null
}

// src/bundle/types.ts（F-03-11）：宿主模块与打包共用
export interface BundleRequest {
  // src/runtime/entries/ 下的入口名，不含扩展名，如 'codex-subprocess'；测试可传绝对路径
  readonly entry: string
  readonly guardModule: string // GuardDeclaration.modulePath
  readonly data: TargetRuntimeData
  // 'node'：只保留 node: 内置模块；'claude-code'：只保留 'claude-code'
  readonly external: 'node' | 'claude-code'
}

// src/bundle/index.ts（F-04-06）
export function bundle(request: BundleRequest): Promise<string> // ES2022 ESM 单文件源码
```

- 入口源码以模块名 `uapa:guard` 导入守卫的默认导出，以 `uapa:target-data` 导入
  `TargetRuntimeData`；这两个模块名只由 `bundle` 解析，入口不导入 `src/capabilities/` 与
  `src/bundle/`。
- 入口源码用到的打包时名称在 `src/runtime/entries/bundle-names.d.ts`（F-04-06）中声明：

  ```ts
  declare module 'uapa:guard' { const guard: GuardPlugin; export default guard }
  declare module 'uapa:target-data' { const data: TargetRuntimeData; export default data }
  declare const __UAPA_PLUGIN_NAME__: string
  declare const __UAPA_MODULE_SESSION_ENV__: string | null
  ```

  `'claude-code'` 的类型在 `src/runtime/entries/claude-code-api.d.ts`（F-05-05）中手写，只含
  `claude-code-in-process.ts` 用到的部分，依据 Mods 指南「常用事件与返回值」。
- 外部导入按 `external` 保留，出现其他外部导入时打包失败。子进程目标传 `'node'`，
  `claude-code:in-process` 传 `'claude-code'`。
- Claude Code hooks 模块要求 `$.env.set` 的变量名与 `$.state` 的 `{ plugin, key }` 引用为字面量
  （[Mods 指南「常见错误」](../research/coding-agent-plugin-manifests/claude-code-mods-guide.md#常见错误)）。
  `bundle` 把入口源码中的标识符 `__UAPA_PLUGIN_NAME__` 与 `__UAPA_MODULE_SESSION_ENV__`
  替换为 `data.pluginName`、`data.moduleSessionEnv` 的字面量（`null` 时为 `null`）；入口在
  调用处直接使用这两个标识符，不经变量、对象属性或函数参数转手。`moduleSessionEnv` 为 `null`
  时，打包结果中不保留以它为参数的 `$.env.set` 调用（F-05-08）。
- `bundle` 按 `import.meta.url` 相对自身定位入口与 `runtime/core`，定位方式对源码目录与
  `dist/` 目录结构都成立（从 `dist/` 打包由 F-10-05 验证）；结果只在内存中返回，不写文件。
  产物中的文件名由宿主模块决定。

## 2. 入口文件与 hooks 命令

| 目标 | 入口源码 | 产物中的文件 | hooks 命令 |
|---|---|---|---|
| `claude-code:in-process` | `claude-code-in-process.ts` | `hooks/uapa-guard.mjs`，由 `hooks/register.ts` 引入 | 不适用 |
| `claude-code:subprocess` | `claude-code-subprocess.ts` | `hooks/uapa-claude-code.mjs` | `node "${CLAUDE_PLUGIN_ROOT}/hooks/uapa-claude-code.mjs" <检查名>` |
| `codex:subprocess` | `codex-subprocess.ts` | `hooks/uapa-codex.mjs` | `node "$PLUGIN_ROOT/hooks/uapa-codex.mjs" <检查名>`；命令是否经 shell 执行待 TA-15 |
| `copilot-cli:subprocess` | `copilot-cli-subprocess.ts` | `com.github.copilot/hooks/uapa-copilot-cli.mjs` | 见 F-07-03 |
| `kimi:subprocess` | `kimi-subprocess.ts` | `hooks/uapa-kimi.mjs` | `node hooks/uapa-kimi.mjs <检查名>`（以插件根目录为工作目录） |

- `<检查名>` 为 `before-tool`、`before-prompt` 或 `before-stop`。每个目标只有一个入口文件，各检查
  的 hook 命令只在该参数上不同；入口不读取宿主的事件名字段。
- 不同宿主的生成文件不同名；例外是标为可合并的根 `plugin.json`，以及按 SD-07 处理的 hooks 配置。

## 3. 子进程入口

```ts
// src/runtime/entries/subprocess.ts（公共部分）；各目标在 <宿主>-subprocess.ts 中实现协议
export type CheckArg = 'before-tool' | 'before-prompt' | 'before-stop'
export interface HostEvent {
  readonly sessionId: string
  readonly tool?: {
    readonly name: string
    readonly input: Readonly<Record<string, unknown>>
    // 宿主入参中有该宿主的命令字段且为字符串时取出；parse 不按工具名判断
    readonly command?: string
  }
  readonly prompt?: string
}
export interface ProcessOutput {
  readonly exitCode: 0 | 2; readonly stdout?: string; readonly stderr?: string
}
type Env = Readonly<Record<string, string | undefined>>
export interface SubprocessProtocol {
  parse(check: CheckArg, stdin: unknown): HostEvent // 缺字段时抛错，见下文
  // 返回 true 时以 allow 结束，不调用守卫，不更新停机计数
  skip?(event: HostEvent, env: Env): boolean
  allow(check: CheckArg): ProcessOutput
  // reason 非空；check 为 'before-prompt' 只出现在 promptGate 为支持的目标上
  deny(check: CheckArg, reason: string): ProcessOutput
  // 只在能力数据 rewriteInput 为 true 的目标上实现；复制原始入参并替换命令字段
  rewriteShell?(
    hostInput: Readonly<Record<string, unknown>>, command: string,
  ): ProcessOutput
  continueStop(reason: string): ProcessOutput
  dataDir(env: Env): string | null // 插件数据目录
}
export function runSubprocessEntry(protocol: SubprocessProtocol): Promise<void>
```

- 公共部分负责读取参数与 stdin、工具名换算、调用守卫、异常收口与停机计数；宿主字段名与
  输出格式只出现在协议实现中。
- 第一个参数缺失或不是 `CheckArg` 时，不读取 stdin，以退出码 1 结束并在 stderr 写原因，由宿主
  按能力数据中的 `failureDefault` 处理。
- `parse`：`sessionId` 必填；`check` 为 `before-tool` 时 `tool` 必填，为 `before-prompt` 时
  `prompt` 必填。缺失或类型不符时抛出 `Error`，`message` 为宿主字段路径（如 `tool_name`）。
  工具名换算为 `shell` 而 `tool.command` 缺失时，公共部分同样按输入无法解析处理，字段写
  `tool.command`。
- 以下情况执行前与提示提交前检查调用 `deny`，停机前检查调用 `allow` 并在 stderr 写同一原因：
  输入无法解析，原因为 `uapa: 无法解析宿主输入: <字段>`；守卫抛错或返回值无效，原因按第 4 节。
- 守卫未实现该检查，或检查为 `before-prompt` 而 `TargetRuntimeData.capabilities.promptGate`
  为 `false` 时，调用 `allow` 结束，不调用守卫。
- `skip` 在 `parse` 之后、调用守卫之前执行。v0.1.0 只有 `claude-code-subprocess.ts` 实现它：
  `__UAPA_MODULE_SESSION_ENV__` 不为 `null` 且 `env` 中该变量等于 `event.sessionId` 时返回 `true`。
- `rewrite` 只在规范名为 `shell` 且 `TargetRuntimeData.capabilities.rewriteInput` 为 `true` 时
  调用 `rewriteShell`，其余情况调用 `deny(fallbackReason)`。能力数据记为支持改写的目标必须
  实现 `rewriteShell`，记为不支持的不实现；各子进程目标的单元测试断言二者一致。
- 输出格式：`allow` 为退出码 0，stdout 与 stderr 为空；以 stdout JSON 表达的决策（改写、
  Copilot CLI 的拒绝，Claude Code、Codex 与 Copilot CLI 的停机继续）退出码为 0，stdout 为不缩进
  的 `JSON.stringify` 结果加一个换行；写入 stderr 的原因以一个换行结尾。
- `dataDir` 只读取宿主的插件数据目录变量，不用于判断宿主。Kimi Code 没有插件数据目录，
  `kimi-subprocess.ts` 的 `dataDir` 返回 `<os.tmpdir()>/uapa-<encodeURIComponent(插件名)>`（SD-06）。

## 4. 守卫返回值检查

```ts
// src/runtime/core/decisions.ts（F-04-04）：子进程入口与 hooks 模块入口共用，不做 I/O
export type Checked<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string }
// tool 为换算后的规范名；为 'shell' 时 rewrite.input.command 须为非空字符串
export function checkBeforeTool(value: unknown, tool: string): Checked<BeforeTool>
export function checkBeforePrompt(value: unknown): Checked<BeforePrompt>
export function checkBeforeStop(value: unknown): Checked<BeforeStop>
export function guardErrorReason(error: unknown): string // 'uapa: 守卫出错: <消息>'
```

- 未知 `kind`、缺字段、`reason` 或 `fallbackReason` 为空白、shell 的 `rewrite.input.command`
  不是非空字符串时返回 `ok: false`，`reason` 为 `uapa: 守卫返回值无效`。
- 两种形态的入口先以这些函数检查守卫的返回值或异常，再输出决策；抛错与无效返回值的处理见
  第 3 节（子进程）与 F-05-06（hooks 模块）。
