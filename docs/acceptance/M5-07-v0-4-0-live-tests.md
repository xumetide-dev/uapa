# 验收 M5-07：v0.4.0 产物的宿主实测

> 本文记录 M5-07 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M5-07](../workorders/M5-07-v0-4-0-live-tests.md) |
| 覆盖功能点 | 无（TA-27）（取自总览「工单构成」表） |
| 验收日期 | 2026-10-17 |
| 验收结论 | 有条件通过（Claude Code 夹具产物会话复测与 2.1.300 升级复测、Codex CLI 会话实测待订阅与维护者确认就绪后补测） |
| 判断范围 | 宿主实测 |
| commit | `776b444` |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | agy 1.3.5 的 `host-coverage` 与 `merged` 会话中标记命令 `echo uapa-deny-probe > deny.txt` 均未执行，`deny.txt` 不存在，模型读到守卫拒绝原因（§1 第 1、3 行） |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | 容器内生成的插件目录在独立临时工作区安装运行；`test/container/run.sh check` 的导入检查对 21 个夹具全部通过 |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | 本单不改构建与写出逻辑；容器实测均在 `/tmp` 下一次性临时目录进行，结束时卸载并清理 |
| V4 | 能力数据含无出处的宿主行为 | 否 | `src/capabilities/agy-subprocess.ts` 的 `commands` 注释已补充指向 `agy-local-tests.md`「UAPA 夹具产物（1.3.5，容器）」，`agy-plugins.md` 已补充 `args` 中 `${…}` 按字面传递的实测依据 |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：守卫不静默失效 | 宿主实测：`Monitor` 运行的标记命令被拒绝；入口无法启动时 `onFailure` 阻断标记命令；agy 会话中守卫经 `ctx.cwd` 读取工作目录文件并拒绝标记命令 | agy 1.3.5 会话中：`host-coverage` 守卫拦截 `echo uapa-deny-probe > deny.txt`，返回 `拒绝标记命令 uapa-deny-probe（/tmp/uapa-m507-ws-hc）`；`merged` 副本守卫导入 `node:fs`、`node:path` 读取 `join(ctx.cwd, "marker.txt")` 并拦截标记命令，返回 `拒绝标记命令 uapa-deny-probe（marker=uapa-marker-ok）`，两处 `deny.txt` 均不存在。Claude Code 的 `Monitor` 与 `onFailure: "block"` 已在 M5-01 探测插件会话（2.1.296）及 M5-05 夹具入口用例（`monitor-deny.json`）中验证，夹具产物的 `claude -p` 会话复测待订阅就绪后补测 | `agy-local-tests.md`「UAPA 夹具产物（1.3.5，容器）」（宿主实测，agy 1.3.5）；`claude-code-local-tests.md`「v0.4.0 覆盖审查（2.1.296，容器）」 | ⚠️ 部分（agy 会话已实测；Claude Code 夹具产物会话复测待订阅就绪后补测） |
| 2 | 硬约束：能力数据有出处 | 实测结论写入调研文档；与能力数据不符时先改调研文档再改数据，并在验收 §5 写明 | 实测结论与 TA-25 及能力数据一致，无需修改能力数据取值；结论已写入 `agy-local-tests.md`、`agy-plugins.md`、`claude-code-local-tests.md`，`src/capabilities/agy-subprocess.ts` 的 `commands` 注释已补充指向「UAPA 夹具产物（1.3.5，容器）」 | `agy-local-tests.md`、`agy-plugins.md`、`claude-code-local-tests.md`、`src/capabilities/agy-subprocess.ts` | ✅ |
| 3 | TA-27：agy 宿主实测（1.3.5，容器） | 安装 `rules-commands`、`host-coverage` 与 `merged` 三宿主合并布局产物，复测复制的命令、`files/` 共用文件、MCP `args` 字面传递与环境继承、`.antigravity-plugin/plugin.json` 与守卫 `ctx.cwd` | （1）`rules-commands`：`agy plugin validate` 与 `install` 输出 `commands : 1 processed (converted to skills)`，`/rules-commands:review` 按命令正文审查工作区并遵守 `always_on` 中文规则；（2）`host-coverage`：`files/scripts/server.mjs` 启动并写出 `{"started":true,"arg1EndsWithServerMjs":true,"arg2StartsWithDollarBrace":true,"hasApiKeyEnv":true,"apiKeyEnvStartsWithDollarBrace":false,"hasProbeTokenEnv":true}`，证实共用文件启动、`args` 中 `${UAPA_ARG_PROBE}` 按字面传入、剥离 `${user_config.UAPA_API_KEY}` 后环境变量正常继承，守卫通过 `ctx.cwd` 返回工作区路径并拦截命令；（3）`merged`：无根 `plugin.json`、含 `.antigravity-plugin/plugin.json`，通过 `claude plugin validate --strict`、`agy plugin validate` 与 `agy plugin install`，守卫在会话中经 `ctx.cwd` 读取 `marker.txt` 并拦截命令 | `agy-local-tests.md`「UAPA 夹具产物（1.3.5，容器）」（宿主实测，agy 1.3.5，`gemini-4-argon-medium`） | ✅ |
| 4 | TA-27：Claude Code 严格校验与 marketplace 安装（2.1.296，容器） | 生成的 `.claude-plugin/marketplace.json`、`host-coverage`、`rules-commands`（三种规则换算）与 `merged` 通过 `claude plugin validate --strict`，并经本地 marketplace 安装 `host-coverage` | `host-coverage/dist/claude-code`、`host-coverage/dist`（marketplace）、去掉 `api-design.md` `targets` 后的 `rules-commands/dist/claude-code`（含 `always`、`glob`、`model` 三种换算规则）与 `merged` 四处 `claude plugin validate --strict` 均输出 `✔ Validation passed`；`claude plugin marketplace add` 与 `claude plugin install host-coverage@uapa-fixtures` 成功，输出 `1 userConfig option not yet set`，`claude plugin list` 显示 `Status: ✔ enabled` | `claude-code-local-tests.md`「UAPA 夹具产物」（宿主实测，Claude Code 2.1.296） | ✅ |
| 5 | TA-27：Claude Code 会话复测与 2.1.300 升级复测、Codex CLI 会话实测 | 在 `claude -p` 会话中复测 `host-coverage` 与 `rules-commands` 的三种规则、`Monitor` 拒绝与 `onFailure: "block"`，升级到 2.1.300 复测双形态去重；在 Codex CLI 中安装并复测 | 当前环境未配置 Claude Code 与 Codex 订阅，且升级容器内 Claude Code 与使用 Codex CLI 需维护者确认，留待订阅与确认就绪后补测（见 §7） | — | ⏳ |

