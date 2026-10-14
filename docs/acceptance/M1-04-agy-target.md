# 验收 M1-04：agy 目标

> 本文记录 M1-04 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M1-04](../workorders/M1-04-agy-target.md) |
| 覆盖功能点 | `F-11-01`、`F-11-02`、`F-11-03`、`F-11-04`、`F-11-05`（取自总览「工单构成」表） |
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
| 1 | 硬约束：守卫不静默失效 | 入口用例：守卫抛错、缺少 `conversationId`、缺少 `toolCall.args.CommandLine` 时执行前检查输出 `decision: "deny"` | | | ⏳ |
| 2 | 硬约束：产物零依赖 | 打包后的 `hooks/uapa-agy.mjs` 只含 `node:` 导入 | | | ⏳ |
| 3 | 硬约束：不在运行时推断宿主 | 入口不读 `ANTIGRAVITY_CONVERSATION_ID` 与其他宿主的变量；设置这些变量时输出不变 | | | ⏳ |
| 4 | 硬约束：确定性输出 | 生成的 `plugin.json`、`hooks.json` 与期望文本逐字比对 | | | ⏳ |
| 5 | 硬约束：不越权写入 | 停机计数只写入 `TMPDIR` 下的 `uapa-<插件名>/` | | | ⏳ |
| 6 | 硬约束：能力数据有出处 | 数据模块写 1.3.4、核对日期 2026-10-14 与出处 `agy-plugins.md`；未实测的 `Stop` 超时注明“未实测” | | | ⏳ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-11-01` | `agy:subprocess` 的能力数据 | 宿主版本 1.3.4，写明核对日期与出处；取值与 hooks 适配第 4、6、7、8 节一致，工具名见[跨平台对比「工具名差异」](../research/coding-agent-plugin-manifests/cross-platform-comparison.md#工具名差异)；`rewriteInput`、`stopGate` 为支持，`promptGate`、`replaceOutput`、`withholdOutput` 为不支持（宿主没有提示提交事件，`PostToolUse` 不能替换输出）；`failureDefault.beforeTool` 为 `{ error: 'deny', timeout: 'deny' }`（本地实测），`beforeStop` 为 `{ error: 'allow', timeout: 'allow' }`（出错为本地实测，超时注明“未实测”），`beforePrompt` 为 `{ error: 'allow', timeout: 'allow' }` 并注明“宿主没有该事件”；`hookTimeoutSeconds` 与 `defaultTimeoutSeconds` 为 30；在登记处加入本目标（M4） | ⏳ | |
| `F-11-02` | 生成根 `plugin.json` | 只写 `name` 与 `description`（宿主 schema 不允许其他字段），不写 `$schema`（文档给出的地址返回 404）；不写 `skills` 字段，宿主加载 `skills/` 下的全部 skill；名称不匹配 `^[a-zA-Z0-9_-]+$` 时生成失败；该文件不标为可合并，`conflictHint` 为“agy 的根 plugin.json 只允许 name 与 description，不能与其他宿主的根 plugin.json 合并；为 hosts.agy.dir 设置单独的目录”；在宿主模块登记处加入本宿主（M4） | ⏳ | |
| `F-11-03` | 生成 `hooks.json` | 写入插件根目录的 `hooks.json`，顶层只有一个键，为配置的 `name`；其值按 `TargetPlan.checks` 写事件：`beforeTool` → `PreToolUse`，元素为 `{ "matcher": "", "hooks": [<处理器>] }`（`""` 匹配全部工具，本地实测）；`beforeStop` → `Stop`，元素直接为处理器；处理器依次写 `type: "command"`、`command`、`timeout`（取能力数据的 `hookTimeoutSeconds`，即 30）；`command` 为 `node hooks/uapa-agy.mjs <检查名>`（hook 以插件目录为工作目录，本地实测）；不写 `enabled`；与 Claude Code 共用插件目录时，残余风险写明安装命令是否把含 `.claude-plugin/` 的目录按 Claude Code 插件转换未实测 | ⏳ | |
| `F-11-04` | 子进程入口的决策输出 | `generate` 以 `input.bundle`（`entry: 'agy-subprocess'`、`external: 'node'`）打包入口并输出为 `hooks/uapa-agy.mjs`。`agy-subprocess.ts` 实现 `SubprocessProtocol`：会话 id 取 stdin `conversationId`，工具名取 `toolCall.name`，入参取 `toolCall.args`，命令字段为 `CommandLine`；`PreToolUse` 的 stdout 不是含 `decision` 的 JSON 时宿主阻断（本地实测），因此执行前检查的放行输出 `{"decision":"allow"}`，停机前检查的放行输出 `{}`；拒绝输出 `{"decision":"deny","reason":<原因>}`，退出码 0；改写输出 `{"decision":"allow","overwrite":{"CommandLine":<命令>}}`（宿主按键浅合并）；停机继续输出 `{"decision":"continue","reason":<原因>}`；`dataDir` 返回 `path.join(os.tmpdir(), 'uapa-' + encodeURIComponent(插件名))`（宿主没有插件数据目录变量，SD-06）；有停机前检查时残余风险写明系统临时目录被清理时停机计数归零 | ⏳ | |
| `F-11-05` | 字段白名单检查 | `plugin.json` 只含 `name`、`description`；`hooks.json` 顶层只有一个键，其值只含 `SessionStart`、`PreToolUse`、`PostToolUse`、`Stop`；`PreToolUse`、`PostToolUse` 的元素只含 `matcher`、`hooks`；处理器只含 `type`、`command`、`timeout`；超出时生成失败 | ⏳ | |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
pnpm check
node --test test/targets/agy.test.ts
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `pnpm check` | ⏳ | 无 |
| `node --test test/targets/agy.test.ts` | ⏳ | 无 |

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
