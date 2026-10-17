# Sprint 总览 M5-00：v0.4.0 三个宿主的承载补全

> 本 Sprint 结束时，同一份源项目在三个宿主上承载的内容更完整：
> - Claude Code 与 Codex 承载 rules，agy 承载 commands。
> - `files/` 中的文件写入每个插件目录。
> - Codex 的本地 MCP 服务器能取得声明的环境变量。
> - 构建可以生成 Claude Code 与 Codex 的 marketplace 文件。
> - Claude Code 可以透传 manifest 字段，并选择守卫入口出错时阻断。
> - 已知的产物缺陷已修正，漏记的残余风险已补全。

| 项 | 内容 |
|---|---|
| Sprint 目标 | 功能清单阶段 v0.4.0 的全部 24 个功能（[功能清单](../feature-list/README.md)「阶段」） |
| 范围来源 | 范围决策 SD-36～SD-43（[范围决策](../feature-list/scope-decisions.md)）；不排期的审查项见 SD-44、SD-45 |
| 前置 | v0.3.0 已以 tag `v0.3.0` 发布；Sprint M4 收口的条件已关闭；v0.4.0 的功能条目已随功能清单提交 |
| 周期 | 2026-10-15 起，按工单顺序推进，不设截止日期 |
| 关联 issue | 无 |
| 收口文件 | `docs/acceptance/M5-00-v0-4-0-host-coverage.md`（全部工单完成后建立） |

Sprint 编号 `M5` 与功能清单的里程碑 M1～M6 是两套编号；本目录提到功能清单里程碑时一律写
「里程碑 Mx」，工单编号写作 `M5-NN`。

## 目标与已定决策

- 范围来自 2026-10-15 的覆盖审查：按 Claude Code、Codex、agy 分别对照官方文档、公开源码与已有
  调研，找出宿主已承载而 UAPA 没有覆盖的能力。审查结论按三类处理：
  - 本 Sprint 实现：SD-37～SD-43。
  - 需要改守卫公共类型的语义扩展：延后到 M6，SD-44。
  - 价值有限或已有替代做法：不排期，SD-45。
