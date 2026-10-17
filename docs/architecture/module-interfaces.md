# UAPA 模块接口

本文定义各模块之间交换的数据与规则（v0.2.0 起增加的部分逐项注明）：名称、构建配置、源项目与
守卫声明、目标能力数据。宿主模块接口见[宿主模块接口](host-module-interface.md)，写出、比对、
退出码与命令行调用构建的契约见[写出、比对与退出码](build-output.md)；打包与入口见
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
  marketplace?: { // v0.4.0（F-01-14，SD-41）
    name: string // kebab-case
    owner: { name: string; email?: string }
    dir?: string // marketplace 根目录；默认为 outDir
  }
  hosts?: {
    'claude-code'?: HostDir & {
      displayName?: string; userConfig?: unknown
      dependencies?: unknown; $schema?: string
      manifest?: Readonly<Record<string, unknown>> // v0.4.0（F-05-20，SD-42）
      onFailure?: 'block' // v0.4.0（F-05-21，SD-43）
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
- `guard`、`outDir`、`dir` 与 `marketplace.dir` 相对配置文件所在目录，与当前目录无关；`hooksFile`
  是插件目录内的相对路径，不得为绝对路径或含 `..`。
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
- v0.4.0 的字段（F-01-14）另有以下情况配置校验失败，`field` 写到键：
  - `hosts['claude-code'].manifest` 不是对象，或含 UAPA 生成或依赖默认位置的键：`name`、
    `version`、`description`、`author`、`keywords`、`displayName`、`userConfig`、`dependencies`、
    `$schema`、`types`、`skills`、`agents`、`commands`、`mcpServers`（SD-42）。
  - `hosts['claude-code'].onFailure` 不是 `'block'`。
  - `marketplace.name` 不是 kebab-case，或 `owner.name` 为空。
  - `targets` 中没有 Claude Code 或 Codex 的目标却配置了 `marketplace`：agy 只支持官方
    marketplace，不生成文件（SD-41）。
  - `marketplace.dir` 等于或位于默认布局的插件目录内：该目录在写入前被清空。
  - Claude Code 或 Codex 的插件目录不等于也不位于 `marketplace.dir` 之内：两个宿主的
    marketplace 条目只接受以 `./` 开头、不含 `..` 的相对路径。

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
      readonly args?: readonly string[]; readonly env?: Readonly<Record<string, string>>
      readonly envVars?: readonly string[] } // v0.4.0（F-01-13，SD-40）
  | { readonly name: string; readonly kind: 'remote'; readonly url: string
      readonly headers?: Readonly<Record<string, string>> }
// v0.3.0（F-01-10，SD-32）：rules/ 下一层的 <name>.md；宿主模块按自身格式重写 frontmatter
export type RuleActivation = 'always' | 'model' | 'glob'
export interface Rule {
  readonly name: string // 文件名去掉 .md
  readonly path: string // 相对源项目根，如 'rules/style.md'
  readonly activation: RuleActivation
  readonly description: string | null // 未写为 null；activation 为 'model' 时不为 null
  readonly globs: readonly string[] // activation 为 'glob' 时非空，其余为空
  readonly body: string // frontmatter 结束行之后的原文，换行符不变
  readonly targets: readonly TargetName[] | null // 同 Skill.targets
}
// v0.3.0（F-01-11，SD-33）：commands/ 下一层的 <name>.md；整个文件原样复制
export interface Command {
  readonly name: string // 文件名去掉 .md
  readonly path: string // 相对源项目根，如 'commands/review.md'
  readonly targets: readonly TargetName[] | null // 同 Skill.targets
}
export interface SourceProject {
  readonly root: string // 配置文件所在目录的绝对路径
  readonly skills: readonly Skill[] // 按 name 排序
  readonly agents: readonly Agent[] // v0.2.0；按 name 排序，没有 agents/ 时为空
  readonly mcpServers: readonly McpServer[] // v0.2.0；按 name 排序，没有 mcp/servers.json 时为空
  readonly rules: readonly Rule[] // v0.3.0；按 name 排序，没有 rules/ 时为空
  readonly commands: readonly Command[] // v0.3.0；按 name 排序，没有 commands/ 时为空
  // overrides/<宿主>/ 下的文件，相对该目录，按字典序
  readonly overrides: Readonly<Partial<Record<HostName, readonly string[]>>>
  // v0.4.0（F-01-12，SD-37）：files/ 下的文件（递归），相对 files/，POSIX 分隔，按字典序；
  // 没有 files/ 时为空
  readonly files: readonly string[]
}

// src/runtime/core/types.ts（F-02-01），不由包入口导出；v0.2.0 增加 'afterTool'
export type GuardCheck = 'beforeTool' | 'beforePrompt' | 'beforeStop'

// src/source/guard.ts
export interface GuardDeclaration {
  readonly modulePath: string // 守卫逻辑的绝对路径，供打包使用
  readonly name: string // 只用于错误信息，不写入构建报告
  readonly requires: readonly Capability[]
  readonly checks: readonly GuardCheck[] // 默认导出上存在的方法；afterTool 自 v0.2.0（F-02-04）
  // v0.3.0（F-02-05）：默认导出的 options，按 name 排序；没有时为空；
  // GuardOption 见 hooks 适配第 2 节
  readonly options: readonly (GuardOption & { readonly name: string })[]
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
- v0.4.0（F-01-13）：本地服务器可写 `envVars`，为服务器需要从会话环境取得的变量名，非空、元素
  匹配 `^[A-Za-z_][A-Za-z0-9_]*$` 且不重复；远程服务器写 `envVars` 时返回 `InputIssue`，`field`
  写到元素，如 `mcpServers.docs.envVars[1]`。
- v0.4.0（F-01-12）：`files/` 只列出文件，不读取内容；复制由构建编排完成，见
  [写出、比对与退出码](build-output.md)。
- rules 与 commands（v0.3.0）只读各自目录下一层的 `.md` 文件，其他项忽略；`<name>` 只含字母、
  数字、`_`、`-`。rules 的 frontmatter 只允许 `activation`、`description`、`globs`、`targets`，其余
  规则见 F-01-10：未知键一律拒绝，因为宿主模块重写 frontmatter，未知键会被静默丢弃（SD-32）。
  commands 只校验 `description` 与 `targets`（F-01-11），其他键留在文件中，不进入 `Command`。
- 守卫选项（v0.3.0）：`readGuard` 按 F-02-05 校验默认导出的 `options`。选项名全大写后不得重复，
  因为 Claude Code 以全大写的环境变量传递取值（SD-35）。

## 4. 目标能力数据

```ts
// src/capabilities/types.ts；每个目标一个数据模块 src/capabilities/<宿主>-<形态>.ts
// 包内、manifest 字段、由宿主模块换算（v0.4.0，F-03-19）、不承载
export type Carrier = 'package' | 'manifest' | 'converted' | 'none'
export type FailMode = 'allow' | 'deny'
export interface TargetCapabilities {
  readonly target: TargetName
  readonly host: {
    readonly name: HostName
    readonly version: string // 核对时的宿主版本，或 '>=1.0.26' 形式的下限
    readonly checked: string // 核对日期 YYYY-MM-DD
    readonly source: string // docs/research/coding-agent-plugin-manifests/ 下的文件名
  }
  // rules、commands 自 v0.3.0（F-03-16）
  readonly components: Readonly<
    Record<'skills' | 'agents' | 'mcp' | 'hooks' | 'rules' | 'commands', Carrier>
  >
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
- `converted`（v0.4.0，F-03-19）：组件按 F-03-02 的规则与 `package` 一样进入 `TargetPlan`，由
  宿主模块换成宿主承载的其他组件，构建编排不为该目标原样复制。v0.4.0 中只有 Claude Code 两个
  目标与 Codex 的 `rules` 取该值（SD-38）；agy 的 `commands` 为 `package`（SD-39）。

## 5. 宿主模块接口

`TargetPlan`、`HostInput`、`HostResult`、`HostModule` 与各组件的生成规则见
[宿主模块接口](host-module-interface.md)。

## 6. 打包与入口

`TargetRuntimeData`、`BundleRequest`、入口文件名与 hooks 命令、`SubprocessProtocol` 见
[入口与打包接口](runtime-interfaces.md)。

## 7. 构建报告

`BuildReport`、`formatSummary` 与报告各字段的填写规则见[构建报告](build-report.md)。

## 8. 写出、比对与退出码

产物的放置顺序、写出、比对、退出码与命令行调用构建的契约见
[写出、比对与退出码](build-output.md)。
