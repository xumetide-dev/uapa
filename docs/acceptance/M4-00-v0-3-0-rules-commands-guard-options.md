# Sprint 收口 M4-00：v0.3.0 的 rules、commands、守卫选项与 JSON 合并

> rules 与 commands、按命名空间合并共用的 JSON、守卫选项都已实现，夹具与容器会话实测通过；
> 实测中发现 agy 按绝对路径匹配 `globs`，已修正并复测。欠一项：Codex 把 commands 转换为技能后
> 的调用未实测（使用 Codex CLI 须维护者确认）。本 Sprint 不发布。

| 项 | 内容 |
|---|---|
| 对应总览 | [M4-00](../workorders/M4-00-v0-3-0-rules-commands-guard-options.md) |
| 工单数 | 5 |
| 收口日期 | 2026-10-15 |
| 结论 | 有条件通过（M4-02 的 Codex 转换命令调用未实测，待维护者确认使用 Codex CLI） |
| 判断范围 | 夹具与单元测试 + 宿主实测 |
| commit | `7274152` |
| 完成判定 | 验了 4 条 / 共 5 条 |

> 结论只取 通过 / 有条件通过（<条件>）/ 不通过 / 待定；任一工单 §0 有「是」时只能是「不通过」。
> 判断范围按各工单如实汇总。commit 为收口文件本身的提交，回填单独一个提交。

## 1. Sprint 完成判定逐条

> 条目逐条复制自总览「Sprint 完成判定」表，不增不删不改写。⏳ 的条目「去向」必填。