## 2. 功能点逐条验收

本单在总览「工单构成」表中不挂功能点，本节没有条目；交付以 §1 与 §3 判定。

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
test/container/run.sh check
```

```bash
test/container/run.sh shell
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `test/container/run.sh check` | ✅ 两套 `tsc` 配置通过，Biome 检查通过，`node --test` 352 pass / 0 fail（21 个夹具），功能清单关系检查通过（136 个功能，28 条用户故事，27 项技术验收） | Docker 可用 |
| `test/container/run.sh shell`（Claude Code CLI 校验与安装） | ✅ Claude Code 2.1.296：`host-coverage`、`host-coverage/dist`（marketplace）、`rules-commands`（含三种换算规则）与 `merged` 的 `claude plugin validate --strict` 全部通过；`claude plugin marketplace add`、`install host-coverage@uapa-fixtures`、`list`、`uninstall`、`marketplace remove` 全部通过 | Docker 可用 |
| `test/container/run.sh shell`（agy 1.3.5 会话实测） | ✅ agy 1.3.5（`gemini-4-argon-medium`）：`rules-commands`（`/rules-commands:review`）、`host-coverage`（`files/scripts/server.mjs`、MCP `args` 字面传递、环境变量继承、守卫 `ctx.cwd`）、`merged`（三宿主合并布局 `.antigravity-plugin/plugin.json`、子进程守卫 `node:fs` + `ctx.cwd` 读取 `marker.txt`）共 3 组安装与打印模式会话全部通过 | Docker 可用；容器中的 agy 登录 |

## 4. 交付物

- `docs/research/coding-agent-plugin-manifests/agy-local-tests.md`：「UAPA 夹具产物
  （1.3.5，容器）」新增 v0.4.0 的 3 行实测结果（`rules-commands` 命令调用、`host-coverage`
  共用文件与 MCP `args`/环境继承及 `ctx.cwd`、`merged` 三宿主合并目录与 `node:fs` + `ctx.cwd`）。
