# UAPA 宿主模块接口

本文是[模块接口](module-interfaces.md) §5 的内容：构建编排与宿主模块之间的契约，以及各组件
由谁生成、怎样生成。名称、配置、源项目与能力数据的类型见模块接口 §1～§4，写出与比对见
[写出、比对与退出码](build-output.md)。代码块中的类型是实现时的约定，字段名与文件位置以
本文为准；宿主行为以宿主调研文档为准。

## 类型

```ts
// src/targets/types.ts：宿主模块与构建编排之间的契约
export interface TargetPlan { // 构建编排按能力数据算出（F-03-02、F-03-13）
  readonly target: TargetName
  readonly capabilities: TargetCapabilities
  readonly skills: readonly Skill[] // 已按 frontmatter 与承载能力筛选
  readonly agents: readonly Agent[] // v0.2.0；规则同 skills
  readonly mcpServers: readonly McpServer[] // v0.2.0；目标不承载 MCP 时为空
  readonly rules: readonly Rule[] // v0.3.0；规则同 skills（F-03-16）
  readonly commands: readonly Command[] // v0.3.0；规则同 skills（F-03-16）
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
  // v0.4.0（F-03-18，SD-41）：配置 marketplace 时为本宿主插件目录相对 marketplace.dir 的路径，
  // 以 './' 开头，两者相同时为 './'；未配置时为 null
  readonly marketplaceSource: string | null
}
export interface OutputFile {
  readonly path: string // 相对插件目录，POSIX 分隔，不含 '..'
  readonly content: string | Uint8Array
  // v0.3.0（F-03-07）：按命名空间合并，解析后比较 extensions 以外的字段；现有宿主模块不设置
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
      readonly skipped: readonly TargetSkip[]; readonly residualRisks: readonly TargetNote[]
      // v0.4.0（F-03-18）：路径相对 marketplace.dir；没有时省略
      readonly marketplaceFiles?: readonly OutputFile[] }
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
  `src/targets/index.ts` 与 `src/targets/types.ts`；宿主模块不导入 `src/build/`，宿主模块之间
  互不导入。
- 多个宿主共用的生成函数放在 `src/targets/` 下的宿主无关文件中，宿主模块可以导入，它们不导入
  任何宿主模块。v0.4.0 起只有 `rule-skills.ts`：规则技能文件、`always` 规则的文本与输出脚本，
  以及共用插件目录时不适用规则的残余风险（F-05-19、F-06-11）。
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
- commands（v0.3.0，SD-33）的放置与残余风险同 agents：并集原样复制为 `commands/<name>.md`；宿主
  模块不返回 command 文件。Codex 安装时把命令转换为技能，转换的限制由 Codex 宿主模块写为残余
  风险（F-06-09）。
- rules（v0.3.0，SD-32）由宿主模块按 `TargetPlan.rules` 生成，frontmatter 换为宿主格式，正文为
  `Rule.body`；v0.3.0 中只有 agy 承载（F-11-09），v0.4.0 的换算见下文。
- MCP 服务器（v0.2.0，SD-30）由宿主模块按 `TargetPlan.mcpServers` 生成：Claude Code 为
  `.mcp.json`，Codex 为 `mcp.json`，agy 为 `mcp_config.json`，顶层都为 `mcpServers`，服务器按名称
  排序；不能换算的服务器不写入，返回 `TargetSkip`。没有要写入的服务器时不生成该文件，manifest
  不写指向它的字段（Codex 的例外见下文）。
- 宿主模块只按 `TargetPlan.checks` 决定生成哪些 hook，不读取 `guard.checks` 或能力数据推导。
  `TargetPlan.checks` 为空（未配置守卫，或检查全部被省略）时，宿主模块不为该目标生成入口；
  `checks` 与 `commandHooks` 都为空时，也不生成 hooks 配置，manifest 中不写指向它们的字段
  （Codex manifest 的 `hooks`、Claude Code `hooks/hooks.json`
  中该形态的键）；对象因此为空时不写该对象。同一宿主的目标都为空时不生成 `hooks/` 目录。
  `TargetPlan.skills` 为空时，manifest 不写指向 skills 的字段。
- 宿主模块只读取 `config.hosts` 中本宿主的选项。JSON 文件由宿主模块序列化：键序为固定的插入
  顺序，两空格缩进，结尾换行。
- v0.3.0（F-03-07）：标为 `json-extensions` 的文件合并时，以宿主标识在 `src/config/targets.ts`
  中排在最前的宿主的文件为基准，保留其键序；`extensions` 中各命名空间按字典序写出；按上一条的
  格式序列化。
- Codex 的 `.codex-plugin/plugin.json` 依次写 `name`、`version`、`description`，配置有值时写
  `keywords`，再按需写 `hooks`、`mcpServers`、`interface`（F-06-02、F-06-06）。没有 hooks 配置而
  `sharedWith` 非空时，`hooks` 写 `{"hooks": {}}`，使 Codex 不读取其他宿主写出的
  `hooks/hooks.json`；同理，生成了 `mcp.json` 时 `mcpServers` 写 `"./mcp.json"`，源项目有服务器
  而全部跳过、`sharedWith` 非空时写 `{}`，使 Codex 不读取 Claude Code 为这些服务器写出的
  `.mcp.json`；源项目没有服务器时其他宿主也不生成 MCP 配置，不写。
- `sharedWith` 由构建编排按 `resolvePluginDirs` 得出，与目标是否成功无关；宿主模块只用它决定
  manifest 的写法与残余风险（F-06-02、F-06-03、F-11-03），不据此读取其他宿主的文件。
- `$schema` 格式的根 `plugin.json`（预留的 Copilot CLI）顶层依次写 `$schema`
  （`https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`）、`name`、`version`、
  `description`，配置有值时写 `author`、`keywords`，最后写 `extensions`（没有内容时不写）；各宿主
  只在 `extensions` 的本宿主命名空间中写专有字段。

## v0.4.0 的生成规则

- rules 的换算（F-05-19、F-06-11，SD-38）：Claude Code 与 Codex 的宿主模块按 `plans` 中各目标
  `TargetPlan.rules` 的并集生成，按名称排序。
  - `model` 规则与有 `description` 的 `glob` 规则写为 `skills/<name>/SKILL.md`：frontmatter 依次写
    `name`、`description`（有值时）、`paths`（`glob` 规则，YAML 列表，模式原样）与
    `user-invocable: false`，正文为 `Rule.body`。两个宿主为同一条规则生成的文件逐字一致，合并
    布局中不冲突。
  - Codex 不读 `paths`、技能须有 `description`：没有 `description` 的 `glob` 规则返回
    `TargetSkip`（`component` 为 `rules/<name>.md`），有的写残余风险。
  - `always` 规则的正文写入规则输出脚本，由 `SessionStart` 命令 hook 运行，脚本与命令见
    [入口与打包接口 §2](runtime-interfaces.md#2-入口文件与-hooks-命令)；`plans` 中没有 `always`
    规则时不生成脚本与该条目。条目排在守卫条目之后、声明的命令 hooks 之前，结构与超时同守卫
    条目。只有 `claude-code:in-process` 进入 `plans` 时同样写该命令 hook，残余风险写明它需要 Node。
  - 规则被写出而不在某目标的 `TargetPlan.rules` 中时，按 skills 的写法为该目标写残余风险。
  - 生成的技能与源项目 skill 同路径时按[写出、比对与退出码](build-output.md)的同路径冲突处理，
    宿主模块不另行检查。
- Codex 的 commands（F-06-13，SD-43）：按 rust-v0.162.1 的转换条件逐个检查 `TargetPlan.commands`，
  会被 Codex 跳过的命令返回 `TargetSkip`（`component` 为 `commands/<name>.md`），代替 F-06-09 中
  笼统的残余风险。
- agy 的 commands（F-11-11，SD-39）：`components.commands` 为 `package`，按上文 commands 的规则由
  构建编排原样复制；宿主模块不返回命令文件，只写模型自动选用的残余风险。
- MCP 服务器的环境变量（F-05-26、F-06-12、F-11-12，SD-40）：Codex 把本地服务器的 `envVars` 写为
  `env_vars`，排在 `env` 之后；Claude Code 与 agy 的本地服务器继承会话环境，不写。
- Claude Code 的 manifest 透传字段（F-05-20，SD-42）：`hosts['claude-code'].manifest` 的字段按写入
  顺序追加在生成的字段之后。`onFailure`（F-05-21）只写在 `PreToolUse` 与 `UserPromptSubmit` 的守卫
  条目中。
- marketplace 文件（F-05-24、F-06-15，SD-41）：`marketplaceSource` 不为 `null` 时，Claude Code
  在 `marketplaceFiles` 中返回 `.claude-plugin/marketplace.json`，Codex 返回
  `.agents/plugins/marketplace.json`，条目的 `source` 取 `marketplaceSource`；agy 不返回。宿主
  模块不读写 `marketplace.dir`。
- 共用文件（F-03-17，SD-37）不经过宿主模块，宿主模块不返回 `files/` 中的文件。
