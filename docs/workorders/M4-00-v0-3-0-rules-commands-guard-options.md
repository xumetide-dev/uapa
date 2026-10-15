# Sprint 总览 M4-00：v0.3.0 rules、commands、守卫选项与 JSON 合并

> 本 Sprint 结束时，`uapa build` 为 agy 写出 rules、为 Claude Code 与 Codex 写出 commands；守卫可以
> 声明选项，Claude Code 产物把选项写为 `userConfig` 并在入口读取用户设置的取值，Codex 与 agy 取默认值；
> 构建编排按命名空间合并宿主模块标为可合并的 JSON 文件。

| 项 | 内容 |
|---|---|
| Sprint 目标 | 功能清单阶段 v0.3.0 的全部 13 个功能（[功能清单](../feature-list/README.md)「阶段」） |
| 范围来源 | 范围决策 SD-31～SD-35（[范围决策](../feature-list/scope-decisions.md)） |
| 前置 | v0.2.0 已以 tag `v0.2.0` 发布；Sprint M3 收口为通过；v0.3.0 的功能条目与宿主实测已随功能清单提交 |
| 周期 | 2026-10-15 起，按工单顺序推进，不设截止日期 |
| 关联 issue | 无 |
| 收口文件 | `docs/acceptance/M4-00-v0-3-0-rules-commands-guard-options.md`（全部工单完成后建立） |

Sprint 编号 `M4` 与功能清单的里程碑 M1～M6 是两套编号；本目录提到功能清单里程碑时一律写
「里程碑 Mx」，工单编号写作 `M4-NN`。

## 目标与已定决策

