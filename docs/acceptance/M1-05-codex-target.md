# 验收 M1-05：Codex 目标

> 本文记录 M1-05 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M1-05](../workorders/M1-05-codex-target.md) |
| 覆盖功能点 | `F-06-01`、`F-06-02`、`F-06-03`、`F-06-04`、`F-06-05`（取自总览「工单构成」表） |
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
| 1 | 硬约束：守卫不静默失效 | 入口用例：守卫抛错与输入无法解析时以退出码 2 拒绝，stderr 非空；残余风险写明 `$PLUGIN_ROOT` 未展开时 Codex 按失败放行（实测结论前） | | | ⏳ |
| 2 | 硬约束：产物零依赖 | 打包后的 `hooks/uapa-codex.mjs` 只含 `node:` 导入 | | | ⏳ |
| 3 | 硬约束：不在运行时推断宿主 | 入口只读 `PLUGIN_DATA`；设置 `CLAUDE_PLUGIN_DATA` 时输出不变 | | | ⏳ |
| 4 | 硬约束：确定性输出 | 生成文件与期望文本逐字比对 | | | ⏳ |
| 5 | 硬约束：不越权写入 | 停机计数只写入 `PLUGIN_DATA` 所指目录 | | | ⏳ |
| 6 | 硬约束：能力数据有出处 | 数据模块写 0.162.1、核对日期与出处；未实测的 `promptGate` 记为不支持 | | | ⏳ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-06-01` | `codex:subprocess` 的能力数据 | 宿主版本 0.162.1，写明核对日期与出处；取值与 hooks 适配第 4、6、7、8 节一致，工具名见[跨平台对比「工具名差异」](../research/coding-agent-plugin-manifests/cross-platform-comparison.md#工具名差异)；`promptGate` 在 TA-15 实测前为不支持 | ⏳ | |
| `F-06-02` | 生成根 `plugin.json` | `$schema` 格式；顶层字段与键序按模块接口 §5；有 hooks 时 `extensions.com.openai.hooks` 写以 `./` 开头的 hooks 文件路径（如 `./hooks/hooks.json`），`hosts.codex.interface` 写入 `extensions.com.openai.interface`；该文件不标为可合并（按命名空间合并的 F-03-07 为预留）；名称不是 kebab-case 时生成失败 | ⏳ | |
| `F-06-03` | 生成 hooks 配置 | 默认写 `hooks/hooks.json`，文件的 JSON 结构（顶层键、事件下是否有分组）取自 TA-15 入口前提的结论；宿主选项 `hooksFile` 可改为独立文件（相对插件目录，由 F-01-03 校验），路径同时写入 `extensions.com.openai.hooks`；未设 `hooksFile` 时，`hooks/hooks.json` 的 `conflictHint` 为“设置 hosts.codex.hooksFile 改用独立的 hooks 文件”（SD-07）；按 `TargetPlan.checks` 生成条目：`beforeTool` → `PreToolUse`，`beforePrompt` → `UserPromptSubmit`，`beforeStop` → `Stop`；不写 matcher；命令为 `node "$PLUGIN_ROOT/hooks/uapa-codex.mjs" <检查名>`，命令是否经 shell 执行待 TA-15；超时字段未核实，不写出；残余风险写明：插件 hooks 只对 Codex 桌面端手动安装的插件生效，含 hooks 的插件不能进入公开目录，运行前需要持久化的 hook 信任；TA-15 实测前，命令不经 shell 执行时 `$PLUGIN_ROOT` 不展开、入口无法启动，Codex 按失败放行；合并布局中 Codex 是否另读取 Claude Code 的 `hooks/hooks.json` 未实测 | ⏳ | |
| `F-06-04` | 子进程入口的决策输出 | `generate` 以 `input.bundle`（`entry: 'codex-subprocess'`、`external: 'node'`）打包入口并输出为 `hooks/uapa-codex.mjs`。`codex-subprocess.ts` 实现 `SubprocessProtocol`：工具名取 stdin `tool_name`；拒绝以退出码 2 结束并在 stderr 写非空原因；改写输出 `permissionDecision: "allow"` 与 `updatedInput`；停机继续输出 `decision: "block"` 与 `reason`；数据目录取 `PLUGIN_DATA`；会话 id 与工具入参的字段名、决策 JSON 的层级取自 TA-15 入口前提的结论，写在协议实现中并注明出处 | ⏳ | |
| `F-06-05` | 字段白名单检查 | `plugin.json` 顶层只含 [Codex「plugin.json 字段」](../research/coding-agent-plugin-manifests/codex-plugins.md#pluginjson-字段) 一节通用字段表列出的字段与 `extensions`；`extensions` 只含 `com.openai`；`com.openai` 只含该节专有字段表中的字段，`interface` 的子字段不超出该表列出的 `interface.*`；hooks 处理器在 TA-15 实测前只写 `type`、`command`；超出时生成失败 | ⏳ | |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
pnpm check
node --test test/targets/codex.test.ts
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `pnpm check` | ⏳ | 无 |
| `node --test test/targets/codex.test.ts` | ⏳ | 无 |

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
