# Sprint 总览 M2-00：v0.2.0 三个宿主的组件补全与稳定

> 本 Sprint 结束时，`uapa build` 为 Claude Code（两种形态）、Codex 与 agy 写出 agents、
> MCP 服务器配置与执行后检查的 hooks，四个目标在各自宿主中完成安装与会话实测，并以 git tag
> 发布 v0.2.0。

| 项 | 内容 |
|---|---|
| Sprint 目标 | 功能清单阶段 v0.2.0 的全部 11 个功能（[功能清单](../feature-list/README.md)「阶段」），以及 Sprint M1 收口 §4 中未完成的宿主实测 |
| 范围来源 | 范围决策 SD-02、SD-04、SD-28；[Sprint M1 收口](../acceptance/M1-00-v0-1-0-three-host-build.md) §4 |
| 前置 | v0.1.0 已以 tag `v0.1.0` 发布；Sprint M1 收口为有条件通过 |
| 周期 | 2026-10-14 起，按工单顺序推进，不设截止日期 |
| 关联 issue | 无 |
| 收口文件 | `docs/acceptance/M2-00-v0-2-0-three-host-completion.md`（全部工单完成后建立） |

Sprint 编号 `M2` 与功能清单的里程碑 M1～M6 是两套编号；本目录提到功能清单里程碑时一律写
「里程碑 Mx」，工单编号写作 `M2-NN`。

## 目标与已定决策