- 技术栈与 v0.3.0 相同，以[架构 §0](../architecture/architecture.md#0-技术选型总览) 为准；
  本 Sprint 不升级依赖，不新增生产依赖。
- 目标仍为 `claude-code:in-process`、`claude-code:subprocess`、`codex:subprocess`、
  `agy:subprocess`（SD-28、SD-36）；不改守卫公共类型（`GuardPlugin`、`GuardCheck`、决策种类）。
- 换算只改格式，不在运行时模拟宿主缺少的能力：
  - rules 在 Claude Code 与 Codex 上写为技能，或由 `SessionStart` 命令 hook 输出（SD-38）。
  - commands 在 agy 上写为技能（SD-39）。
  - 语义差异写为残余风险。
- 宿主行为先实测、后实现：SD-38～SD-41 与 SD-43 中标为待实测的各项由 M5-01 核实。
  - 结论写入调研文档后，再改功能条目与接口。
  - 结论不成立的换算，对应功能改为预留，并另立 SD，不按推测实现。
- 7 张工单：M5-01 定事实与接口，M5-07 做产物实测，中间 5 张按功能分组，各自可以独立提交与验证。
- 本 Sprint 不发布。是否以 v0.4.0 发布由维护者在收口后决定；创建与推送 tag 各需维护者确认。
- 每张工单的验收结论下定后推送私有仓库的 `main`。

## 现状（已定位）

2026-10-15 读出：

| 项 | 状态 |
|---|---|
| 发布 | 公共仓库的 tag `v0.3.0` 已推送；Sprint M4 的条件已关闭 |
| 检查 | 功能清单关系检查：“129 个功能，27 条用户故事，27 项技术验收，关系检查通过”；`node --test` 在 M4 收口时 296 pass / 0 fail |
| 夹具 | `test/fixtures/` 下 20 个夹具；没有 `files/`、`envVars`、`marketplace` 或 `hosts['claude-code'].manifest` |
| 共用文件 | 完全没有：`readOverrides`（`src/source/overrides.ts`）只读 `overrides/<宿主>/`；`hostView`（`src/build/outputs.ts`）的顺序为生成文件、复制的组件、覆盖文件 |
| 换算承载 | 完全没有：`Carrier`（`src/capabilities/types.ts`）只有 `package`、`manifest`、`none`；Claude Code 与 Codex 的 `components.rules`、agy 的 `components.commands` 为 `none` |
| MCP 环境变量 | 完全没有：`McpServer`（`src/source/types.ts`）的本地服务器只有 `command`、`args`、`env`；Codex 字段白名单（`src/targets/codex/fields.ts`）的注释写明宿主另接受 `env_vars` 而 UAPA 不写 |
| marketplace | 完全没有：`docs/guide/install.md` 要求手写 |
| Claude Code manifest | 已有但不全：`hosts['claude-code']` 只有 `displayName`、`userConfig`、`dependencies`、`$schema`；`RESERVED_PREFIXES` 与 `RESERVED_NAMES`（`src/targets/claude-code/manifest.ts`）漏掉按段检查的保留词 |
| 产物缺陷 | 已有但不对：Codex 的命令 hooks 一律写能力数据的 `hookTimeoutSeconds`（30），`SessionEnd` 也是 30（`src/targets/codex/hooks.ts`），宿主压到 3 秒并在每次会话开始告警 |
| 文件长度 | `src/build/outputs.ts` 207 行，`src/targets/codex/index.ts` 212 行，`src/targets/claude-code/index.ts` 167 行；新增逻辑前先按职责拆分 |
| 宿主版本 | 容器 `shell` 中：Claude Code 2.1.296、codex-cli 0.162.1、agy 1.3.5；公开的最新版本为 Claude Code 2.1.300、codex-cli 0.162.1、agy 1.3.5；agy 能力数据的 `host.version` 仍为 1.3.4 |

## 关键落地约束（必须先验证）

| 约束 | 验证方式 | 得不出结论时 |
|---|---|---|
| 换算后的规则与命令在会话中生效（SD-38、SD-39） | M5-01 在容器中以探测插件实测 Claude Code 的 `paths` 技能与 `SessionStart` 输出、agy 的 `/<插件名>:<skill>` | 对应功能改为预留并另立 SD |
| Claude Code 与 agy 的本地 MCP 服务器是否继承会话环境（SD-40） | M5-01 实测，只检查一个标记变量是否存在 | 不写入，残余风险写明未核实 |
| 生成的 marketplace 能被添加并安装（SD-41） | M5-01 对 Claude Code 实测；Codex 按源码核对，CLI 实测须维护者确认 | 只按源码与文档生成，残余风险写明未实测 |
| `Monitor`、`NotebookEdit` 的入参与 agy hook 的 `PLUGIN_DATA`（SD-43） | M5-01 实测 | 不换算，残余风险写明 |
| Claude Code 2.1.299、2.1.300 的 hooks 变化 | 容器钉在 2.1.296；升级容器中的 Claude Code 须维护者确认（下载可执行文件） | 能力数据仍以 2.1.296 为准，变化记入调研文档 |

## 工单构成

| 工单 | 名称 | 覆盖功能编号 | 依赖 | 可并行性 |
|---|---|---|---|---|
| [M5-01](M5-01-v0-4-0-host-facts-and-interfaces.md) | v0.4.0 宿主事实与接口定稿 | 无（TA-25，接口文档） | 无 | 最先动工 |
| [M5-02](M5-02-shared-files-and-claude-code-config.md) | 共用文件与 Claude Code 的配置字段 | `F-01-12`、`F-01-14`、`F-03-17`、`F-05-20`、`F-05-25` | M5-01 | 改 `src/build/outputs.ts`，先于 M5-03、M5-06 |
| [M5-03](M5-03-converted-rules-and-commands.md) | rules 与 commands 的换算承载 | `F-03-19`、`F-05-19`、`F-06-11`、`F-06-13`、`F-11-11` | M5-01、M5-02 | 改构建编排与三个宿主模块，串行 |
| [M5-04](M5-04-mcp-server-environment.md) | MCP 服务器的环境变量与插件根 | `F-01-13`、`F-05-26`、`F-06-12`、`F-11-12` | M5-01 | 只改 MCP 的读取与生成，可与 M5-03 并行 |
| [M5-05](M5-05-guard-reliability-and-risks.md) | 守卫可靠性与残余风险 | `F-05-21`、`F-05-22`、`F-05-23`、`F-06-14`、`F-06-16`、`F-11-13`、`F-11-14` | M5-01、M5-03 | 改三个宿主模块的 hooks 与残余风险，排在 M5-03 之后 |
| [M5-06](M5-06-marketplace-files.md) | marketplace 文件 | `F-03-18`、`F-05-24`、`F-06-15` | M5-02 | 改构建编排的写出与比对 |
| [M5-07](M5-07-v0-4-0-live-tests.md) | v0.4.0 产物的宿主实测 | 无（TA-27） | M5-02～M5-06 | 最后 |

功能编号取自[功能清单](../feature-list/README.md)的模块文件。本表是本 Sprint 覆盖哪些功能、
工单之间如何依赖的权威源；工单表头与验收 §2 是它的副本，不一致时以本表为准。

## Sprint 完成判定

| # | 判定条目 | 证据形式 |
|---|---|---|
| 1 | `pnpm check` 通过：两套 `tsc` 配置、Biome、`node --test`、功能清单关系检查 | 命令输出与测试计数 |
| 2 | [夹具表](../feature-list/modules/10-repo-release.md#夹具) 的全部夹具（含新增的 `host-coverage`，以及更新后的 `rules-commands`、`command-hooks`）比对与入口用例通过 | `node --test` 中夹具测试的计数 |
| 3 | TA-25 的结论写入调研文档；SD-38～SD-41、SD-43 的状态不再是待实测 | 调研文档与范围决策 |
| 4 | 能力数据的 `converted` 承载、新增的工具名与 agy 的宿主版本注明实测或源码核对出处 | 能力数据与调研文档 |
| 5 | TA-27：换算的规则与命令、共用文件、marketplace 安装与 `onFailure` 在宿主会话中按调研结论生效 | 宿主实测记录 |
| 6 | M5-01～M5-07 的验收结论均为通过，表头有 commit 号 | 各验收文件 |

## 边界

- 不实现 SD-44、SD-45 中的项，不实现预留的功能模块 07、08，不新增目标与宿主（SD-28）。
- 不改守卫公共类型与入口协议的语义：
  - agy 停机计数目录的选择只在 agy 入口中改。
  - `onFailure` 只改 hooks 配置。
- 现有夹具的期望产物只在本 Sprint 的功能改变产物时更新，并在验收 §5 写明。
- 接口文档的改动随 M5-01 提交；实现中发现需要改接口时，在同一实现提交中同步，并在验收 §5 写明。
- 帮助文档 `docs/guide/` 随实现工单同步。

## 依赖

- 容器 `shell` 中的 Claude 令牌与 agy 登录由用户准备（M5-01、M5-07）。
- 使用 Codex CLI 须维护者逐次确认；未确认时 Codex 只做源码核对，实测项写明待确认。
- 升级容器中的 Claude Code 到 2.1.300 须维护者确认；未确认时以 2.1.296 为准。
- v0.4.0 的发布不在本 Sprint，需要时由维护者另行确认。