- 技术栈与 v0.2.0 相同，以[架构 §0](../architecture/architecture.md#0-技术选型总览) 为准；
  本 Sprint 不升级依赖，不新增生产依赖。
- 目标仍为 `claude-code:in-process`、`claude-code:subprocess`、`codex:subprocess`、
  `agy:subprocess`（SD-28、SD-31）；功能模块 07、08 仍为预留。
- rules 只由 agy 承载；commands 由 Claude Code 原样加载，由 Codex 在安装时转换为技能（限制写为
  残余风险）；其余按不承载处理（SD-32、SD-33）。
- F-03-07 只在构建编排中实现，现有宿主模块不标合并，以测试用宿主模块验证（SD-34）。
- 守卫选项只有 Claude Code 读取用户设置的取值；Codex 与 agy 取默认值并写残余风险，不另设
  环境变量或配置文件（SD-35）。
- 接口文档先定稿（M4-01），实现工单不按推测写宿主格式。
- 本 Sprint 不发布。是否以 v0.3.0 发布由维护者在收口后决定；创建与推送 tag 各需维护者确认。
- 每张工单的验收结论下定后推送私有仓库的 `main`。

## 现状（已定位）

2026-10-15 读出：

| 项 | 状态 |
|---|---|
| 发布 | 公共仓库的 tag `v0.2.0` 已推送；Sprint M3 收口为通过，没有欠账 |
| 检查 | `test/container/run.sh check`：`node --test` 247 pass / 0 fail；“105 个功能，21 条用户故事，24 项技术验收，关系检查通过” |
| 夹具 | `test/fixtures/` 下 18 个；没有含 rules、commands 或守卫选项的夹具 |
| rules 与 commands | 完全没有：`SourceProject`（`src/source/types.ts`）只有 `skills`、`agents`、`mcpServers`、`overrides`；`Component`（`src/capabilities/types.ts`）只有 `skills`、`agents`、`mcp`、`hooks`；`planComponents`（`src/build/plan.ts`）的 `COMPONENT_KINDS` 只有 skills 与 agents |
| JSON 合并 | 已有但不对：`OutputFile.merge`（`src/targets/types.ts`）已定义；`generatedFile`（`src/build/outputs.ts`）丢弃该标记，`mergeViews` 只逐字节比较 |
| 守卫选项 | 完全没有：`GuardPlugin`、`GuardDeclaration`、`TargetRuntimeData`、`SubprocessProtocol` 都没有选项；`hosts['claude-code'].userConfig` 的类型为 `unknown`，由 `src/targets/claude-code/manifest.ts` 原样写入 |
| 文件长度 | `src/build/outputs.ts` 266 行，`src/runtime/entries/subprocess.ts` 350 行，`claude-code-in-process.ts` 224 行；新增逻辑前先按职责拆分 |
| 宿主事实 | agy 1.3.5 的 rules、Claude Code 2.1.296 的 commands 与 `userConfig` 已在容器中实测，见 [agy「rules（1.3.5，容器）」](../research/coding-agent-plugin-manifests/agy-plugins.md#rules135容器) 与 [Claude Code「commands 与 userConfig」](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#commands-与-userconfig)；Codex 按 rust-v0.162.1 源码核对：安装时把 commands 转换为技能，不承载 rules，没有插件用户配置，见[源码核对记录「commands、rules 与用户配置」](../research/coding-agent-plugin-manifests/codex-source-review.md#commandsrules-与用户配置) |
| 宿主版本 | 容器 `shell` 中：Claude Code 2.1.296、codex-cli 0.162.1、agy 1.3.5 |

## 关键落地约束（必须先验证）

| 约束 | 验证方式 | 得不出结论时 |
|---|---|---|
| Codex 转换 commands 为技能后的调用 | 已按源码核对转换与跳过条件；会话中的调用方式未核对，本 Sprint 不使用 Codex CLI | 能力数据按源码记为 `package`，转换限制写为残余风险；会话实测待维护者另行确认 |
| 生成的 `hooks/register.ts` 把 `options` 传给守卫文件后仍通过 `validate --strict` | M4-04 在容器中对 `guard-options` 产物运行 `claude plugin validate --strict` | `claude-code:in-process` 取默认值并写残余风险，与 Codex、agy 相同 |
| 以 `--plugin-dir` 加载的插件读不到用户设置的取值 | 已实测（Claude Code「commands 与 userConfig」） | — |
| agy 插件设置的声明方式与取值是否传给 hook | 文档未写明，本 Sprint 不实测 | agy 取默认值（SD-35） |

## 工单构成

| 工单 | 名称 | 覆盖功能编号 | 依赖 | 可并行性 |
|---|---|---|---|---|
| [M4-01](M4-01-v0-3-0-interfaces.md) | v0.3.0 接口定稿 | 无（接口文档） | 无 | 最先动工 |
| [M4-02](M4-02-rules-and-commands.md) | rules 与 commands | `F-01-10`、`F-01-11`、`F-03-16`、`F-05-16`、`F-06-09`、`F-11-09` | M4-01 | 与 M4-04 可并行 |
| [M4-03](M4-03-json-namespace-merge.md) | 按命名空间合并共用的 JSON | `F-03-07` | M4-02 | M4-02 之后：两者都改 `src/build/outputs.ts` |
| [M4-04](M4-04-guard-options.md) | 守卫选项 | `F-02-05`、`F-04-09`、`F-05-17`、`F-05-18`、`F-06-10`、`F-11-10` | M4-01 | 与 M4-02、M4-03 改动的文件不重叠，可并行 |
| [M4-05](M4-05-v0-3-0-live-tests.md) | v0.3.0 产物的宿主实测 | 无（TA-24） | M4-02、M4-04 | 最后 |

功能编号取自[功能清单](../feature-list/README.md)的模块文件。本表是本 Sprint 覆盖哪些功能、
工单之间如何依赖的权威源；工单表头与验收 §2 是它的副本，不一致时以本表为准。

## Sprint 完成判定

| # | 判定条目 | 证据形式 |
|---|---|---|
| 1 | `pnpm check` 通过：两套 `tsc` 配置、Biome、`node --test`、功能清单关系检查 | 命令输出与测试计数 |
| 2 | [夹具表](../feature-list/modules/10-repo-release.md#夹具) 的全部夹具（含 `rules-commands`、`guard-options`）比对与入口用例通过 | `node --test` 中夹具测试的计数 |
| 3 | 能力数据的 `components.rules`、`components.commands` 注明实测或源码核对出处 | 能力数据与调研文档 |
| 4 | TA-24：rules、commands 与守卫选项在宿主会话中按调研结论生效 | 宿主实测记录 |
| 5 | M4-01～M4-05 的验收结论均为通过，表头有 commit 号 | 各验收文件 |

## 边界

- 不实现预留的功能模块 07、08，不新增目标与宿主（SD-28）。
- 不改 v0.1.0、v0.2.0 功能的语义；现有夹具的期望产物只在 `TargetCapabilities` 新增字段影响
  打包内容时更新，并在验收 §5 写明。
- 接口文档的改动随 M4-01 提交；实现中发现需要改接口时，在同一实现提交中同步，并在验收 §5 写明。
- 帮助文档 `docs/guide/` 随实现工单同步。

## 依赖

- 容器 `shell` 中的 Claude 令牌与 agy 登录由用户准备（M4-04、M4-05）；本 Sprint 不使用 Codex CLI。
- v0.3.0 的发布不在本 Sprint，需要时由维护者另行确认。
