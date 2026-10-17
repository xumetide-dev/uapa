# 验收 M5-05：守卫可靠性与残余风险

> 本文记录 M5-05 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M5-05](../workorders/M5-05-guard-reliability-and-risks.md) |
| 覆盖功能点 | `F-05-21`、`F-05-22`、`F-05-23`、`F-06-14`、`F-06-16`、`F-11-14`（取自总览「工单构成」表） |
| 验收日期 | 待定 |
| 验收结论 | 待定 |
| 判断范围 | 待定 |
| commit | 待回填 |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 待核对 | |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 待核对 | |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 待核对 | |
| V4 | 能力数据含无出处的宿主行为 | 待核对 | |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：守卫不静默失效 | `host-coverage` 的 `hooks.json` 中执行前与提示提交前守卫条目带 `onFailure`；`Monitor` 的入口用例以标记命令得到拒绝；TA-27 在宿主中复测 | | | ⏳ |
| 2 | 硬约束：确定性输出 | `command-hooks`、`host-coverage` 夹具逐字节比对 | | | ⏳ |
| 3 | 硬约束：能力数据有出处 | `toolNames` 新增项的注释指向 TA-25 的小节 | | | ⏳ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-05-21` | 执行前与提示提交前 hook 出错时阻断 | `hosts['claude-code'].onFailure` 为 `'block'` 时，`hooks/hooks.json` 中 `PreToolUse` 与 `UserPromptSubmit` 的守卫条目写 `onFailure: "block"`，其余守卫条目与声明的命令 hooks 不写；`claude-code:subprocess` 的残余风险把“缺少 Node 时守卫不生效”换为“运行宿主的机器缺少 Node ≥ 22 时，每次工具调用与提示都被阻断”，并写明 Claude Code 2.1.295 之前的版本对该字段的处理未核实；同时配置两种形态时另写明 hooks 模块生效时命令入口仍会运行；只配置 `claude-code:in-process` 时残余风险写明该选项不生效（SD-43） | ⏳ | |
| `F-05-22` | 补全工具名换算 | 按 TA-25 实测（2.1.296）修改两个目标的 `toolNames`：`Monitor` 换为 `shell`（入参含 `command`，与 `Bash` 相同，改写写回该字段），`NotebookEdit` 换为 `edit_file`（入参 `notebook_path`、`cell_id`、`new_source`、`edit_mode` 原样传给守卫）；注释指向调研文档（SD-43） | ⏳ | |
| `F-05-23` | 补全残余风险 | 声明 `SessionEnd` 命令 hook 时写明插件 hooks 的 `timeout` 不提高宿主 1.5 秒的总预算；有执行前检查时写明用户安装的 mod 可以推翻插件 hook 的拒绝，以及 `disableAllHooks`、`--safe-mode`、`--bare` 与托管设置可使插件 hooks 不运行；agent 的 frontmatter 含 `permissionMode`、`hooks`、`mcpServers`、`initialPrompt` 时写明插件 agent 忽略这些键；出处为 Claude Code 文档「hooks」「permissions」「plugins reference」（SD-43） | ⏳ | |
| `F-06-14` | `SessionEnd` 的超时 | 声明的 `SessionEnd` 命令 hook 写 `timeout: 3`（宿主把更大的值压到 3 秒，并在每次会话开始告警，rust-v0.162.1 `hooks/src/engine/discovery.rs`）；F-06-08 的残余风险改为“Codex 的 `SessionEnd` 超时上限 3 秒”（SD-43） | ⏳ | |
| `F-06-16` | 补全残余风险 | 有守卫或声明的命令 hooks 时写明 `allow_managed_hooks_only` 与 `[features].hooks = false` 使插件 hooks 不运行；skill 名超过 64 字符或 `<插件名>:<skill 名>` 超过 129 字符时该 skill 列为跳过；skill 目录内另有 `SKILL.md` 时残余风险写明 Codex 把它注册为另一个技能（rust-v0.162.1 源码，SD-43） | ⏳ | |
| `F-11-14` | 补全残余风险 | agent 的 frontmatter 含 `tools` 或 `model` 时写明 agy 按自身的工具名与模型名解释，写错的工具名可能使子代理挂起（agy 文档「Custom subagents」）；rule 正文含 `@[` 时写明被引用的文件须经 `files/` 或 `overrides/agy/` 提供，大小上限按展开后计算（agy 文档「Rules」）；有停机前检查时写明宿主在连续继续 10 次后不再采用 `continue`（TA-25，1.3.5；CHANGELOG 1.1.9 称次数可配置）；有执行前检查时写明 `/btw` 不运行用户与工作区的 hooks、插件 hooks 是否运行未实测（CHANGELOG 1.3.3）；插件 agent 的会话中 hooks 照常运行，不写残余风险（TA-25）（SD-43） | ⏳ | |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
test/container/run.sh check
```

```bash
test/container/run.sh exec node --test test/fixtures/fixtures.test.ts
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `test/container/run.sh check` | ⏳ | Docker 可用 |
| `test/container/run.sh exec node --test test/fixtures/fixtures.test.ts` | ⏳ | Docker 可用 |

## 4. 交付物

待验收时填写。

## 5. 与计划的偏差

待验收时填写；没有偏差写“无”。

## 6. 技术决策

待验收时填写。架构文档或接口文档中还写着“待定”“未核实”而本单定下的，登记回填状态。

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

待验收时填写。