| # | 判定条目 | 实际 | 证据 | 状态 | 去向 |
|---|---|---|---|---|---|
| 1 | `pnpm check` 通过：两套 `tsc` 配置、Biome、`node --test`、功能清单关系检查 | 两次 `tsc` 无错误，Biome 检查 205 个文件无问题，`node --test` 296 pass / 0 fail，“105 个功能，21 条用户故事，24 项技术验收，关系检查通过” | 以 `test/container/run.sh check` 在容器中运行（`fca03ad` 之后） | ✅ | — |
| 2 | [夹具表](../feature-list/modules/10-repo-release.md#夹具) 的全部夹具（含 `rules-commands`、`guard-options`）比对与入口用例通过 | 20 个夹具测试全部通过，含 `rules-commands` 与 `guard-options` 的 9 个入口用例；夹具与 hooks 模块测试单独运行 23 pass / 0 fail | `test/container/run.sh check`；[M4-04 验收](M4-04-guard-options.md) §3 | ✅ | — |
| 3 | 能力数据的 `components.rules`、`components.commands` 注明实测或源码核对出处 | Claude Code 两个目标的 commands 指向「commands 与 userConfig」与「UAPA 夹具产物」实测；agy 的 rules 指向「rules（1.3.5，容器）」与「UAPA 夹具产物（1.3.5，容器）」；Codex 的 commands 与 rules 指向源码核对「commands、rules 与用户配置」 | `src/capabilities/` 四个文件 | ✅ | — |
| 4 | TA-24：rules、commands 与守卫选项在宿主会话中按调研结论生效 | agy 的三种规则生效（`glob` 在 `04328f0` 修正后）；Claude Code 的两个命令可调用；`guard-options` 两种形态在设置前后分别读到默认值与设置的值 | [M4-05 验收](M4-05-v0-3-0-live-tests.md)（宿主实测，Claude Code 2.1.296、agy 1.3.5） | ✅ | — |
| 5 | M4-01～M4-05 的验收结论均为通过，表头有 commit 号 | 4 张为通过；M4-02 为有条件通过（Codex 转换命令的调用未核对）；5 张表头都有 commit 号 | 各验收文件表头 | ⏳ | 维护者确认使用 Codex CLI 后，在测试容器中安装 `rules-commands` 的 Codex 产物并调用转换后的技能，结论回填 M4-02 §7 与本文 §1 |

## 2. 工单一览

| 工单 | 名称 | 验收结论 | commit | 验收文件 |
|---|---|---|---|---|
| M4-01 | v0.3.0 接口定稿 | 通过 | `25bf526` | [M4-01](M4-01-v0-3-0-interfaces.md) |
| M4-02 | rules 与 commands | 有条件通过（Codex 转换命令的调用未核对） | `ee66f81`、`04328f0` | [M4-02](M4-02-rules-and-commands.md) |
| M4-03 | 按命名空间合并共用的 JSON | 通过 | `61dd481` | [M4-03](M4-03-json-namespace-merge.md) |
| M4-04 | 守卫选项 | 通过 | `2491715` | [M4-04](M4-04-guard-options.md) |
| M4-05 | v0.3.0 产物的宿主实测 | 通过 | `0a8438e`、`fca03ad` | [M4-05](M4-05-v0-3-0-live-tests.md) |

## 3. 功能点汇总

> 总览声明的每个功能点在收口时的状态，取自各验收文件 §2；声明了却没有验收覆盖的功能点在此列出。

| 功能点 | 状态 | 出自工单 |
|---|---|---|
| `F-01-10` 读取 rules | ✅ | M4-02 |
| `F-01-11` 读取 commands | ✅ | M4-02 |
| `F-03-16` 检查 rules 与 commands 的承载 | ✅ | M4-02 |
| `F-05-16` 放置 commands | ✅（容器会话实测） | M4-02、M4-05 |
| `F-06-09` commands 与 rules 的承载 | ✅（产物与残余风险；转换后的调用未实测，见 §4） | M4-02 |
| `F-11-09` 生成 rules | ✅（`globs` 的前缀修正为 `04328f0`，容器会话实测） | M4-02、M4-05 |
| `F-03-07` 按命名空间合并共用的 JSON 文件 | ✅ | M4-03 |
| `F-02-05` 守卫选项 | ✅ | M4-04 |
| `F-04-09` 向守卫传入选项 | ✅ | M4-04 |
| `F-05-17` 生成守卫选项的 `userConfig` | ✅（`validate --strict` 与容器会话实测） | M4-04、M4-05 |
| `F-05-18` 读取守卫选项 | ✅（两种形态的容器会话实测） | M4-04、M4-05 |
| `F-06-10` 守卫选项取默认值（Codex） | ✅ | M4-04 |
| `F-11-10` 守卫选项取默认值（agy） | ✅ | M4-04 |

## 4. 技术债入账

> 各验收文件 §7 中尚未关闭、去向为后续 Sprint 或未定的条目在此汇总；不属于任何 Sprint 的记入
> [`tech-debt.md`](tech-debt.md)。一票否决项不入本表。

| # | 债 | 出自 | 去向 |
|---|---|---|---|
| 1 | Codex 把 `commands/*.md` 转换为技能后的调用方式未实测 | M4-02 §7 第 2 项 | 维护者确认使用 Codex CLI（`AGENTS.md`：逐次确认）后在测试容器中实测，认证见[容器测试「认证」](../../test/container/README.md#认证) |

## 5. 回流

- [x] `README.md` 验收索引已更新
- [x] 功能清单中受影响的功能条目、范围决策与技术验收的状态描述已同步（F-11-09 的验收标准增加
      `globs` 的 `**/` 前缀与残余风险；角色审计 P-01、P-04 写明 US-19、US-21 已由 TA-24 实测）
- [x] 各验收 §7 的去向已写入接手的施工单或 `tech-debt.md`（M4-02 §7 第 1 项已由 M4-05 关闭，第 2 项
      见本文 §4；其余工单的 §7 没有条目）

## 6. 下一步

- Codex 转换命令的实测待维护者确认；完成后改判 M4-02 与本文。
- v0.3.0 是否发布由维护者决定：创建与推送 tag、同步公共仓库各需确认。
