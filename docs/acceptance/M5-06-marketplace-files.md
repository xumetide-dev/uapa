# 验收 M5-06：marketplace 文件

> 本文记录 M5-06 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M5-06](../workorders/M5-06-marketplace-files.md) |
| 覆盖功能点 | `F-03-18`、`F-05-24`、`F-06-15`（取自总览「工单构成」表） |
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
| 1 | 硬约束：确定性输出 | `host-coverage` 夹具逐字节比对；条目字段顺序固定 | | | ⏳ |
| 2 | 硬约束：不越权写入 | `host-coverage` 夹具比对运行后的整个源项目目录：只多出两个 marketplace 文件；`--check` 的单元测试断言不写文件；施工单说明与 TA-07 的写法同步 | | | ⏳ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-03-18` | 写出 marketplace 文件 | 配置 `marketplace` 时，宿主模块按模块接口 §5 返回本宿主的 marketplace 文件，路径相对 `marketplace.dir`；构建编排在写出插件目录之后，只为有成功目标的宿主写出，不清空所在目录；与写入的插件目录中的文件同路径时该宿主的目标失败；写出时该宿主每个成功目标的报告 `units` 追加 `{ kind: 'marketplace', path }`；`--check` 比对，差异路径的写法同模块接口 §2（SD-41） | ⏳ | |
| `F-05-24` | 生成 `marketplace.json` | 配置 `marketplace` 时返回 `.claude-plugin/marketplace.json`：`name`、`owner`、`metadata.description`（取配置的 `description`），`plugins` 只含本插件一项（`name`、`source`、`description`），不写 `version`（版本以 `plugin.json` 为准）；`source` 为从 `marketplace.dir` 到插件目录、以 `./` 开头的相对路径，两者相同时为 `"./"`；产物通过 `claude plugin validate --strict`，按 TA-25（2.1.296）能添加并安装（SD-41） | ⏳ | |
| `F-06-15` | 生成 `marketplace.json` | 配置 `marketplace` 时返回 `.agents/plugins/marketplace.json`：`name`，`plugins` 只含本插件一项（`name` 与 `source`），`source` 为从 `marketplace.dir` 到插件目录、以 `./` 开头的路径字符串，两者相同时为 `"./"`；不写 `policy` 与 `category`（可省略，默认 `AVAILABLE` 与 `ON_INSTALL`）；字段按 rust-v0.162.1 `core-plugins/src/marketplace.rs`，会话中的添加与安装待维护者确认后实测（SD-41） | ⏳ | |

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
