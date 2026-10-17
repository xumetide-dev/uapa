# 验收 M5-05：守卫可靠性与残余风险

> 本文记录 M5-05 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M5-05](../workorders/M5-05-guard-reliability-and-risks.md) |
| 覆盖功能点 | `F-05-21`、`F-05-22`、`F-05-23`、`F-06-14`、`F-06-16`、`F-11-14`（取自总览「工单构成」表） |
| 验收日期 | 2026-10-17 |
| 验收结论 | 通过 |
| 判断范围 | 夹具与单元测试 |
| commit | `1f2c616` |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | 配置 `hosts['claude-code'].onFailure: 'block'` 时，`capabilitiesFor` 将 `claude-code:subprocess` 的 `beforeTool` 与 `beforePrompt` 的 `failureDefault` 改为 `{ error: 'deny', timeout: 'deny' }`，并在构建报告写出缺少 Node ≥ 22 时每次工具调用与提示均被阻断的残余风险；未配置时沿用原有能力数据并照常报告残余风险；`Monitor` 工具名换算为 `shell`，入口用例 `monitor-deny.json` 以退出码 2 拒绝标记命令（`run.sh check` 335 pass / 0 fail） |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | 本单未改 `src/runtime/core/` 与 `src/bundle/`；`fixtures.test.ts` 对全部 21 个夹具的产物外部导入检查通过 |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | 本单不改写出模块 `src/build/write.ts`；21 个夹具对运行后整个源项目目录逐字节比对通过 |
| V4 | 能力数据含无出处的宿主行为 | 否 | `src/capabilities/claude-code-subprocess.ts`、`src/capabilities/claude-code-in-process.ts` 与 `src/capabilities/index.ts` 中新增的 `Monitor`、`NotebookEdit` 及 `onFailure: 'block'` 注释均指向 `claude-code-local-tests.md`「v0.4.0 覆盖审查（2.1.296，容器）」与 `claude-code-hooks.md`「失败处理与 onFailure」 |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：守卫不静默失效 | `host-coverage` 的 `hooks.json` 中执行前与提示提交前守卫条目带 `onFailure`；`Monitor` 的入口用例以标记命令得到拒绝；TA-27 在宿主中复测 | `host-coverage` 的 `dist/claude-code/hooks/hooks.json` 中 `PreToolUse` 与 `UserPromptSubmit` 守卫条目均写出 `"onFailure": "block"`；`expected/stdin/claude-code-subprocess/monitor-deny.json` 传入 `tool_name: "Monitor"` 与 `"command": "echo uapa-deny-probe"`，以 `exitCode: 2` 和 `stderr: "拒绝标记命令 uapa-deny-probe\n"` 拒绝；`guard-reliability.test.ts` 8 pass / 0 fail（宿主会话复测由 M5-07 执行） | `test/fixtures/host-coverage/expected/tree/dist/claude-code/hooks/hooks.json`、`test/fixtures/host-coverage/expected/stdin/claude-code-subprocess/monitor-deny.json`、`test/targets/guard-reliability.test.ts` | ✅ |
| 2 | 硬约束：确定性输出 | `command-hooks`、`host-coverage` 夹具逐字节比对 | `fixtures.test.ts` 21 pass / 0 fail，其中 `command-hooks`（Codex `SessionEnd` 写 `"timeout": 3`）与 `host-coverage` 的文件树、stdout、stderr 与入口用例逐字节比对一致 | `test/fixtures/fixtures.test.ts`、`test/fixtures/command-hooks/expected/tree/dist/codex/hooks/hooks.json` | ✅ |
| 3 | 硬约束：能力数据有出处 | `toolNames` 新增项的注释指向 TA-25 的小节 | `claude-code-subprocess.ts` L54–58 与 `claude-code-in-process.ts` L53–57 的注释写明 `claude-code-local-tests.md`「v0.4.0 覆盖审查（2.1.296，容器）」及 `F-05-22`；`src/capabilities/index.ts` L19–21 的注释写明 `claude-code-hooks.md`「失败处理与 onFailure」（2.1.296 容器实测；`F-05-21`） | `src/capabilities/claude-code-subprocess.ts`、`src/capabilities/claude-code-in-process.ts`、`src/capabilities/index.ts` | ✅ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-05-21` | 执行前与提示提交前 hook 出错时阻断 | `hosts['claude-code'].onFailure` 为 `'block'` 时，`hooks/hooks.json` 中 `PreToolUse` 与 `UserPromptSubmit` 的守卫条目写 `onFailure: "block"`，其余守卫条目与声明的命令 hooks 不写；`claude-code:subprocess` 的残余风险把“缺少 Node 时守卫不生效”换为“运行宿主的机器缺少 Node ≥ 22 时，每次工具调用与提示都被阻断”，并写明 Claude Code 2.1.295 之前的版本对该字段的处理未核实；同时配置两种形态时另写明 hooks 模块生效时命令入口仍会运行；只配置 `claude-code:in-process` 时残余风险写明该选项不生效（SD-43） | ✅ | `guard-reliability.test.ts`「onFailure 只写在 PreToolUse 与 UserPromptSubmit 的守卫条目中」「onFailure 的残余风险：只有命令形态、两种形态与只有 hooks 模块」「capabilitiesFor：onFailure 为 block 时执行前与提示提交前检查出错按拒绝处理」；`host-coverage` 夹具的 `hooks/hooks.json` 与 `uapa-report.json` |
| `F-05-22` | 补全工具名换算 | 按 TA-25 实测（2.1.296）修改两个目标的 `toolNames`：`Monitor` 换为 `shell`（入参含 `command`，与 `Bash` 相同，改写写回该字段），`NotebookEdit` 换为 `edit_file`（入参 `notebook_path`、`cell_id`、`new_source`、`edit_mode` 原样传给守卫）；注释指向调研文档（SD-43） | ✅ | `guard-reliability.test.ts`「Monitor 换为 shell，NotebookEdit 换为 edit_file（两个 Claude Code 目标）」；`host-coverage` 入口用例 `monitor-deny.json` 以 `process.execPath` 运行并拒绝标记命令 |
| `F-05-23` | 补全残余风险 | 声明 `SessionEnd` 命令 hook 时写明插件 hooks 的 `timeout` 不提高宿主 1.5 秒的总预算；有执行前检查时写明用户安装的 mod 可以推翻插件 hook 的拒绝，以及 `disableAllHooks`、`--safe-mode`、`--bare` 与托管设置可使插件 hooks 不运行；agent 的 frontmatter 含 `permissionMode`、`hooks`、`mcpServers`、`initialPrompt` 时写明插件 agent 忽略这些键；出处为 Claude Code 文档「hooks」「permissions」「plugins reference」（SD-43） | ✅ | `src/targets/claude-code/risks.ts`；`guard-reliability.test.ts`「Claude Code：SessionEnd 的总预算、mod 与关闭 hooks 的情形、插件 agent 忽略的键」；`source/agents.test.ts` 读取 `frontmatterKeys` |
| `F-06-14` | `SessionEnd` 的超时 | 声明的 `SessionEnd` 命令 hook 写 `timeout: 3`（宿主把更大的值压到 3 秒，并在每次会话开始告警，rust-v0.162.1 `hooks/src/engine/discovery.rs`）；F-06-08 的残余风险改为“Codex 的 `SessionEnd` 超时上限 3 秒”（SD-43） | ✅ | `src/targets/codex/hooks.ts`（`SESSION_END_TIMEOUT_SECONDS = 3`）、`src/targets/codex/risks.ts`；`command-hooks.test.ts` 与 `test/fixtures/command-hooks/expected/tree/dist/codex/hooks/hooks.json` |
| `F-06-16` | 补全残余风险 | 有守卫或声明的命令 hooks 时写明 `allow_managed_hooks_only` 与 `[features].hooks = false` 使插件 hooks 不运行；skill 名超过 64 字符或 `<插件名>:<skill 名>` 超过 129 字符时该 skill 列为跳过；skill 目录内另有 `SKILL.md` 时残余风险写明 Codex 把它注册为另一个技能（rust-v0.162.1 源码，SD-43） | ✅ | `src/targets/codex/skills.ts`、`src/targets/codex/rules.ts`、`src/targets/codex/risks.ts`；`guard-reliability.test.ts`「Codex：技能名超长列为跳过（含规则换算的技能），嵌套的 SKILL.md 写风险」「Codex：没有守卫条目时信任风险不写守卫不生效；有 hooks 时写托管配置的风险」 |
| `F-11-14` | 补全残余风险 | agent 的 frontmatter 含 `tools` 或 `model` 时写明 agy 按自身的工具名与模型名解释，写错的工具名可能使子代理挂起（agy 文档「Custom subagents」）；rule 正文含 `@[` 时写明被引用的文件须经 `files/` 或 `overrides/agy/` 提供，大小上限按展开后计算（agy 文档「Rules」）；有停机前检查时写明宿主在连续继续 10 次后不再采用 `continue`（TA-25，1.3.5；CHANGELOG 1.1.9 称次数可配置）；有执行前检查时写明 `/btw` 不运行用户与工作区的 hooks、插件 hooks 是否运行未实测（CHANGELOG 1.3.3）；插件 agent 的会话中 hooks 照常运行，不写残余风险（TA-25）（SD-43） | ✅ | `src/targets/agy/index.ts`；`guard-reliability.test.ts`「agy：agent 的 tools 与 model、rule 正文中的 @[ 引用」；`agy.test.ts` 与 `host-coverage` 夹具的 `uapa-report.json` |

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
| `test/container/run.sh check` | ✅ 两套 `tsc` 配置与 Biome 通过；`node --test` 335 pass / 0 fail；`check-feature-list.mjs` 129 个功能、27 条用户故事、27 项技术验收关系检查通过 | Docker 可用 |
| `test/container/run.sh exec node --test test/fixtures/fixtures.test.ts` | ✅ 21 pass / 0 fail，含 `command-hooks` 与 `host-coverage`（含 `monitor-deny.json` 入口用例） | Docker 可用 |

## 4. 交付物

- 能力数据：`src/capabilities/claude-code-subprocess.ts` 与 `src/capabilities/claude-code-in-process.ts` 的 `toolNames` 增加 `Monitor: 'shell'`、`NotebookEdit: 'edit_file'`；`src/capabilities/index.ts` 新增 `capabilitiesFor(config)`，在 `hosts['claude-code'].onFailure === 'block'` 时将 `claude-code:subprocess` 的 `beforeTool`、`beforePrompt` 失败默认处理改为 `deny`。
- 源项目读取：`Agent`（`src/source/types.ts`、`src/source/agents.ts`）增加 `frontmatterKeys: readonly string[]`（保序记录 frontmatter 键名）。
- Claude Code 目标：`src/targets/claude-code/hooks.ts` 在 `onFailure: 'block'` 时向 `PreToolUse` 与 `UserPromptSubmit` 守卫条目写 `onFailure: "block"`；残余风险拆入新建的 `src/targets/claude-code/risks.ts`（115 行），补全 `onFailure`、mod、关闭 hooks 的设置、`SessionEnd` 1.5s 预算与插件 agent 忽略键的风险。
- Codex 目标：`src/targets/codex/hooks.ts` 对声明的 `SessionEnd` 命令写 `timeout: 3`；新建 `src/targets/codex/skills.ts`（50 行）与更新 `src/targets/codex/rules.ts` 跳过超过 64/129 字符限制的技能并检查嵌套 `SKILL.md`；更新 `src/targets/codex/risks.ts` 区分有无守卫时的信任风险并增加托管配置风险。
- agy 目标：`src/targets/agy/index.ts` 将 `STOP_COUNTER_RISK` 注释中的宿主版本更新为 1.3.5，新增 `STOP_LIMIT_RISK`（1.3.5 连续继续 10 次上限）、`BTW_RISK`（`/btw` 的 hooks 行为）与 `componentRisks`（检查 agent 的 `tools`/`model` 与 rule 正文中的 `@[` 引用）。
- 测试与夹具：新增 `test/targets/guard-reliability.test.ts`（8 个用例）；更新 `host-coverage` 夹具（加入守卫、`onFailure: 'block'`、含 `tools` 的 `agents/reviewer.md` 与 `monitor-deny.json` 入口用例）及受新增残余风险与 `toolNames` 影响的夹具期望文件。
- 文档：同步 `docs/architecture/module-interfaces.md`、`docs/architecture/host-module-interface.md`、`docs/guide/configuration.md`、`docs/guide/guards.md`、`docs/guide/targets.md`。

## 5. 与计划的偏差

- 为读取 agent frontmatter 中的额外键（如 `tools`、`model`、`permissionMode`、`hooks`）以按 `F-05-23`、`F-11-14` 输出残余风险，`Agent` 接口新增了 `frontmatterKeys: readonly string[]`（`src/source/types.ts`、`src/source/agents.ts`），并在同一提交中同步了 `docs/architecture/module-interfaces.md`。
- 为在 `hosts['claude-code'].onFailure === 'block'` 时让构建编排不再写出“缺少 Node 时检查不生效”的通用残余风险（改由宿主模块写每次都被阻断的后果），`src/capabilities/index.ts` 新增 `capabilitiesFor(config)` 并在 `src/build/index.ts` 调用，同步了 `docs/architecture/module-interfaces.md` 与 `docs/architecture/host-module-interface.md`。
- 含守卫或 hooks 的现有夹具（`after-tool`、`claude-both`、`command-hooks`、`full`、`guard-options`、`in-process-only`、`merged`、`merged-conflict`、`requires-missing`、`rules-commands`、`single-claude`、`throwing-guard`、`verify-failed`）因新增 `toolNames`（打包进 Claude Code 入口 `.mjs`）与新增残余风险条目，同步更新了期望的 `.mjs`、`uapa-report.json` 与 `stdout.txt`。

## 6. 技术决策

| 决策 | 依据 | 回填状态 |
|---|---|---|
| 通过 `capabilitiesFor(config)` 按配置派生 `claude-code:subprocess` 的 `failureDefault`，而非在构建编排中硬编码特判 `onFailure` | 保持构建编排对能力数据只读消费，不耦合具体宿主的选项名 | 已回填 `docs/architecture/module-interfaces.md`、`docs/architecture/host-module-interface.md` |
| 将 Claude Code 的残余风险从 `src/targets/claude-code/index.ts` 拆入 `src/targets/claude-code/risks.ts`，Codex 的技能长度与嵌套检查拆入 `src/targets/codex/skills.ts` | 控制单文件在 200 行内控线以内（拆分后 `claude-code/index.ts` 140 行、`claude-code/risks.ts` 115 行、`codex/skills.ts` 50 行） | 实现即文档 |

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|
| 1 | `onFailure: "block"` 与 `Monitor` 换算后的拒绝尚未在真实宿主会话中端到端复测 | 证据当前来自 M5-01 的探测插件实测与本单夹具入口用例 | [M5-07](../workorders/M5-07-v0-4-0-live-tests.md) 第 1 节 |
| 2 | Codex 的 `SessionEnd` 超时在本单固定为 3 秒，单条命令的自定义 `timeout` 尚未纳入配置 | 需要自定义单条命令超时时须通过 `overrides/<宿主>/` 提供 | [范围决策 SD-44](../feature-list/scope-decisions.md) |

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- `hosts['claude-code'].onFailure: 'block'` 仅在用户显式配置时启用，默认配置不写该字段，避免在缺少 Node ≥ 22 的机器上默认阻断所有工具调用与提示。
- 下一步：实施 M5-06（marketplace 文件生成与 `--check` 比对）。
