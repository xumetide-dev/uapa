# 验收 M4-02：rules 与 commands

> 本文记录 M4-02 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M4-02](../workorders/M4-02-rules-and-commands.md) |
| 覆盖功能点 | `F-01-10`、`F-01-11`、`F-03-16`、`F-05-16`、`F-06-09`、`F-11-09`（取自总览「工单构成」表） |
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
| 1 | 硬约束：确定性输出 | `rules-commands` 夹具逐字节比对；rules 按名称排序生成，frontmatter 只含源项目的取值 | | | ⏳ |
| 2 | 硬约束：不越权写入 | `rules-commands` 夹具比对运行后的整个源项目目录：commands 与 rules 只出现在插件目录 | | | ⏳ |
| 3 | 硬约束：能力数据有出处 | 四个能力数据模块的 `components.rules`、`components.commands` 各带出处注释；TA-09 的测试照常通过 | | | ⏳ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-01-10` | 读取 rules | 读取 `rules/` 下一层的 `<name>.md`，其他项忽略；`<name>` 只含字母、数字、`_`、`-`；frontmatter 必须存在且只含 `activation`、`description`、`globs`、`targets`：`activation` 为 `always`、`model` 或 `glob`；`description` 出现时为非空单行字符串，`activation` 为 `model` 时必填；`activation` 为 `glob` 时 `globs` 为非空字符串数组，元素非空、不含 `,` 与换行，其他取值时不得出现 `globs`；`targets` 的规则同 F-01-05；`Rule.body` 为 frontmatter 之后的原文；违反时返回 `InputIssue`，`field` 写到 frontmatter 字段，如 `activation`（模块接口 §3，SD-32） | ⏳ | |
| `F-01-11` | 读取 commands | 读取 `commands/` 下一层的 `<name>.md`，其他项忽略；`<name>` 只含字母、数字、`_`、`-`；frontmatter 的 `description` 为非空字符串，`targets` 的规则同 F-01-05，其他键不校验、原样保留；缺少 frontmatter 或 `description` 时返回 `InputIssue`（模块接口 §3，SD-33） | ⏳ | |
| `F-03-16` | 检查 rules 与 commands 的承载 | `TargetCapabilities.components` 增加 `rules` 与 `commands`，缺少时 `tsc` 报错；`TargetPlan` 增加 `rules` 与 `commands`，按 F-03-02 筛选：目标不承载时，未在 frontmatter 写明该目标的条目写入其报告的 `skipped`（`component` 为 `rules/<name>.md`、`commands/<name>.md`），写明时该目标失败；commands 由构建编排按插件目录原样复制为 `commands/<name>.md`，并集与残余风险同 agents（模块接口 §5，SD-33）；rules 由宿主模块按 `TargetPlan.rules` 生成（SD-32） | ⏳ | |
| `F-05-16` | 放置 commands | 两个目标的能力数据 `components.commands` 为 `package`、`components.rules` 为 `none`（插件根的 `CLAUDE.md` 不作为上下文加载，插件没有规则组件）；适用的 commands 由构建编排原样写入产物 `commands/<name>.md`，frontmatter 中的 `targets` 不影响加载（[本地实测「commands 与 userConfig」](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#commands-与-userconfig)，SD-33） | ⏳ | |
| `F-06-09` | commands 与 rules 的承载 | 能力数据的 `components.commands` 为 `package`（兼容格式的插件在安装时把 `commands/*.md` 转换为技能），`components.rules` 为 `none`，依据 [Codex hooks 源码核对记录「commands、rules 与用户配置」](../research/coding-agent-plugin-manifests/codex-source-review.md#commandsrules-与用户配置)（rust-v0.162.1）；适用的 commands 由构建编排原样写入产物 `commands/<name>.md`；`TargetPlan.commands` 非空时残余风险写明“Codex 安装时把 commands 转换为技能，正文含 `$ARGUMENTS` 等模板写法或转换结果超过 4000 字节的命令被跳过，UAPA 不检查”（SD-33） | ⏳ | |
| `F-11-09` | 生成 rules | 能力数据的 `components.rules` 为 `package`，`components.commands` 为 `none`（文档写明插件没有斜杠命令组件）；按 `TargetPlan.rules` 生成 `rules/<name>.md`：frontmatter 依次写 `trigger`（`always` → `always_on`，`model` → `model_decision`，`glob` → `glob`）、`description`（有值时）与 `globs`（`glob` 时为以 `,` 连接的一个字符串），正文为 `Rule.body` 原文；生成的文件超过 24,000 字节时残余风险写明超出部分被宿主截断；依据 [agy「rules（1.3.5，容器）」](../research/coding-agent-plugin-manifests/agy-plugins.md#rules135容器)（SD-32） | ⏳ | |

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
| `test/container/run.sh check` | ⏳ | Docker |
| `test/container/run.sh exec node --test test/fixtures/fixtures.test.ts` | ⏳ | Docker |

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
