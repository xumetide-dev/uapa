# 验收 M4-04：守卫选项

> 本文记录 M4-04 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M4-04](../workorders/M4-04-guard-options.md) |
| 覆盖功能点 | `F-02-05`、`F-04-09`、`F-05-17`、`F-05-18`、`F-06-10`、`F-11-10`（取自总览「工单构成」表） |
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
| 1 | 硬约束：守卫不静默失效 | `guard-options` 的入口用例：`CLAUDE_PLUGIN_OPTION_*` 为无效值时执行前检查以退出码 2 拒绝；hooks 模块以桩传入类型不符的 `options` 时返回 `{ deny }` | | | ⏳ |
| 2 | 硬约束：产物零依赖 | TA-01 的导入检查覆盖 `guard-options` 的入口与守卫文件 | | | ⏳ |
| 3 | 硬约束：不在运行时推断宿主 | 入口只按打包时注入的 `options` 与本目标协议读取；`codex:subprocess`、`agy:subprocess` 的入口用例设置 `CLAUDE_PLUGIN_OPTION_*` 时仍取默认值 | | | ⏳ |
| 4 | 硬约束：确定性输出 | `guard-options` 夹具逐字节比对；`userConfig` 与 `options` 按选项名排序 | | | ⏳ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-02-05` | 守卫选项 | `GuardPlugin` 增加可选的 `options`（选项名 → `GuardOption`：`type` 为 `'string'`、`'number'` 或 `'boolean'`，`title`、`description` 为非空字符串，`default` 的类型与 `type` 一致），各检查方法增加最后一个参数 `GuardContext`（`options` 为选项名 → 取值）；包入口导出 `GuardOption`、`GuardContext`；`readGuard` 校验选项：选项名匹配 `^[A-Za-z][A-Za-z0-9_]*$`，全大写后不重复，`title` 与 `description` 为非空单行字符串，`default` 与 `type` 一致且 number 为有限数；违反时返回 `InputIssue`，`field` 如 `options.maxRetries.default`；`GuardDeclaration.options` 按选项名排序（SD-35） | ⏳ | |
| `F-04-09` | 向守卫传入选项 | `TargetRuntimeData` 增加 `options`（`GuardDeclaration.options` 中各选项的 `type` 与 `default`）；子进程入口在调用守卫前经宿主实现的 `optionValue` 取得各选项的文本：协议未实现该方法或返回 `undefined` 时取 `default`，否则按 `type` 解析（number 为有限数，boolean 只接受 `true`、`false`）；解析失败时按守卫出错处理（F-04-04、F-04-08），原因为 `uapa: 守卫选项无效: <选项名>`；取值以 `GuardContext` 传给本次调用的检查（入口与打包接口第 3 节，SD-35） | ⏳ | |
| `F-05-17` | 生成守卫选项的 `userConfig` | 守卫声明有选项且至少一个 Claude Code 目标的 `TargetPlan.checks` 非空时，`plugin.json` 的 `userConfig` 在 `hosts['claude-code'].userConfig` 的选项之后按选项名写入各选项的 `type`、`title`、`description`、`default`；宿主选项 `userConfig` 不是对象，或其中某个键与某个守卫选项名全大写后相同时生成失败（SD-35） | ⏳ | |
| `F-05-18` | 读取守卫选项 | `claude-code-subprocess.ts` 的 `optionValue` 返回环境变量 `CLAUDE_PLUGIN_OPTION_<选项名的全大写>`（宿主只导出用户设置过的选项，未设置时取 `default`）；hooks 模块入口以 `register` 的 `options` 取值，值的类型与声明不一致时按 F-04-09 的无效取值处理；依据[本地实测「commands 与 userConfig」](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#commands-与-userconfig) | ⏳ | |
| `F-06-10` | 守卫选项取默认值 | 入口协议不实现 `optionValue`，守卫选项取 `default`；守卫声明有选项且 `TargetPlan.checks` 非空时，残余风险写明“Codex 没有插件用户配置，守卫选项取构建时默认值”（SD-35） | ⏳ | |
| `F-11-10` | 守卫选项取默认值 | 入口协议不实现 `optionValue`，守卫选项取 `default`；守卫声明有选项且 `TargetPlan.checks` 非空时，残余风险写明“agy 没有已核实的插件用户配置，守卫选项取构建时默认值”（SD-35） | ⏳ | |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
test/container/run.sh check
```

```bash
test/container/run.sh exec node --test test/fixtures/fixtures.test.ts test/fixtures/hooks-module.test.ts
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `test/container/run.sh check` | ⏳ | Docker |
| `test/container/run.sh exec node --test test/fixtures/fixtures.test.ts test/fixtures/hooks-module.test.ts` | ⏳ | Docker |
| 宿主实测：`claude plugin validate --strict <插件目录>` | ⏳ | Docker；容器中的 Claude 令牌 |

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
