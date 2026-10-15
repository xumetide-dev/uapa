# 验收 M3-03：Codex 提示阻断与 hook 出错、超时

> 本文记录 M3-03 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M3-03](../workorders/M3-03-codex-prompt-gate-hook-failures.md) |
| 覆盖功能点 | 无（TA-15 的宿主实测）（取自总览「工单构成」表） |
| 验收日期 | 2026-10-15 |
| 验收结论 | 通过 |
| 判断范围 | 宿主实测 |
| commit | `671d4f6` |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | hook 出错与超时时 Codex 放行（宿主实测），`full` 的构建报告为 `codex:subprocess` 列出“缺少 Node ≥ 22 或入口无法启动时 … 不生效（宿主在 hook 出错时放行）”三条残余风险；守卫出错由入口以退出码 2 拒绝，不经宿主的失败处理 |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | 本单未改产物；`fixtures.test.ts` 的导入检查通过（247 pass） |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | 本单未改构建；整树比对由 `fixtures.test.ts` 覆盖（247 pass） |
| V4 | 能力数据含无出处的宿主行为 | 否 | `promptGate` 与 `failureDefault` 的注释指向本单的实测 |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：守卫不静默失效 | 宿主实测：`full` 的提示阻断不调用模型且原因可见；hook 出错与超时时的处理与构建报告的残余风险一致 | 含 `API_KEY=uapa-prompt-probe` 的提示：只有 `turn.started` 与 `turn.completed`，输入与输出 token 为 0；exec 输出 `hook: UserPromptSubmit Blocked`，TUI 显示 `Blocked by hook` 与原因 `提示中含疑似密钥`；对照提示得到模型回复。探测插件以 1 退出、超时：四个事件都放行，命令执行、提示送达、工具输出保留、本轮结束，与“宿主在 hook 出错时放行”的残余风险一致 | [Codex「容器实测（0.162.1）」](../research/coding-agent-plugin-manifests/codex-plugins.md#容器实测01621)（宿主实测，codex-cli 0.162.1） | ✅ |
| 2 | 硬约束：能力数据有出处 | `codex-subprocess.ts` 的 `promptGate` 与 `failureDefault` 注释指向本单的实测小节；取值改动时重跑 TA-09 与夹具比对 | `promptGate` 注释加“0.162.1 容器实测”，`failureDefault` 注释写明退出码 1、超时与工具事件的无效输出已实测并指向「容器实测（0.162.1）」；取值未改，TA-09 与夹具比对照常通过 | `671d4f6`；`pnpm check` 247 pass | ✅ |

## 2. 功能点逐条验收

本单在总览「工单构成」表中不挂功能点，本节没有条目；交付以 §1 与 §3 判定。

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
pnpm check
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `pnpm check` | 容器内 `test/container/run.sh check`：tsc 与 Biome 通过（182 个文件），247 pass / 0 fail；“93 个功能，18 条用户故事，20 项技术验收，关系检查通过” | 无 |
| 宿主实测（容器 `shell`） | 提示阻断见 §1 第 1 行。探测插件：正常模式四个 hook 各运行一次；以 1 退出、超时、`PreToolUse` 与 `PostToolUse` 输出非 JSON 时，`probe.txt` 写入、模型回复与之相同、本轮结束；`UserPromptSubmit` 以 0 退出并输出纯文本时两次都在 300 秒内没有调用模型 | codex-cli 0.162.1，容器测试的 provider 配置；每个容器在 TUI 中信任一次 hooks（3 或 4 条 `trusted_hash`），之后只改模式文件；模型服务两次报 “Upstream service temporarily unavailable” 导致对照或超时一轮未完成，重跑后完成 |

## 4. 交付物

- 调研文档 `codex-plugins.md`「容器实测（0.162.1）」：提示阻断、hook 以 1 退出、超时、stdout 不是
  JSON、`UserPromptSubmit` 输出纯文本五行，以及信任后改模式文件不影响信任的说明。
- 能力数据：`codex-subprocess.ts` 的 `promptGate` 与 `failureDefault` 注释。
- 角色审计：P-01 改为 PASS（Claude Code 与 Codex 都已实测可阻断）；P-04 写明三个宿主的 TA-15 各项
  已实测，仍为 RISK（缺少 Node 与停机计数存放位置的残余风险）。

## 5. 与计划的偏差

- 任务 2 的“打印非 JSON 文本”起初对四个事件都输出：`UserPromptSubmit` 以 0 退出并输出纯文本在
  Codex 中是附加上下文而不是失败，两次运行都未调用模型，后续的工具事件没有触发。改为只在
  `PreToolUse` 与 `PostToolUse` 输出非 JSON 后重测；`UserPromptSubmit` 的观察单列一行。

## 6. 技术决策

- 能力数据取值不变：提示阻断与四个事件的失败处理都与 `promptGate: true`、`failureDefault` 全部
  放行一致。
- `codex exec` 不显示提示阻断的原因，只在 TUI 中显示；原因由 UAPA 入口写入 stderr，属宿主的展示
  方式，UAPA 不另做处理。

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|
| — | 无 | — | — |

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- 风险：hook 出错与超时时 Codex 放行，入口无法启动时守卫不生效；已由构建报告的残余风险写明。
- 下一步：M3-03 是 Sprint M3 的最后一张工单，接着做 Sprint 收口。
