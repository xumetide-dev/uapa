# 03 构建编排

把源项目按宿主构建为产物：能力检查、调用宿主模块、放置 skills 与覆盖文件、产物布局、宿主校验、
比对与构建报告。代码位于 `src/build/`、`src/report/`、`src/capabilities/types.ts`、
`src/capabilities/index.ts`、`src/targets/types.ts`、`src/targets/index.ts` 与
`src/bundle/types.ts`。本模块不包含任何宿主的格式知识：宿主模块按
[模块接口 §5](../../architecture/module-interfaces.md) 返回要写出的文件，本模块负责检查、合并、
写出或比对；报告、写出与比对的规则见模块接口 §7、§8。本模块返回构建结果，不设置退出码。
`src/build/` 的内部函数以参数接收宿主模块与能力数据的登记处，本模块的单元测试传入测试用的
宿主模块与能力数据，不依赖宿主功能模块（模块接口 §5）。

| 编号 | 阶段 | 子模块 | 功能名称 | 验收标准 | 依赖 |
|---|---|---|---|---|---|
| F-03-01 | v0.1.0 | 能力检查 | 定义目标能力数据模型 | `TargetCapabilities` 按模块接口 §4 定义：宿主名与版本、核对日期、出处、组件承载、守卫能力（`rewriteInput`、`replaceOutput`、`withholdOutput`、`stopGate`、`promptGate`）、失败默认行为、超时与工具名映射（`ToolNameMap`）；缺字段时 `tsc` 报错；`src/capabilities/index.ts` 定义登记处 `targetCapabilities: Readonly<Record<TargetName, TargetCapabilities>>`，各目标的条目由该目标的能力数据功能（F-05-01、F-05-14、F-06-01、F-11-01）加入 | F-02-01, F-02-02 |
| F-03-02 | v0.1.0 | 能力检查 | 构建时检查组件承载 | 目标不能承载的组件列为跳过；frontmatter 显式写了该目标时该目标失败 | F-03-01, F-01-05 |
| F-03-03 | v0.1.0 | 目标构建 | 按宿主逐个构建 | `src/build/index.ts` 按模块接口 §8 导出 `build`：先调用 `readSource` 与 `readGuard`，任一返回 `ok: false` 时返回 `input-error`，不写任何文件；未配置守卫时各目标的 `TargetPlan.checks` 为空。经注册表按宿主调用宿主模块，只传入通过能力检查的目标；同一宿主中失败的目标不进入该宿主的产物；宿主模块生成失败时该宿主的目标全部失败；一个宿主失败不影响其他宿主；结果按目标标明成功或失败及原因 | F-03-02, F-03-11, F-02-03 |
| F-03-04 | v0.1.0 | 组件放置 | 放置 skills | 写入该插件目录的成功目标所适用 skill 的并集，逐字节复制到 `skills/<name>/`，frontmatter 保留原样；同目录中不适用该 skill 的目标记为残余风险（模块接口 §5、SD-21） | F-03-03, F-01-04 |
| F-03-05 | v0.1.0 | 产物布局 | 按宿主分目录写出 | 默认每个宿主一个插件目录（`<outDir>/<宿主>`），同一宿主的多个目标写入同一目录；该宿主至少一个目标成功时先清空该目录再写入，全部失败时目录保持原状 | F-03-03 |
| F-03-06 | v0.1.0 | 产物布局 | 合并布局写出 | 按 `resolvePluginDirs`（模块接口 §2）的结果，两个以上宿主的插件目录解析为同一路径时写入同一目录；只写入生成的文件，不删除目录中的其他文件；同名文件内容不一致时写入该目录的全部目标失败、该目录不写入任何文件，错误按模块接口 §8 写明文件、冲突的宿主与 `conflictHint`；该目录可以是源项目根目录，此时不复制 skills（组件已在原位；v0.2.0 起含 agents，v0.3.0 起含 commands，v0.4.0 由 F-03-20 将 rules 一并纳入原位保护） | F-03-05 |
| F-03-07 | v0.3.0 | 产物布局 | 按命名空间合并共用的 JSON 文件 | 宿主模块标为 `merge: 'json-extensions'` 的 JSON 文件（如根 `plugin.json`），解析后比较 `extensions` 以外的字段，必须一致（与键序无关），`extensions` 按命名空间合并；同一命名空间冲突时按同名文件冲突处理；合并结果的键序与格式按模块接口 §5 | F-03-06 |
| F-03-08 | v0.1.0 | 产物比对 | 只比对不写入 | 在内存中生成全部产物，与磁盘逐字节比对；不写任何文件，不生成也不比对构建报告；返回新增、修改的文件，默认布局另返回写入前会被清除的文件；失败目标的处理与输出格式见模块接口 §8 | F-03-05, F-03-06 |
| F-03-09 | v0.1.0 | 构建报告 | 生成构建报告 | 按模块接口 §7 写出 `<outDir>/uapa-report.json`：每个目标的状态、错误、安装单位、跳过项、降级项、覆盖文件、宿主校验结果、残余风险与能力数据核对日期；不含时间与绝对路径 | F-03-03 |
| F-03-10 | v0.1.0 | 构建报告 | 生成终端摘要 | `formatSummary` 按目标列出成功或失败，以及跳过、降级、残余风险的数量和 `reportPath` 参数给出的报告文件路径；摘要由命令行打印 | F-03-09 |
| F-03-11 | v0.1.0 | 目标构建 | 定义宿主模块接口与注册表 | `src/targets/types.ts` 按模块接口 §5 定义 `HostModule`、`HostInput`、`HostResult`；`src/targets/index.ts` 定义登记处 `hostModules: Readonly<Record<HostName, HostModule>>`，各宿主的条目由该宿主的 manifest 功能（F-05-02、F-06-02、F-11-02）加入；构建编排只经注册表取得宿主模块，接口中不出现具体宿主名；`HostInput` 引用的 `BundleRequest` 按入口与打包接口第 1 节定义在 `src/bundle/types.ts`；F-04-06 完成前，构建编排传入的 `bundle` 函数抛出“未实现”错误 | F-01-03, F-03-01 |
| F-03-12 | v0.1.0 | 组件放置 | 应用覆盖文件 | 宿主模块生成之后、写出之前，用 `overrides/<宿主>/` 中的文件覆盖或新增该宿主的同名文件；覆盖文件不做字段白名单检查；覆盖生成文件时继承其合并标记；每个被覆盖或新增的文件写入该宿主各目标报告的 `overridden` | F-01-06, F-03-03, F-03-09 |
| F-03-13 | v0.1.0 | 能力检查 | 构建时检查守卫能力 | 配置了守卫时，`requires` 中有目标缺失的能力（v0.1.0 只可能是 `rewriteInput`、`stopGate`、`promptGate`）则该目标失败（v0.2.0 起另可能是 `replaceOutput`、`withholdOutput`，未列入 `requires` 时的处理见 SD-29）；未列入 `requires` 的缺失能力：`rewriteInput` 在守卫实现了 `beforeTool` 时记为降级（`rewrite` 按 `fallbackReason` 拒绝），`stopGate`、`promptGate` 不生成对应 hook 并记为残余风险（hooks 适配第 6 节）；检查全部被省略时（未配置守卫的情况见 F-03-03），按模块接口 §5 不生成该目标的 hooks 配置与入口 | F-03-01, F-02-03 |
| F-03-14 | v0.1.0 | 产物校验 | 写出后调用宿主校验 | 写出后，对本次写出了文件且实现了 `verify` 的宿主模块，以其插件目录的绝对路径调用一次；`failed` 或 `verify` 抛错时该宿主的目标全部失败，抛错时错误为异常消息，已写出的文件保留；结果写入各目标报告的 `hostValidation`，未调用 `verify` 时为 `none`；`--check` 模式不调用 | F-03-05, F-03-09, F-03-11 |
| F-03-15 | v0.1.0 | 能力检查 | 检查命令 hooks 的事件承载 | `TargetCapabilities` 增加 `commandHookEvents`（模块接口 §4），缺少时 `tsc` 报错；按[命令 hooks 声明](../../architecture/command-hooks.md)第 4 节得出各目标的 `TargetPlan.commandHooks`：适用且宿主事件名不为 `null` 的声明按声明顺序列入；`targets` 显式列出的目标不承载该事件时该目标失败；未显式列出时写入该目标报告的 `skipped`（`component` 为 `commandHooks[<下标>]`），同一宿主的另一目标承载该声明时不写 | F-01-09, F-03-01, F-03-11 |
| F-03-16 | v0.3.0 | 能力检查 | 检查 rules 与 commands 的承载 | `TargetCapabilities.components` 增加 `rules` 与 `commands`，缺少时 `tsc` 报错；`TargetPlan` 增加 `rules` 与 `commands`，按 F-03-02 筛选：目标不承载时，未在 frontmatter 写明该目标的条目写入其报告的 `skipped`（`component` 为 `rules/<name>.md`、`commands/<name>.md`），写明时该目标失败；commands 由构建编排按插件目录原样复制为 `commands/<name>.md`，并集与残余风险同 agents（模块接口 §5，SD-33）；rules 由宿主模块按 `TargetPlan.rules` 生成（SD-32） | F-03-02, F-01-10, F-01-11 |
| F-03-17 | v0.4.0 | 组件放置 | 放置共用文件 | 构建编排把 `files/` 的全部文件复制到每个写出文件的插件目录，在宿主模块生成与组件放置之后、应用覆盖文件之前；与生成文件或组件文件同路径时，写入该目录的全部目标失败，错误写明文件并提示改用 `overrides/<宿主>/`；生成文件与组件文件同路径时同样失败；插件目录是源项目根目录而 `files/` 非空时，写入该目录的全部目标失败，错误提示把共用文件直接放在根目录或改用默认布局；覆盖文件可以替换共用文件，该文件写入报告的 `overridden`；`--check` 一并比对（SD-37） | F-01-12, F-03-04, F-03-12 |
| F-03-18 | v0.4.0 | 产物布局 | 写出 marketplace 文件 | 配置 `marketplace` 时，宿主模块按模块接口 §5 返回本宿主的 marketplace 文件，路径相对 `marketplace.dir`；构建编排在写出插件目录之后，只为有成功目标的宿主写出，不清空所在目录；与写入的插件目录中的文件同路径时该宿主的目标失败；写出时该宿主每个成功目标的报告 `units` 追加 `{ kind: 'marketplace', path }`；`--check` 比对，差异路径的写法同模块接口 §2（SD-41） | F-01-14, F-03-05, F-03-08 |
| F-03-19 | v0.4.0 | 能力检查 | 换算承载的组件 | `Carrier` 增加 `converted`：组件由宿主模块按 `TargetPlan` 换成宿主承载的其他组件；构建编排按 F-03-02 筛选后放进 `TargetPlan`，不为该目标原样复制；同一插件目录中另有目标原样承载该组件时，原样复制照常进行（SD-38） | F-03-16 |
| F-03-20 | v0.4.0 | 能力检查与组件放置 | MCP 服务器按目标筛选与源码根目录规则文件保护 | `TargetPlan.mcpServers` 按服务器的 `targets` 与目标的 `components.mcp` 筛选（同 F-03-02：目标不承载 MCP 时，未写 `targets` 的服务器写入 `skipped`，显式列出该目标时该目标失败，`component` 为 `mcpServers.<名称>`）；插件目录是源项目根目录（`dir: '.'`）时，源项目的 `rules/<name>.md` 与 `skills/`、`agents/`、`commands/` 一并计入原位组件文件，宿主模块生成同路径文件（如 agy 生成 `rules/<name>.md`，或换算生成的技能与源项目 `skills/<name>/SKILL.md` 同路径）时按同路径冲突失败，不覆盖源码文件（SD-47、SD-49） | F-03-06, F-03-16, F-03-17 |

