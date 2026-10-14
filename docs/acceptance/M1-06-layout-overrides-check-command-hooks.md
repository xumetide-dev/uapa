# 验收 M1-06：合并布局、覆盖文件、比对与命令 hooks

> 本文记录 M1-06 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M1-06](../workorders/M1-06-layout-overrides-check-command-hooks.md) |
| 覆盖功能点 | `F-01-06`、`F-03-06`、`F-03-08`、`F-03-12`、`F-09-04`、`F-01-09`、`F-03-15`、`F-05-15`、`F-06-08`、`F-11-06`（取自总览「工单构成」表） |
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
| 1 | 硬约束：守卫不静默失效 | `throwing-guard` 与 `requires-missing` 夹具（TA-03、TA-04） | | | ⏳ |
| 2 | 硬约束：不在运行时推断宿主 | TA-05：`full` 之前以三个子进程目标的入口用例各运行两次，输出逐字一致 | | | ⏳ |
| 3 | 硬约束：确定性输出 | 夹具逐字节比对 | | | ⏳ |
| 4 | 硬约束：不越权写入 | 合并布局不删除目录中的其他文件、冲突时不写入（TA-07 的单元部分）；`--check` 前后目录快照一致（TA-08 的单元部分） | | | ⏳ |
| 5 | 硬约束：能力数据有出处 | 三个子进程目标的 `commandHookEvents` 取自命令 hooks 声明第 2 节 | | | ⏳ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-01-06` | 读取覆盖目录 | 列出 `overrides/<宿主>/` 下的文件；目录名不是 `targets` 中已配置的宿主时失败；本模块不复制文件 | ⏳ | |
| `F-03-06` | 合并布局写出 | 按 `resolvePluginDirs`（模块接口 §2）的结果，两个以上宿主的插件目录解析为同一路径时写入同一目录；只写入生成的文件，不删除目录中的其他文件；同名文件内容不一致时写入该目录的全部目标失败、该目录不写入任何文件，错误按模块接口 §8 写明文件、冲突的宿主与 `conflictHint`；该目录可以是源项目根目录，此时不复制 skills | ⏳ | |
| `F-03-08` | 只比对不写入 | 在内存中生成全部产物，与磁盘逐字节比对；不写任何文件，不生成也不比对构建报告；返回新增、修改的文件，默认布局另返回写入前会被清除的文件；失败目标的处理与输出格式见模块接口 §8 | ⏳ | |
| `F-03-12` | 应用覆盖文件 | 宿主模块生成之后、写出之前，用 `overrides/<宿主>/` 中的文件覆盖或新增该宿主的同名文件；覆盖文件不做字段白名单检查；覆盖生成文件时继承其合并标记；每个被覆盖或新增的文件写入该宿主各目标报告的 `overridden` | ⏳ | |
| `F-09-04` | `--check` 选项 | `uapa build --check` 调用只比对模式，不写文件；比对一致且没有目标失败时以退出码 0 结束，有差异或有目标失败时以退出码 1 结束，差异按模块接口 §8 列出；stdout 只含差异行 | ⏳ | |
| `F-01-09` | 校验命令 hooks 声明 | `UapaConfig.commandHooks` 与 `CommandHookDecl` 按[命令 hooks 声明](../architecture/command-hooks.md)第 1 节定义，由包入口导出；`event` 不是第 1 节的六个事件之一、`command` 为空或含换行、`targets` 为空数组、含重复或未配置的目标，或出现 `matcher`、`timeout` 等未知字段时返回 `InputIssue`，字段路径如 `commandHooks[1].event` | ⏳ | |
| `F-03-15` | 检查命令 hooks 的事件承载 | `TargetCapabilities` 增加 `commandHookEvents`（模块接口 §4），缺少时 `tsc` 报错；按[命令 hooks 声明](../architecture/command-hooks.md)第 4 节得出各目标的 `TargetPlan.commandHooks`：适用且宿主事件名不为 `null` 的声明按声明顺序列入；`targets` 显式列出的目标不承载该事件时该目标失败；未显式列出时写入该目标报告的 `skipped`（`component` 为 `commandHooks[<下标>]`），同一宿主的另一目标承载该声明时不写 | ⏳ | |
| `F-05-15` | 写入声明的命令 hooks | 两个目标的能力数据按[命令 hooks 声明](../architecture/command-hooks.md)第 2 节填写 `commandHookEvents`（`claude-code:in-process` 全部为 `null`，`claude-code:subprocess` 的 `SessionEnd` 为 `null`）；`hooks/hooks.json` 的 `hooks` 键按 `claude-code:subprocess` 的 `TargetPlan.commandHooks` 写入条目，结构与 F-05-03 的守卫条目相同，`{pluginRoot}` 换为 `${CLAUDE_PLUGIN_ROOT}`，同一事件下排在守卫条目之后；未配置守卫时只生成 `hooks/hooks.json`，不生成入口；去重（F-05-08）不作用于这些条目 | ⏳ | |
| `F-06-08` | 写入声明的命令 hooks | 能力数据按[命令 hooks 声明](../architecture/command-hooks.md)第 2 节填写 `commandHookEvents`；hooks 配置（默认 `hooks/hooks.json`，或 `hooksFile`）按 `TargetPlan.commandHooks` 写入条目，结构与 F-06-03 的守卫条目相同，`{pluginRoot}` 换为 `$PLUGIN_ROOT`，同一事件下排在守卫条目之后；未配置守卫时只生成 hooks 配置与 `extensions.com.openai.hooks`，不生成入口；声明含 `SessionEnd` 时残余风险写明 Codex 的 `SessionEnd` 默认超时 1 秒、上限 3 秒 | ⏳ | |
| `F-11-06` | 写入声明的命令 hooks | 能力数据按[命令 hooks 声明](../architecture/command-hooks.md)第 2 节填写 `commandHookEvents`（`SessionEnd`、`UserPromptSubmit` 为 `null`）；`hooks.json` 按 `TargetPlan.commandHooks` 每条声明写一个元素，结构同 F-11-03（`PostToolUse` 与 `PreToolUse` 相同，`SessionStart` 与 `Stop` 相同），`{pluginRoot}` 换为 `.`，同一事件下排在守卫元素之后；未配置守卫时只生成 `hooks.json`，不生成入口；声明含 `PreToolUse` 时残余风险写明该命令的 stdout 须为含 `decision` 的 JSON，否则每次工具调用都被阻断 | ⏳ | |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
pnpm check
node --test test/fixtures/fixtures.test.ts
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `pnpm check` | ⏳ | 无 |
| `node --test test/fixtures/fixtures.test.ts` | ⏳ | 无 |

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
