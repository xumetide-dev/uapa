# UAPA 模块接口

本文定义各模块之间交换的数据与规则（v0.2.0 增加的部分逐项注明）：名称、构建配置、源项目与
守卫声明、目标能力数据、宿主模块接口，以及写出、比对、退出码与命令行调用构建的契约；打包与入口见
[入口与打包接口](runtime-interfaces.md)，构建报告见[构建报告](build-report.md)，
原样声明的命令 hooks 见[命令 hooks 声明](command-hooks.md)。模块职责与依赖方向见
[架构 §1](architecture.md#1-组成与模块)，守卫公共类型见
[hooks 适配 §2](../research/coding-agent-plugin-manifests/uapa-hook-adapters.md#2-公共类型)。
代码块中的类型是实现时的约定，字段名与文件位置以本文为准；宿主行为以宿主调研文档为准。

## 1. 名称

```ts
// src/config/targets.ts：目标名与宿主标识的唯一定义处
export type HostName = 'claude-code' | 'codex' | 'agy'
export type TargetName =
  | 'claude-code:in-process' | 'claude-code:subprocess'
  | 'codex:subprocess' | 'agy:subprocess'
```

- 目标名为 `<宿主>:<形态>`。宿主标识用于配置的 `hosts` 键、`overrides/<宿主>/`、
  `src/targets/<宿主>/` 与默认插件目录名。
- `source`、`capabilities`、`targets` 从 `src/config/targets.ts` 引用这两个类型与名称列表。
- v0.1.0 完成时为上面的取值；`copilot-cli`、`kimi` 及其目标名为预留（SD-26、SD-27），恢复排期时
  登记。实现过程中，目标名与宿主标识随该目标的能力数据一起登记：M2 登记 `claude-code:subprocess`
  （F-05-01），M4 登记 `codex:subprocess`、`agy:subprocess`（F-06-01、F-11-01），M5 登记
  `claude-code:in-process`（F-05-14）；未登记的目标名按未知目标名处理。

## 2. 构建配置

```ts
// src/config/types.ts，由 src/index.ts 导出
interface HostDir { dir?: string } // 该宿主的插件目录；默认 `<outDir>/<宿主>`
export interface UapaConfig {
  name: string // 插件名，写入各宿主 manifest；各宿主的命名约束由宿主模块检查
  version: string // semver
  description: string
  author?: { name: string; email?: string; url?: string }
  keywords?: readonly string[]
  guard?: string // 守卫逻辑文件；省略时不生成入口与守卫条目
  targets: readonly TargetName[] // 非空，不重复
  outDir?: string // 输出根目录，默认 'dist'；构建报告写在这里
  commandHooks?: readonly CommandHookDecl[] // 原样声明的命令 hooks，见 command-hooks.md
  hosts?: {
    'claude-code'?: HostDir & {
      displayName?: string; userConfig?: unknown
      dependencies?: unknown; $schema?: string
    }
    codex?: HostDir & {
      interface?: Readonly<Record<string, unknown>>; hooksFile?: string
    }
    agy?: HostDir
  }
}
export function defineConfig(config: UapaConfig): UapaConfig
```

- `uapa.config.ts` 以 `export default` 导出 `UapaConfig`，可写作
  `export default defineConfig({ ... })`；默认导出缺失或不是对象时，`loadConfig` 返回
  `InputIssue`（`field` 为 `null`）。
- `guard`、`outDir` 与 `dir` 相对配置文件所在目录，与当前目录无关；`hooksFile` 是插件目录内的
  相对路径，不得为绝对路径或含 `..`。
- 构建报告、终端摘要、stderr 与 `--check` 差异行中的路径一律相对配置文件所在目录，POSIX 分隔，
  不以 `./` 开头，不带结尾 `/`；该目录本身写作 `.`。

```ts
// src/config/layout.ts（F-01-03）：配置校验与构建编排共用
export interface PluginDir {
  readonly path: string // 绝对路径
  readonly hosts: readonly HostName[] // 写入该目录的已配置宿主，按 targets.ts 中的顺序
}
export function resolvePluginDirs(config: UapaConfig, root: string): readonly PluginDir[]
```

- 布局按目录判定：`hosts` 含两个以上宿主的目录为合并布局（F-03-06），其余为默认布局
  （F-03-05）；同一次构建可以同时有两种目录。
- 默认布局下写入前要清空插件目录，因此插件目录不得等于或包含源项目根目录、`outDir` 或另一宿主
  的插件目录；合并布局的插件目录可以是源项目根目录。
- 以下情况配置校验失败（F-01-03）：`hosts` 中出现未列入 `targets` 的宿主、出现未知键、
  `hosts.codex.hooksFile` 为绝对路径或含 `..`，或违反上一条。

## 3. 源项目与守卫声明

```ts
// src/source/types.ts
export interface Skill {
  readonly name: string
  readonly dir: string // 相对源项目根，如 'skills/review'
  readonly files: readonly string[] // 相对 dir，递归列出全部文件（含 SKILL.md），按字典序
  readonly targets: readonly TargetName[] | null // frontmatter 的 targets；未写为 null
}
// v0.2.0（F-01-07，SD-30）：agents/ 下一层的 <name>.md
export interface Agent {
  readonly name: string // frontmatter 的 name，与文件名去掉 .md 相同
  readonly path: string // 相对源项目根，如 'agents/reviewer.md'
  readonly targets: readonly TargetName[] | null // 同 Skill.targets
}
// v0.2.0（F-01-08，SD-30）：mcp/servers.json 的 mcpServers；未写的字段不出现
export type McpServer =
  | { readonly name: string; readonly kind: 'local'; readonly command: string
      readonly args?: readonly string[]; readonly env?: Readonly<Record<string, string>> }
  | { readonly name: string; readonly kind: 'remote'; readonly url: string
      readonly headers?: Readonly<Record<string, string>> }
export interface SourceProject {
  readonly root: string // 配置文件所在目录的绝对路径
  readonly skills: readonly Skill[] // 按 name 排序
  readonly agents: readonly Agent[] // v0.2.0；按 name 排序，没有 agents/ 时为空
  readonly mcpServers: readonly McpServer[] // v0.2.0；按 name 排序，没有 mcp/servers.json 时为空
  // overrides/<宿主>/ 下的文件，相对该目录，按字典序
  readonly overrides: Readonly<Partial<Record<HostName, readonly string[]>>>
}

// src/runtime/core/types.ts（F-02-01），不由包入口导出；v0.2.0 增加 'afterTool'
export type GuardCheck = 'beforeTool' | 'beforePrompt' | 'beforeStop'

// src/source/guard.ts
export interface GuardDeclaration {
  readonly modulePath: string // 守卫逻辑的绝对路径，供打包使用
  readonly name: string // 只用于错误信息，不写入构建报告
  readonly requires: readonly Capability[]
  readonly checks: readonly GuardCheck[] // 默认导出上存在的方法；afterTool 自 v0.2.0（F-02-04）
}
```

- 守卫逻辑以 `export default` 导出 `GuardPlugin`。
- 状态文件名与去重变量名由配置的 `name` 派生，不使用守卫的 `name`。
- agents 只读 `agents/` 下一层的 `.md` 文件，其他项忽略（与 skills 忽略非目录项相同）；frontmatter
  的 `name`、`description` 为非空字符串，`name` 与文件名不同时返回 `InputIssue`，`targets` 的规则
  同 skills（F-01-05）。
- `mcp/servers.json` 的顶层只有 `mcpServers`，值为服务器名到配置的映射；服务器名只含字母、数字、
  `_`、`-`。本地服务器的 `command` 为非空字符串，`args` 为字符串数组，`env` 为字符串到字符串的
  映射；远程服务器的 `url` 为非空字符串，`headers` 为字符串到字符串的映射。插件根写作
  `{pluginRoot}`，只出现在本地服务器的这三个字段中。其他字段、类型不符、两类字段混用、远程服务器
  含 `{pluginRoot}` 时返回 `InputIssue`，`field` 写到服务器名与字段，如
  `mcpServers.docs.args[0]`。

## 4. 目标能力数据

```ts
// src/capabilities/types.ts；每个目标一个数据模块 src/capabilities/<宿主>-<形态>.ts
export type Carrier = 'package' | 'manifest' | 'none' // 包内、manifest 字段、不承载
export type FailMode = 'allow' | 'deny'
export interface TargetCapabilities {
  readonly target: TargetName
  readonly host: {
    readonly name: HostName
    readonly version: string // 核对时的宿主版本，或 '>=1.0.26' 形式的下限
    readonly checked: string // 核对日期 YYYY-MM-DD
    readonly source: string // docs/research/coding-agent-plugin-manifests/ 下的文件名
  }
  readonly components: Readonly<Record<'skills' | 'agents' | 'mcp' | 'hooks', Carrier>>
  readonly capabilities: Readonly<Record<Capability, boolean>> // 未实测记为 false
  // hook 进程出错（非预期退出码、崩溃、无法启动）与超时时宿主的处理
  readonly failureDefault: Readonly<
    Record<GuardCheck, { error: FailMode; timeout: FailMode }>
  >
  readonly hookTimeoutSeconds: number | null // 写入 hooks 配置的超时；null 为字段未核实、不写
  readonly defaultTimeoutSeconds: number | null // 宿主默认超时；进程内目标为 null
  readonly toolNames: ToolNameMap // 宿主工具名 → 规范名，类型定义在 runtime/core
  // 命令 hooks 声明的事件 → 宿主事件名；null 为不承载或调研未记载（command-hooks.md）
  readonly commandHookEvents: Readonly<Record<CommandHookEvent, string | null>>
}

// src/capabilities/index.ts：能力数据的登记处，条目由各目标的能力数据功能加入；构建编排只经此取得
export const targetCapabilities: Readonly<Record<TargetName, TargetCapabilities>>
```

- `ToolNameMap` 为 `Readonly<Record<string, CanonicalTool>>`，与 `CanonicalTool`（hooks 适配第 3 节
  的规范名）一起定义在 `src/runtime/core/types.ts`。它以宿主工具名为键，一个规范名可对应多个
  宿主工具名（如 Claude Code 的 `Bash` 与 `PowerShell` 都对应 `shell`）。
- 取值见 hooks 适配第 4、6、7、8 节；宿主升级后只改数据模块。`targetCapabilities` 的键为全部
  已登记的目标名，漏登记时 `tsc` 报错。
- `toolNames` 取自[跨平台对比「工具名差异」](../research/coding-agent-plugin-manifests/cross-platform-comparison.md#工具名差异)；
  agy 的工具名为 stdin `toolCall.name` 的取值（`run_command`、`view_file` 等）。
- `failureDefault` 中调研未记载的组合记为 `'allow'`，并在数据模块中注明“文档未写明”。

## 5. 宿主模块接口

```ts
// src/targets/types.ts：宿主模块与构建编排之间的契约
export interface TargetPlan { // 构建编排按能力数据算出（F-03-02、F-03-13）
  readonly target: TargetName
  readonly capabilities: TargetCapabilities
  readonly skills: readonly Skill[] // 已按 frontmatter 与承载能力筛选
  readonly agents: readonly Agent[] // v0.2.0；规则同 skills
  readonly mcpServers: readonly McpServer[] // v0.2.0；目标不承载 MCP 时为空
  readonly checks: readonly GuardCheck[] // 本目标要生成 hook 的检查；已去掉省略的检查
  readonly commandHooks: readonly CommandHookDecl[] // 本目标承载的命令 hooks 声明（F-03-15）
}
export interface HostInput {
  readonly config: UapaConfig // 已校验
  readonly plans: readonly TargetPlan[] // 该宿主通过能力检查的目标，至少一个
  readonly guard: GuardDeclaration | null
  // 与本宿主写入同一插件目录的其他宿主，按 targets.ts 中的顺序；默认布局为空
  readonly sharedWith: readonly HostName[]
  readonly bundle: (request: BundleRequest) => Promise<string> // 见入口与打包接口
}
export interface OutputFile {
  readonly path: string // 相对插件目录，POSIX 分隔，不含 '..'
  readonly content: string | Uint8Array
  // 预留（F-03-07）：按命名空间合并，解析后比较 extensions 以外的字段；v0.1.0 不设置
  readonly merge?: 'json-extensions'
  // 合并布局中与其他宿主的同名文件冲突时，附在冲突错误之后
  readonly conflictHint?: string
}
export interface TargetNote { readonly target: TargetName; readonly message: string }
// v0.2.0：宿主模块按宿主格式判定的跳过项，如 SD-30 中不能换算插件根的 MCP 服务器
export interface TargetSkip {
  readonly target: TargetName; readonly component: string; readonly reason: string
}
export type HostResult =
  | { readonly ok: true; readonly files: readonly OutputFile[];
      readonly skipped: readonly TargetSkip[]; readonly residualRisks: readonly TargetNote[] }
  | { readonly ok: false; readonly errors: readonly TargetNote[] }
export type VerifyResult =
  | { readonly status: 'passed' }
  | { readonly status: 'failed'; readonly errors: readonly string[] }
  | { readonly status: 'skipped'; readonly reason: string } // 如本机没有宿主命令
export interface HostModule {
  readonly host: HostName
  // 不读写磁盘；没有 verify 的宿主在此做字段白名单检查
  generate(input: HostInput): Promise<HostResult>
  verify?(dir: string): Promise<VerifyResult> // 宿主校验命令，dir 为绝对路径；见 F-03-14
}
```

- `src/targets/index.ts` 导出登记处 `hostModules: Readonly<Record<HostName, HostModule>>`，各宿主
  的条目由该宿主的 manifest 功能（F-05-02、F-06-02、F-11-02）加入。构建编排只导入
  `src/targets/index.ts` 与 `src/targets/types.ts`；宿主模块不导入 `src/build/`，宿主模块之间互不导入。
- `src/build/` 的内部函数以参数接收 `hostModules` 与 `targetCapabilities`，`build` 传入两个登记处；
  构建编排的单元测试传入测试用的宿主模块与能力数据，不依赖宿主功能模块。
- 能力检查在调用宿主模块之前完成：未通过的目标不进入 `plans`，同一宿主的其余目标照常生成。
  该宿主没有剩余目标时不调用宿主模块。
- `generate` 返回 `ok: false` 或抛错时，`plans` 中的全部目标失败，该宿主不写出任何文件；
  其他宿主不受影响。错误不属于单个目标时（插件名、manifest 字段检查等），宿主模块为 `plans` 中
  每个目标各返回一条相同 `message` 的 `TargetNote`。
- skills 由构建编排按插件目录放置（F-03-04）：复制写入该目录的成功目标 `TargetPlan.skills`
  的并集。宿主按目录加载 skills，因此某 skill 被复制（或合并布局的插件目录就是源项目根目录）
  而不在同目录某目标的 `skills` 中时，该目标的残余风险写明“skill <name> 不适用于本目标，但
  与其他目标共用插件目录，宿主仍会加载”。宿主模块不返回 skill 文件。
- agents（v0.2.0，SD-30）同样由构建编排按插件目录放置：把写入该目录的成功目标 `TargetPlan.agents`
  的并集原样复制为 `agents/<name>.md`，不适用于同目录某目标的 agent 按上一条写残余风险（不承载
  agents 的目标不加载该目录，不写）；宿主模块不返回 agent 文件。
- MCP 服务器（v0.2.0，SD-30）由宿主模块按 `TargetPlan.mcpServers` 生成：Claude Code 为
  `.mcp.json`，Codex 为 `mcp.json`，agy 为 `mcp_config.json`，顶层都为 `mcpServers`，服务器按名称
  排序；不能换算的服务器不写入，返回 `TargetSkip`。没有要写入的服务器时不生成该文件，manifest
  不写指向它的字段（Codex 的例外见下文）。
- 宿主模块只按 `TargetPlan.checks` 决定生成哪些 hook，不读取 `guard.checks` 或能力数据推导。
  `TargetPlan.checks` 为空（未配置守卫，或检查全部被省略）时，宿主模块不为该目标生成入口；
  `checks` 与 `commandHooks` 都为空时，也不生成 hooks 配置，manifest 中不写指向它们的字段
  （Codex manifest 的 `hooks`、Claude Code `hooks/hooks.json`
  中该形态的键）；对象因此为空时不写该对象。同一宿主的目标都为空时不生成 `hooks/` 目录。`TargetPlan.skills` 为空时，manifest 不写指向 skills 的字段。
- 宿主模块只读取 `config.hosts` 中本宿主的选项。JSON 文件由宿主模块序列化：键序为固定的插入
  顺序，两空格缩进，结尾换行。
- 预留（F-03-07）：标为 `json-extensions` 的文件合并时，以宿主标识在 `src/config/targets.ts` 中排在最前的宿主
  的文件为基准，保留其键序；`extensions` 中各命名空间按字典序写出；按上一条的格式序列化。
- Codex 的 `.codex-plugin/plugin.json` 依次写 `name`、`version`、`description`，配置有值时写
  `keywords`，再按需写 `hooks`、`mcpServers`、`interface`（F-06-02、F-06-06）。没有 hooks 配置而
  `sharedWith` 非空时，`hooks` 写 `{"hooks": {}}`，使 Codex 不读取其他宿主写出的
  `hooks/hooks.json`；同理，生成了 `mcp.json` 时 `mcpServers` 写 `"./mcp.json"`，没有而
  `sharedWith` 非空时写 `{}`，使 Codex 不读取 Claude Code 写出的 `.mcp.json`。
- `sharedWith` 由构建编排按 `resolvePluginDirs` 得出，与目标是否成功无关；宿主模块只用它决定
  manifest 的写法与残余风险（F-06-02、F-06-03、F-11-03），不据此读取其他宿主的文件。
- `$schema` 格式的根 `plugin.json`（预留的 Copilot CLI）顶层依次写 `$schema`
  （`https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`）、`name`、`version`、
  `description`，配置有值时写 `author`、`keywords`，最后写 `extensions`（没有内容时不写）；各宿主
  只在 `extensions` 的本宿主命名空间中写专有字段。

## 6. 打包与入口

`TargetRuntimeData`、`BundleRequest`、入口文件名与 hooks 命令、`SubprocessProtocol` 见
[入口与打包接口](runtime-interfaces.md)。

## 7. 构建报告

`BuildReport`、`formatSummary` 与报告各字段的填写规则见[构建报告](build-report.md)。

## 8. 写出、比对与退出码

- 默认布局：某宿主至少一个目标生成成功时，先清空该插件目录再写入；全部失败时目录保持原状。
- 合并布局：只写入生成的文件，不删除目录中的其他文件。同名文件冲突（F-03-06、F-03-07）时，
  写入该目录的全部目标失败，该目录不写入任何文件；冲突错误写明文件与冲突的宿主，生成该文件的
  宿主模块给出 `conflictHint` 时附在其后。组件删除或改名后留下的旧文件需手动删除。
- 覆盖文件：宿主模块生成之后、写出之前，用 `overrides/<宿主>/` 中的文件覆盖或新增同名文件
  （F-03-12）；覆盖文件不做字段白名单检查。覆盖生成文件时继承该文件的合并标记，新增的覆盖文件
  不带标记。
- 宿主校验：写出后，对本次写出了文件且实现了 `verify` 的宿主模块调用（F-03-14）。`failed` 或
  `verify` 抛错时该宿主的目标失败，已写出的文件保留；`--check` 不调用。
- 比对：`--check` 在内存中生成全部产物，与磁盘逐字节比对，不写文件。差异按路径字典序排列，
  为 `added`、`modified`，默认布局另有写入前会被清除的 `removed`；路径写法见 §2。失败的目标
  不产生 `added`、`modified`；默认布局下某宿主的目标全部失败时不比对该目录，部分失败时按成功
  目标的产物计算 `removed`，与实际构建清空后的结果一致。

| 退出码 | 条件 | 写文件 |
|---|---|---|
| 0 | 全部目标成功；`--check` 时另须无差异 | 构建时写出；`--check` 不写 |
| 1 | 至少一个目标失败（能力检查、宿主生成与字段检查、合并冲突、宿主校验），或 `--check` 有差异 | 成功的目标照常写出；`--check` 不写 |
| 2 | 命令行用法错误；配置加载或校验失败（F-01-02、F-01-03）；源项目读取失败（F-01-04～F-01-06）；守卫加载失败（F-02-03）；宿主模块之外的未预期异常 | 不构建任何目标，不写报告；未预期异常发生前已写出的文件保留 |

命令行与构建编排之间的调用：

```ts
// src/config/issues.ts：配置、源项目与守卫读取共用的输入错误
export interface InputIssue {
  readonly file: string | null // 相对配置文件所在目录，POSIX 分隔；没有对应文件时为 null
  // 字段路径以 . 连接，数组下标写作 [n]，如 'targets[2]'、'hosts.codex.hooksFile'
  readonly field: string | null
  readonly message: string
}
export type Loaded<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly InputIssue[] }
// src/config/load.ts（F-01-02、F-01-03）
export function loadConfig(configPath: string): Promise<Loaded<UapaConfig>>
// src/source/index.ts（F-01-04～F-01-06）与 src/source/guard.ts（F-02-03）
export function readSource(config: UapaConfig, root: string):
  Promise<Loaded<SourceProject>>
export function readGuard(config: UapaConfig, root: string):
  Promise<Loaded<GuardDeclaration | null>>
// src/build/index.ts：cli 与构建编排之间的契约；root 为配置文件所在目录的绝对路径
export interface FileChange {
  readonly change: 'added' | 'modified' | 'removed'
  readonly path: string // 写法见 §2
}
export type BuildOutcome =
  | { readonly kind: 'input-error'; readonly issues: readonly InputIssue[] }
  | { readonly kind: 'done'; readonly report: BuildReport
      readonly reportPath: string | null // 写法见 §2；--check 时为 null
      readonly changes: readonly FileChange[] | null } // 只在 --check 时非 null
export function build(
  config: UapaConfig, root: string, options: { readonly check: boolean },
): Promise<BuildOutcome>
```

- `cli` 调用 `loadConfig`，失败时以退出码 2 结束；成功后调用 `build`。`build` 先调用
  `readSource` 与 `readGuard`，任一返回 `ok: false` 时返回 `input-error`，不写任何文件。
- 退出码只由 `cli` 计算：`input-error` 为 2；`done` 时有目标 `failed` 或 `changes` 非空为 1，
  否则为 0；`build` 抛出的异常由 `cli` 捕获，按 2 处理并输出堆栈。
- stderr 每条错误一行。`InputIssue` 写作 `uapa: <file>[: <field>]: <message>`，`file` 为 `null`
  时省略该部分；目标失败时，报告中该目标的每条 `errors` 另写作 `uapa: <目标名>: <原因>`。
- stdout：`uapa build` 只写终端摘要；`uapa build --check` 只写差异行 `<change> <path>`，无差异时
  为空；`--help` 与 `--version` 输出到 stdout，以 0 结束。
