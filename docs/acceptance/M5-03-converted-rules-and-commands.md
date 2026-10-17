# 验收 M5-03：rules 与 commands 的换算承载

> 本文记录 M5-03 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M5-03](../workorders/M5-03-converted-rules-and-commands.md) |
| 覆盖功能点 | `F-03-19`、`F-05-19`、`F-06-11`、`F-06-13`、`F-11-11`（取自总览「工单构成」表） |
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
| 1 | 硬约束：产物零依赖 | 规则入口的导入检查（与 TA-01 相同的测试）；`rules-commands` 的入口用例以 `process.execPath` 运行，环境为空 | | | ⏳ |
| 2 | 硬约束：不在运行时推断宿主 | 规则入口不读取宿主环境变量，输出在打包时确定；入口用例在空环境中得到同样的输出 | | | ⏳ |
| 3 | 硬约束：确定性输出 | `rules-commands` 夹具逐字节比对；规则按名称排序 | | | ⏳ |
| 4 | 硬约束：不越权写入 | 夹具比对运行后的整个源项目目录 | | | ⏳ |
| 5 | 硬约束：能力数据有出处 | 四个能力数据模块中 `converted` 的取值各带出处注释（TA-25 小节、Codex 源码） | | | ⏳ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-03-19` | 换算承载的组件 | `Carrier` 增加 `converted`：组件由宿主模块按 `TargetPlan` 换成宿主承载的其他组件；构建编排按 F-03-02 筛选后放进 `TargetPlan`，不为该目标原样复制；同一插件目录中另有目标原样承载该组件时，原样复制照常进行（SD-38、SD-39） | ⏳ | |
| `F-05-19` | rules 的换算承载 | 两个目标的 `components.rules` 为 `converted`；`model` 与 `glob` 规则写为 `skills/<name>/SKILL.md`，frontmatter 依次写 `name`、`description`（有值时）、`paths`（`glob` 时，YAML 列表，模式原样）与 `user-invocable: false`，正文为 `Rule.body`；`always` 规则按名称顺序由 `SessionStart` 命令 hook 输出正文，入口文件与命令按入口与打包接口，条目排在守卫条目之后、声明的命令 hooks 之前；与源项目 skill 同名时生成失败；`always` 规则的输出超过 10,000 字符时残余风险写明超出部分不进入上下文（SD-38） | ⏳ | |
| `F-06-11` | rules 的换算承载 | `components.rules` 为 `converted`；`model` 规则与有 `description` 的 `glob` 规则写为 `skills/<name>/SKILL.md`，内容与 F-05-19 相同，共用插件目录时逐字一致；没有 `description` 的 `glob` 规则列为跳过，原因写明 Codex 的技能须有 `description`；有 `glob` 规则写为技能时残余风险写明 Codex 不按 `paths` 加载，由模型按描述决定；`always` 规则由 `SessionStart` 命令 hook 输出正文，残余风险写明 Codex 须先信任插件的 hooks；与源项目 skill 同名时生成失败（SD-38） | ⏳ | |
| `F-06-13` | 逐个检查 commands 的转换 | 按 rust-v0.162.1 `core-plugins/src/command_migration.rs` 的条件逐个检查 `TargetPlan.commands`：正文含模板写法、转换结果超过 4000 字节、名称超过 64 字符等会被 Codex 跳过的命令列为跳过（`component` 为 `commands/<name>.md`，原因写明条件）；代替 F-06-09 中笼统的残余风险（SD-43） | ⏳ | |
| `F-11-11` | commands 的承载 | 按 TA-25 实测：`components.commands` 为 `converted`，宿主模块把 `TargetPlan.commands` 写为 `skills/<name>/SKILL.md`（frontmatter 写 `name` 与 `description`，正文为命令正文），与源项目 skill 同名时生成失败，模板写法与模型自动选用按实测写残余风险；实测 agy 安装时直接加载 `commands/` 时改为 `package`，由构建编排原样复制（SD-39） | ⏳ | |

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
