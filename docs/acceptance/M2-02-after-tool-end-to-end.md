# 验收 M2-02：执行后检查端到端

> 本文记录 M2-02 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M2-02](../workorders/M2-02-after-tool-end-to-end.md) |
| 覆盖功能点 | `F-02-04`、`F-04-08`、`F-05-13`、`F-06-07`（取自总览「工单构成」表） |
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
| 1 | 硬约束：守卫不静默失效 | `after-tool` 夹具的入口用例：守卫抛错、返回值无效与输入无法解析时输出扣留；`requires` 含目标缺少的 `replaceOutput` 或 `withholdOutput` 时该目标失败（单元测试）；agy 的报告写明执行后检查被省略 | | | ⏳ |
| 2 | 硬约束：产物零依赖 | TA-01：`after-tool` 产物的子进程入口只导入 `node:` 内置模块，`hooks/uapa-guard.mjs` 只导入 `'claude-code'` | | | ⏳ |
| 3 | 硬约束：不在运行时推断宿主 | 入口只读打包时内联的 `capabilities`；子进程协议单元测试断言能力数据与协议方法一致 | | | ⏳ |
| 4 | 硬约束：确定性输出 | `after-tool` 夹具在临时目录中构建，产物与报告逐字比对 | | | ⏳ |
| 5 | 硬约束：能力数据有出处 | 各目标 `failureDefault.afterTool` 的注释指向 M2-01 的调研结论；TA-09 通过 | | | ⏳ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-02-04` | 执行后检查接口 | `GuardPlugin` 增加 `afterTool`，包入口导出 `AfterTool`；`GuardCheck` 增加 `'afterTool'`；F-02-03 不再拒绝 `afterTool` 与 `replaceOutput`、`withholdOutput`，这两项能力参与构建时能力检查 | ⏳ | |
| `F-04-08` | 执行后检查的异常收口 | 执行后检查出错时按扣留输出，以说明文字替换原输出 | ⏳ | |
| `F-05-13` | 执行后检查的决策输出 | 命令 hooks 以 `updatedToolOutput` 替换输出；hooks 模块在 `next` 之后返回 `{ result }`，扣留返回 `{ deny }` | ⏳ | |
| `F-06-07` | 执行后检查的决策输出 | 扣留以 `PostToolUse` 返回 `decision: "block"` 输出；声明需要 `replaceOutput` 时构建失败 | ⏳ | |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
pnpm check
node --test test/fixtures/fixtures.test.ts test/runtime/decisions.test.ts test/runtime/subprocess.test.ts test/runtime/in-process.test.ts test/runtime/claude-code-subprocess.test.ts test/runtime/codex-subprocess.test.ts test/build/checks.test.ts test/source/guard.test.ts
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `pnpm check` | ⏳ | 无 |
| `node --test test/fixtures/fixtures.test.ts test/runtime/decisions.test.ts test/runtime/subprocess.test.ts test/runtime/in-process.test.ts test/runtime/claude-code-subprocess.test.ts test/runtime/codex-subprocess.test.ts test/build/checks.test.ts test/source/guard.test.ts` | ⏳ | 无 |

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