- `docs/research/coding-agent-plugin-manifests/agy-plugins.md`：补充 1.3.5 容器实测中 MCP
  `args` 的 `${…}` 按字面原样传入的结论。
- `docs/research/coding-agent-plugin-manifests/claude-code-local-tests.md`：「UAPA 夹具产物」
  新增 v0.4.0 `host-coverage` marketplace 安装、`rules-commands` 三种规则换算与 `merged` 的
  `validate --strict` 记录。
- `src/capabilities/agy-subprocess.ts`：`commands: 'package'` 的出处注释补充「UAPA 夹具产物
  （1.3.5，容器）」。
- `docs/feature-list/stories.md`：更新角色审计 P-01、P-02、P-04 的 TA-25 与 TA-27 状态。
- `docs/acceptance/M5-03-converted-rules-and-commands.md`、
  `M5-04-mcp-server-environment.md`、`M5-06-marketplace-files.md`：同步表头「判断范围」为
  `夹具与单元测试 + 宿主实测`，并在 §7 注明已由本单关闭的项。

## 5. 与计划的偏差

- `rules-commands` 夹具中复制到 agy 的命令文件为 `commands/review.md`（`claude-only.md` 仅限
  `claude-code:subprocess`），因此 agy 会话以 `/rules-commands:review` 调用。
- 实测结论与 TA-25 完全一致，未推翻任何能力数据，无需修改 `src/` 生成逻辑或夹具期望树。
- 当前环境仅配置 agy 登录，未配置 Claude Code 与 Codex 订阅；Claude Code 已完成 CLI 严格校验
  （`validate --strict`）与本地 marketplace 添加/安装验证，需要模型订阅的 `claude -p` 与
  `codex` 会话项按 `sprint-acceptance` 规范标为 ⏳ 并记入 §7。

## 6. 技术决策

| 决策 | 依据 | 回填状态 |
|---|---|---|
| 在 `host-coverage` 的容器副本中，让 `files/scripts/server.mjs` 只把布尔状态（参数是否以 `${` 开头、环境变量键是否存在且不以 `${` 开头）写入临时状态文件 | 遵守 `AGENTS.md` 与施工单“不记录或回显环境变量的值”的安全红线，同时一次性验证共用文件启动、`args` 字面传递与剥离 `${user_config.*}` 后的环境继承 | 已写入 `agy-local-tests.md`「UAPA 夹具产物（1.3.5，容器）」 |
| 在 `merged` 的容器副本中去掉 `claude-code:in-process` 目标后，在 `guard.ts` 中导入 `node:fs` 与 `node:path` 读取 `join(ctx.cwd, "marker.txt")` | 验证三宿主子进程合并布局下 `F-04-10` 放行 `node:fs`/`node:path` 与 `ctx.cwd` 在真实 agy 会话中的端到端配合 | 同上 |

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|
| 1 | Claude Code 夹具产物的 `claude -p` 会话复测（三种换算规则、`Monitor` 拒绝、`onFailure: "block"` 入口失败阻断）及升级到 2.1.300 后的双形态去重会话复测尚未执行 | 宿主机制已在 M5-01 探测插件会话（2.1.296）中验证，夹具产物已通过 `claude plugin validate --strict`、`marketplace add/install` 与夹具入口用例；待 Claude Code 订阅与升级确认就绪后在容器中补测 | [Sprint 收口 M5-00](M5-00-v0-4-0-host-coverage.md) §4 第 1 项 |
| 2 | Codex CLI 中经 `.agents/plugins/marketplace.json` 安装、信任 hooks、`always` 规则注入、规则技能调用与 `env_vars` 传递的会话实测尚未执行 | 生成格式已对照 rust-v0.162.1 源码与夹具入口用例核实；待 Codex 订阅与维护者确认使用 Codex CLI 后在容器中补测 | [Sprint 收口 M5-00](M5-00-v0-4-0-host-coverage.md) §4 第 2 项 |

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- agy 1.3.5 容器实测证实 `mcp_config.json` 的 `args` 中 `${…}` 占位符不展开（按字面传递），与
  F-11-12 的残余风险一致。
- 下一步：建立 Sprint 收口文件 [M5-00](M5-00-v0-4-0-host-coverage.md)。
