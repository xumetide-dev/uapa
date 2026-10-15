# 验收 M2-03：agents

> 本文记录 M2-03 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M2-03](../workorders/M2-03-agents-component.md) |
| 覆盖功能点 | `F-01-07`、`F-05-11`、`F-11-07`（取自总览「工单构成」表） |
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
| 1 | 硬约束：确定性输出 | `components` 夹具在临时目录中构建，agents 文件逐字节比对；读取顺序按文件名排序 | | | ⏳ |
| 2 | 硬约束：不越权写入 | `components` 夹具与 `--check` 的单元测试：agents 只写入插件目录，`--check` 不写文件 | | | ⏳ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-01-07` | 读取 agents | 读取 `agents/` 下一层的 `.md` 文件与 frontmatter，校验 `name`（与文件名去掉 `.md` 相同）与 `description`；支持 `targets` 筛选（SD-30） | ⏳ | |
| `F-05-11` | 放置 agents | 适用的 agents 由构建编排原样写入产物 `agents/<name>.md`（SD-30） | ⏳ | |
| `F-11-07` | 放置 agents | 适用的 agents 由构建编排原样写入产物 `agents/<name>.md`（SD-30） | ⏳ | |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
pnpm check
node --test test/fixtures/fixtures.test.ts test/source/agents.test.ts test/build/build.test.ts test/targets/claude-code.test.ts test/targets/agy.test.ts test/targets/codex.test.ts
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `pnpm check` | ⏳ | 无 |
| `node --test test/fixtures/fixtures.test.ts test/source/agents.test.ts test/build/build.test.ts test/targets/claude-code.test.ts test/targets/agy.test.ts test/targets/codex.test.ts` | ⏳ | 无 |

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