- 技术栈与 v0.1.0 相同，以[架构 §0](../architecture/architecture.md#0-技术选型总览) 为准；
  本 Sprint 不升级依赖。
- 目标只有 `claude-code:in-process`、`claude-code:subprocess`、`codex:subprocess`、
  `agy:subprocess`（[SD-28](../feature-list/scope-decisions.md)）。这四个目标稳定运行之前不新增
  目标；DSH、Kimi Code、ZCode 等其他宿主之后按社区反馈决定是否增加。功能模块 07、08 与
  F-03-07 仍为预留。
- 组件补 agents 与 MCP 服务器（SD-02），commands 与 rules 仍不列入。执行后检查 `afterTool`
  （SD-04）补到 Claude Code 两种形态与 Codex；agy 的 `PostToolUse` 不能阻断或替换输出
  （F-11-01），不生成执行后 hook，按能力缺失处理。
- 宿主行为的结论先写入调研文档，再改能力数据与接口文档（M2-01）；实现工单不按推测写宿主格式。
- 维护者操作的宿主实测单列一张（M2-05），其余工单不被它阻塞。
- 每张工单的验收结论下定后推送私有仓库的 `main`；创建 `v0.2.0` tag 与推送 tag 各需维护者
  确认。

## 现状（已定位）

2026-10-14 读出：

| 项 | 状态 |
|---|---|
| 发布 | 公共仓库的 tag `v0.1.0` 已推送；以 `github:xumetide-dev/uapa#v0.1.0` 用 pnpm 安装后构建 `full` 夹具，产物与期望一致；npm 12 的安装未实测 |
| 检查 | `pnpm check`：`node --test` 198 pass / 0 fail；“93 个功能，18 条用户故事，18 项技术验收，关系检查通过” |
| 夹具 | `test/fixtures/` 下 16 个；没有含 agents、MCP 服务器或 `afterTool` 的夹具 |
| 执行后检查 | 已有但不对：`src/source/guard.ts` 按 SD-20 拒绝 `afterTool` 与 `replaceOutput`、`withholdOutput`；`GuardCheck`（`src/runtime/core/types.ts`）只有三个取值，以它或 `CheckArg` 为键的表有 9 处；`src/runtime/core/decisions.ts` 没有执行后检查的返回值检查；`claude-code-api.d.ts` 的 `ToolCallResult` 只有 `deny` |
| agents 与 MCP | 完全没有：`SourceProject`（`src/source/types.ts`）只有 `skills` 与 `overrides`；`planTargets`（`src/build/plan.ts`）只筛选 skills、检查与命令 hooks；能力数据的 `components.agents`、`components.mcp` 已填写，没有代码读取 |
| 能力数据 | 出处不足：Claude Code 两种形态的 `replaceOutput`、`withholdOutput` 记为支持，依据为官方文档与 Mods 指南，没有实测；Codex 的 `withholdOutput` 支持、`replaceOutput` 不支持，依据为官方文档 |
| 接口文档 | 没有执行后检查的入口协议（入口与打包接口第 3、4 节）、agents 与 MCP 服务器的源项目模型（模块接口 §3）与放置规则（§5）；构建报告的 `degraded` 写明“v0.1.0 只有一种”；F-03-13 只列三种能力；设计提案的 MCP 规则（目标没有插件根变量时构建失败）与 F-11-08（列为跳过）不一致 |
| 宿主实测欠账 | Sprint M1 收口 §4 第 2～4 行：TA-12 的本机运行与 `claude plugin test`；在 Codex 中安装 `full` 产物并信任 hooks；Claude Code 嵌套会话与 `/clear` 之后的去重 |
| 宿主版本 | 本机与容器 `shell` 中：Claude Code 2.1.296、codex-cli 0.162.1、agy 1.3.4；容器中三者的登录方式见[容器测试「认证」](../../test/container/README.md#认证) |

## 关键落地约束（必须先验证）

| 约束 | 验证方式 | 得不出结论时 |
|---|---|---|
| Claude Code `PostToolUse` 的 `tool_response` 形状，`updatedToolOutput` 的取值类型与效果 | M2-01 在容器中以 `claude -p --plugin-dir` 加载记录输入、返回 `updatedToolOutput` 的临时插件 | `claude-code:subprocess` 的 `replaceOutput`、`withholdOutput` 记为不支持，M2-02 不为它生成执行后 hook |
| hooks 模块在 `next` 之后返回 `{ result }` 与 `{ deny }` 的效果 | 同上，加载 hooks 模块形态的临时插件 | `claude-code:in-process` 的对应能力记为不支持 |
| Codex `PostToolUse` 的 stdin 字段与 `decision: "block"` 的效果 | M2-01 核对 rust-v0.162.1 源码与上游测试；在 Codex 中实测由 M2-05 进行，使用 Codex CLI 须维护者逐次确认 | `codex:subprocess` 的 `withholdOutput` 记为不支持 |
| 三个宿主插件中 MCP 配置的文件位置、字段、传输 `type` 取值，插件根变量是否展开 | M2-01：Claude Code 与 agy 在容器中加载临时插件，Codex 核对源码 | 未核实展开的宿主上，含 `{pluginRoot}` 的服务器列为跳过；文件格式未核实的宿主把 `components.mcp` 记为 `none` |
| Claude Code 与 agy 的 agents frontmatter 规则：必填字段、未知键、文件名与 `name` 的关系 | M2-01：官方文档；容器中运行 `claude plugin validate --strict`，加载 agy 临时插件 | 规则未核实的宿主把 `components.agents` 记为 `none` |
| TA-11 的 `/clear` 去重、在 Codex 的 `/hooks` 中信任插件 hooks | 交互式会话，由维护者操作（M2-05） | 不创建 `v0.2.0` tag |
| TA-14 需要 Node 22.0.0 的可执行文件 | M2-06 前确认 v0.1.0 发布时下载的文件仍在 | 维护者确认后重新下载 |

## 工单构成

| 工单 | 名称 | 覆盖功能编号 | 依赖 | 可并行性 |
|---|---|---|---|---|
| [M2-01](M2-01-v0-2-0-host-facts.md) | v0.2.0 宿主事实与接口定稿 | 无（调研文档、能力数据与接口文档） | 无 | 最先动工 |
| [M2-02](M2-02-after-tool-end-to-end.md) | 执行后检查端到端 | `F-02-04`、`F-04-08`、`F-05-13`、`F-06-07` | M2-01 | 与 M2-03 可并行 |
| [M2-03](M2-03-agents-component.md) | agents | `F-01-07`、`F-05-11`、`F-11-07` | M2-01 | 与 M2-02 可并行 |
| [M2-04](M2-04-mcp-servers.md) | MCP 服务器 | `F-01-08`、`F-05-12`、`F-06-06`、`F-11-08` | M2-03 | M2-03 之后：两者都改 `planTargets` 的组件筛选与 `SourceProject` |
| [M2-05](M2-05-three-host-live-tests.md) | 三个宿主的安装与会话实测 | 无（TA-11、TA-12 与 v0.2.0 产物的宿主实测） | M2-02、M2-04 | 容器中的部分由代理运行；维护者操作的部分不阻塞 M2-06 的准备 |
| [M2-06](M2-06-release-v0-2-0.md) | 发布 v0.2.0 | 无（沿用 F-10-04、F-10-05） | M2-05 | 最后；创建与推送 tag 须维护者确认 |

功能编号取自[功能清单](../feature-list/README.md)的模块文件。本表是本 Sprint 覆盖哪些功能、
工单之间如何依赖的权威源；工单表头与验收 §2 是它的副本，不一致时以本表为准。

## Sprint 完成判定

| # | 判定条目 | 证据形式 |
|---|---|---|
| 1 | `pnpm check` 通过：两套 `tsc` 配置、Biome、`node --test`、功能清单关系检查 | 命令输出与测试计数 |
| 2 | [夹具表](../feature-list/modules/10-repo-release.md#夹具) 的全部夹具（含本 Sprint 新增的夹具）比对与入口用例通过 | `node --test` 中夹具测试的计数 |
| 3 | v0.2.0 的宿主事实在调研文档中有结论；能力数据的 `replaceOutput`、`withholdOutput` 与组件承载注明实测或源码出处 | 调研文档的实测与源码核对小节及日期 |
| 4 | Sprint M1 收口 §4 第 2～4 行关闭：TA-11（嵌套会话与 `/clear`）、TA-12（`validate --strict` 与 `claude plugin test`）、在 Codex 中安装 `full` 产物并信任 hooks 后拒绝标记命令 | 宿主实测记录 |
| 5 | v0.2.0 的产物在三个宿主的会话中生效：agents 与 MCP 服务器被加载，执行后检查扣留含标记的输出 | 宿主实测记录 |
| 6 | 发布脚本生成 `v0.2.0` tag，TA-14 与安装冒烟通过；推送后从 GitHub 以 pnpm 与 npm 12 各安装一次 | 发布脚本输出与安装记录 |
| 7 | M2-01～M2-06 的验收结论均为通过，表头有 commit 号 | 各验收文件 |

## 边界

- 不实现预留的功能模块 07、08 与 F-03-07，不新增目标与宿主（SD-28）；commands 与 rules
  不列入。
- 不改 v0.1.0 功能的语义。能力数据随实测结论修改、`GuardCheck` 增加取值时，受影响夹具中
  打包生成的入口随之更新，在验收 §5 写明。
- 功能清单与接口文档的改动随 M2-01 或实现提交，并在验收 §5 写明偏差。

## 依赖

- 维护者：M2-05 中的交互式实测（`/clear`、在 Codex 的 `/hooks` 中信任）与 TA-12 的本机运行；
  每次使用 Codex CLI 前的确认；M2-06 的创建与推送 tag。
- 容器 `shell` 中的 Claude 令牌、agy 登录与 Codex provider 配置由用户准备。
