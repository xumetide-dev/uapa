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
  // v0.3.0（F-04-09）：GuardDeclaration.options 的名称、类型与默认值，按 name 排序；没有时为空
  readonly options: readonly RuntimeOption[]
}
// 入口解析取值所需的部分：title 与 description 只写入 Claude Code 的 userConfig
export interface RuntimeOption {
  readonly name: string
  readonly type: GuardOption['type'] // 'string' | 'number' | 'boolean'
  readonly default: GuardOptionValue // 与 type 一致，由 readGuard 保证
}
export type GuardOptionValue = string | number | boolean // GuardContext.options 的值

// src/bundle/types.ts（F-03-11）：宿主模块与打包共用
interface BundleBase {
  // src/runtime/entries/ 下的入口名，不含扩展名，如 'codex-subprocess'；测试可传绝对路径
  readonly entry: string
  readonly guardModule: string // GuardDeclaration.modulePath
  readonly data: TargetRuntimeData
}
export type BundleRequest =
  // 'node'：只保留 node: 内置模块；子进程入口要调用的检查由 hooks 配置列出
  | (BundleBase & { readonly external: 'node' })
  // 'claude-code'：只保留 'claude-code'；hooks 模块入口只为 checks 中的检查注册处理函数
  | (BundleBase & { readonly external: 'claude-code'; readonly checks: readonly GuardCheck[] })

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
  declare const __UAPA_CHECKS__: Readonly<Record<GuardCheck, boolean>> // 只用于 hooks 模块入口
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
- `external` 为 `'claude-code'` 时，`bundle` 把 `__UAPA_CHECKS__.<检查名>` 替换为该检查是否在
  `checks` 中的布尔字面量，常量条件的分支由打包器移除。hooks 模块入口只在对应分支中注册处理函数；
  未计划停机前检查时，停机计数的 `atom` 声明（以 `/* @__PURE__ */` 标注）随之移除，产物中不留
  类型契约未声明的状态键（`validate` 对未声明的 `atom` 报错，即使不读写，见
  [本地实测](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#hooks-模块的静态校验)）。
- 打包结果中仍含 `bundle-names.d.ts` 声明的标识符（如以计算属性写 `__UAPA_CHECKS__[name]`）时
  打包失败：这些标识符在宿主中未定义。
- `bundle` 按 `import.meta.url` 相对自身定位入口与 `runtime/core`，定位方式对源码目录与
  `dist/` 目录结构都成立（从 `dist/` 打包由 F-10-05 验证）；结果只在内存中返回，不写文件。
  产物中的文件名由宿主模块决定。

## 2. 入口文件与 hooks 命令

| 目标 | 入口源码 | 产物中的文件 | hooks 命令 |
|---|---|---|---|
| `claude-code:in-process` | `claude-code-in-process.ts` | `hooks/uapa-guard.mjs`，由 `hooks/register.ts` 引入 | 不适用 |
| `claude-code:subprocess` | `claude-code-subprocess.ts` | `hooks/uapa-claude-code.mjs` | `node "${CLAUDE_PLUGIN_ROOT}/hooks/uapa-claude-code.mjs" <检查名>` |
| `codex:subprocess` | `codex-subprocess.ts` | `hooks/uapa-codex.mjs` | `node "${PLUGIN_ROOT}/hooks/uapa-codex.mjs" <检查名>`（经 shell 执行，`${PLUGIN_ROOT}` 由宿主在执行前替换） |
| `agy:subprocess` | `agy-subprocess.ts` | `hooks/uapa-agy.mjs` | `node hooks/uapa-agy.mjs <检查名>`（以插件目录为工作目录） |

预留目标（SD-26、SD-27）的入口：`copilot-cli:subprocess` 为
`com.github.copilot/hooks/uapa-copilot-cli.mjs`（命令见 F-07-03），`kimi:subprocess` 为
`hooks/uapa-kimi.mjs`（命令见 F-08-03）。

- `<检查名>` 为 `before-tool`、`before-prompt`、`before-stop` 或 `after-tool`（v0.2.0）。每个目标
  只有一个入口文件，各检查的 hook 命令只在该参数上不同；入口不读取宿主的事件名字段。
- `after-tool` 写在 `PostToolUse` 上，不写 matcher，只在 `TargetPlan.checks` 含 `afterTool` 时生成
  （SD-29：`withholdOutput` 为不支持的目标省略该检查，v0.2.0 中为 agy）。
- hooks 模块入口在 `tool.call` 上只注册一个不带 matcher 的处理函数：同一插件注册两个时模块校验
  失败（[本地实测](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#hooks-模块的-toolcall)）。
  执行前与执行后检查都在这一个处理函数中，任一检查在 `checks` 中时注册：先做执行前检查，放行
  或改写后 `await next(...)`，再做执行后检查；守卫抛错与返回值无效在处理函数内按第 4 节收口。
  `.catch` 中 `next.called` 为真且计划了执行后检查时返回 `{ deny }`（原因同 F-05-06 的固定原因），
  不以 `next(e)` 重放原输出；其余情况沿用 F-05-06。
- 守卫选项（v0.3.0，F-05-18）：宿主以 `register(on, options)` 传入插件选项的取值（带类型，未设置
  的为默认值，见[本地实测](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#commands-与-userconfig)）。
  生成的 `hooks/register.ts` 写作 `(on, options) => guard(on, options)`；hooks 模块入口在
  `register` 中以 `guardContext(optionsFromValues(data.options, options))`（第 3 节）得出各检查
  共用的取值，无效时与守卫抛错相同处理（F-05-06），原因为 `uapa: 守卫选项无效: <选项名>`。
- 规则输出脚本（v0.4.0，F-05-19、F-06-11）：宿主模块直接生成，不经 `bundle`，不导入任何模块。
  内容为一行 `process.stdout.write(<文本>)`，文本以 `JSON.stringify` 写成字面量：`always` 规则
  按名称排序，各自的 `Rule.body` 去掉首尾的换行后以一个空行连接，末尾一个换行。文件与命令：

  | 宿主 | 产物中的文件 | `SessionStart` 命令 |
  |---|---|---|
  | Claude Code | `hooks/uapa-rules-claude-code.mjs` | `node "${CLAUDE_PLUGIN_ROOT}/hooks/uapa-rules-claude-code.mjs"` |
  | Codex | `hooks/uapa-rules-codex.mjs` | `node "${PLUGIN_ROOT}/hooks/uapa-rules-codex.mjs"` |

  两个宿主的脚本不同名：按目标筛选后的 `always` 规则可能不同，合并布局中不因此冲突。宿主把
  该 hook 以 0 退出的纯文本 stdout 作为上下文加入（Claude Code 2.1.296 容器实测；Codex 按
  rust-v0.162.1 `hooks/src/events/session_start.rs`）。
- 不同宿主的生成文件不同名；例外是按 SD-07 处理的 hooks 配置。agy 的根 `plugin.json` 不能与
  其他宿主的根 `plugin.json` 合并（F-11-02）。

## 3. 子进程入口

```ts
// src/runtime/entries/subprocess.ts（公共部分）；各目标在 <宿主>-subprocess.ts 中实现协议
export type CheckArg = 'before-tool' | 'before-prompt' | 'before-stop' | 'after-tool'
export interface HostEvent {
  readonly sessionId: string
  readonly tool?: {
    readonly name: string
    readonly input: Readonly<Record<string, unknown>>
    // 宿主入参中有该宿主的命令字段且为字符串时取出；parse 不按工具名判断
    readonly command?: string
  }
  readonly prompt?: string
  // check 为 'after-tool' 时必填：宿主 stdin 中的工具输出原值（Claude Code 与 Codex 为
  // tool_response），原样保留，文本由 outputText 取出（第 4 节）
  readonly toolOutput?: unknown
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
  // v0.2.0：只在能力数据 replaceOutput 为 true 的目标上实现；output 为 replacedOutput 的结果
  replaceOutput?(output: unknown): ProcessOutput
  // v0.2.0：只在 withholdOutput 为 true 的目标上实现；以宿主的阻断写法交出 text，text 非空
  blockOutput?(text: string): ProcessOutput
  dataDir(env: Env): string | null // 插件数据目录
  // v0.3.0：只在有插件用户配置的目标上实现；返回选项取值的文本，未设置时返回 undefined
  optionValue?(name: string, env: Env): string | undefined
}
export function runSubprocessEntry(protocol: SubprocessProtocol): Promise<void>

// src/runtime/core/options.ts（F-04-09）：不做 I/O，子进程入口与 hooks 模块入口共用
export type OptionsResult =
  | { readonly ok: true; readonly options: Readonly<Record<string, GuardOptionValue>> }
  | { readonly ok: false; readonly name: string } // 按 name 顺序第一个无效的选项
// text 返回 undefined 时取 default；其余按 type 解析
export function optionsFromText(
  declared: readonly RuntimeOption[], text: (name: string) => string | undefined,
): OptionsResult
// values 为 hooks 模块收到的取值；不是对象时视为没有取值；缺少该键或为 undefined 时取
// default，类型不符或 number 不是有限数时无效
export function optionsFromValues(
  declared: readonly RuntimeOption[], values: unknown,
): OptionsResult
// 传给检查方法的 GuardContext；无效时 reason 为 `uapa: 守卫选项无效: <选项名>`。两种入口的
// callGuard 收到 ok 为 false 时不调用守卫，按守卫出错收口
export function guardContext(result: OptionsResult): Checked<GuardContext>
```

- 公共部分负责读取参数与 stdin、工具名换算、选项取值、调用守卫、异常收口与停机计数（计数文件
  的读写在 `src/runtime/entries/stop-counter.ts`）；宿主字段名与输出格式只出现在协议实现中。
- 第一个参数缺失或不是 `CheckArg` 时，不读取 stdin，以退出码 1 结束并在 stderr 写原因，由宿主
  按能力数据中的 `failureDefault` 处理。
- `parse`：`sessionId` 必填；`check` 为 `before-tool` 时 `tool` 必填，为 `before-prompt` 时
  `prompt` 必填，为 `after-tool` 时 `tool` 与 `toolOutput` 必填（宿主字段缺失时抛错，值可为任意
  JSON）。缺失或类型不符时抛出 `Error`，`message` 为宿主字段路径（如 `tool_name`）。
  工具名换算为 `shell` 而 `tool.command` 缺失时，公共部分同样按输入无法解析处理，字段写
  `tool.command`。
- 以下情况执行前与提示提交前检查调用 `deny`，停机前检查调用 `allow` 并在 stderr 写同一原因：
  输入无法解析，原因为 `uapa: 无法解析宿主输入: <字段>`；守卫抛错或返回值无效，原因按第 4 节；
  守卫选项无效（v0.3.0），原因为 `uapa: 守卫选项无效: <选项名>`。
- 守卫未实现该检查，或检查为 `before-prompt` 而 `TargetRuntimeData.capabilities.promptGate`
  为 `false`、为 `after-tool` 而 `withholdOutput` 为 `false` 时，调用 `allow` 结束，不调用守卫。
- 守卫选项（v0.3.0，SD-35）：要调用守卫时，公共部分先以
  `optionsFromText(data.options, name => protocol.optionValue?.(name, env))` 得出取值，再以
  `{ options }` 作为最后一个参数调用该检查；没有声明选项时 `options` 为空对象。文本的解析：string
  原样取用；number 要求去掉首尾空白后非空且 `Number(文本)` 为有限数；boolean 只接受 `true` 与
  `false`。只有 `claude-code-subprocess.ts` 实现 `optionValue`，返回
  `env['CLAUDE_PLUGIN_OPTION_' + 选项名的全大写]`（F-05-18）；Codex 与 agy 不实现，取 `default`
  （F-06-10、F-11-10）。
- 执行后检查（v0.2.0，SD-29）：以 `outputText(event.toolOutput)` 调用 `afterTool`。`keep` 调用
  `allow`；`replace` 与 `withhold` 交出的文本分别为 `text` 与 `reason`。交出文本时，`replaceOutput`
  为 `true` 且 `replacedOutput(event.toolOutput, 文本)` 不为 `null` 时调用 `replaceOutput`，否则调用
  `blockOutput`。目标缺 `replaceOutput` 时 `replace` 因此按扣留写出（构建报告的降级）。输入无法
  解析、守卫抛错或返回值无效时，以第 4 节的原因按扣留写出；输入无法解析时没有原值，调用
  `blockOutput`。守卫选项无效时，以 `uapa: 守卫选项无效: <选项名>` 按扣留写出。
- 各目标的写法：Claude Code 的 `replaceOutput` 为 stdout
  `{"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedToolOutput":<output>}}`，
  `blockOutput` 为 `{"decision":"block","reason":<text>}`（只附加原因，模型仍读到原输出，由
  宿主模块记为残余风险）；Codex 只实现 `blockOutput`，写法相同，宿主以 `reason` 替换输出；
  agy 两者都不实现。退出码均为 0。
- `skip` 在 `parse` 之后、调用守卫之前执行。v0.1.0 只有 `claude-code-subprocess.ts` 实现它：
  `__UAPA_MODULE_SESSION_ENV__` 不为 `null` 且 `env` 中该变量等于 `event.sessionId` 时返回 `true`。
- `rewrite` 只在规范名为 `shell` 且 `TargetRuntimeData.capabilities.rewriteInput` 为 `true` 时
  调用 `rewriteShell`，其余情况调用 `deny(fallbackReason)`。能力数据记为支持改写的目标必须
  实现 `rewriteShell`，记为不支持的不实现；各子进程目标的单元测试断言二者一致。
- 输出格式：`allow` 为退出码 0，stdout 与 stderr 为空；agy 例外，其执行前 hook 的 stdout 不是含
  `decision` 的 JSON 时宿主阻断，`allow` 在执行前检查输出 `{"decision":"allow"}`、在停机前检查
  输出 `{}`（F-11-04）。以 stdout JSON 表达的决策（改写、agy 的放行与拒绝，Claude Code、Codex 与
  agy 的停机继续）退出码为 0，stdout 为不缩进的 `JSON.stringify` 结果加一个换行；写入 stderr 的
  原因以一个换行结尾。
- `dataDir` 只读取宿主的插件数据目录变量，不用于判断宿主。agy 的 hook 进程中没有插件数据目录
  变量（1.3.4 与 1.3.5 实测，SD-46），`agy-subprocess.ts` 的 `dataDir` 返回
  `<os.tmpdir()>/uapa-<encodeURIComponent(插件名)>`（SD-06）。

## 4. 守卫返回值与执行后输出

```ts
// src/runtime/core/decisions.ts（F-04-04）：子进程入口与 hooks 模块入口共用，不做 I/O
export type Checked<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string }
// tool 为换算后的规范名；为 'shell' 时 rewrite.input.command 须为非空字符串
export function checkBeforeTool(value: unknown, tool: string): Checked<BeforeTool>
export function checkBeforePrompt(value: unknown): Checked<BeforePrompt>
export function checkBeforeStop(value: unknown): Checked<BeforeStop>
export function checkAfterTool(value: unknown): Checked<AfterTool> // v0.2.0（F-04-08）
export function guardErrorReason(error: unknown): string // 'uapa: 守卫出错: <消息>'

// src/runtime/core/output.ts（F-04-08）：两种形态共用，不做 I/O，按输出的形状判断，不按工具名
export function outputText(output: unknown): string
// 返回替换后的宿主输出；形状不在下表之列时返回 null
export function replacedOutput(output: unknown, text: string): unknown
```

- 未知 `kind`、缺字段、`reason` 或 `fallbackReason` 为空白、shell 的 `rewrite.input.command`
  不是非空字符串、`replace.text` 不是字符串或为空白时返回 `ok: false`，`reason` 为
  `uapa: 守卫返回值无效`。
- 两种形态的入口先以这些函数检查守卫的返回值或异常，再输出决策；抛错与无效返回值的处理见
  第 3 节（子进程）与 F-05-06（hooks 模块）。执行后检查的这两种情况都按扣留写出（F-04-08）。

工具输出的形状（SD-29）：

| 输出 | `outputText` | `replacedOutput` |
|---|---|---|
| 字符串（Codex 的执行命令与 `apply_patch`，Claude Code hooks 模块报错的 `result`） | 原值 | `null` |
| 对象，`stdout` 为字符串（Claude Code 的 Bash） | `stdout`；`stderr` 为非空字符串时另接一个换行与 `stderr` | 复制对象，`stdout` 换为文本；有 `stderr` 字段时置为 `''` |
| 对象，`file.content` 为字符串（Claude Code 的 Read） | `file.content` | 复制对象与 `file`，`file.content` 换为文本 |
| 其他 | `JSON.stringify` 的结果；没有 JSON 文本（`undefined`）时为空串 | `null` |

hooks 模块入口的执行后检查（F-05-13）：`next` 的结果含 `deny` 时原样返回，不调用 `afterTool`；
否则以 `outputText(ran.result)` 调用，报错的结果（`isError` 为真）同样检查。`keep` 返回 `ran`；
交出文本时，`replacedOutput(ran.result, 文本)` 不为 `null` 且为替换则返回 `{ ...ran, result }`，
其余情况返回 `{ deny: 文本 }`。执行后检查收到的调用按交给 `next` 的事件换算，改写后为新命令；
入参无法换算时（规范名为 `shell` 而缺命令）不调用 `next`，返回
`{ deny: 'uapa: 无法解析宿主输入: <字段>' }`，只计划执行后检查时同样如此。
