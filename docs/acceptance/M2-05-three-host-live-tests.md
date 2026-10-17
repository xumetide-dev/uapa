# 验收 M2-05：三个宿主的安装与会话实测

> 本文记录 M2-05 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M2-05](../workorders/M2-05-three-host-live-tests.md) |
| 覆盖功能点 | 无（TA-11、TA-12 与 v0.2.0 产物的宿主实测）（取自总览「工单构成」表） |
| 验收日期 | 2026-10-15 |
| 验收结论 | 有条件通过（TA-11 的嵌套会话由脚本以父会话的变量值启动，未在会话的 Bash 中启动；agy 的 `agents.json` 格式未能确定） |
| 判断范围 | 夹具与单元测试 + 宿主实测 |
| commit | `7bff5c2`、`4910146`、`fca0d18` |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | 三个宿主中拒绝的标记命令都不执行（宿主实测，§1 第 1 行）；本单发现的 `/branch`、`/resume` 去重缺陷使守卫执行两次，不放行任何检查，已由 `7bff5c2` 修复；`pnpm check` 247 pass |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | 修复只在打包结果中多出一个顶层函数；18 个夹具的导入检查通过；三个宿主中产物以 Node 直接运行，不安装依赖（宿主实测） |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | 本单不改构建编排；`claude-both` 的覆盖文件只写入 `dist/claude-code/hooks/`，整树比对通过 |
| V4 | 能力数据含无出处的宿主行为 | 否 | 实测结论与能力数据一致，本单不改能力数据；TA-09 在 `pnpm check` 中通过 |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：守卫不静默失效 | 宿主实测：三个宿主中拒绝的标记命令不执行且原因可见；执行后检查扣留含标记的输出，模型读不到原文 | 拒绝：Codex 与 agy 中 `echo uapa-deny-probe > deny.txt` 不执行、`deny.txt` 不存在，原因出现在日志与模型的回复中；Claude Code 的模块与命令入口都拒绝（嵌套会话一项与 `claude plugin test`）。扣留：Claude Code 两种形态与 Codex 中模型只读到扣留原因或替换文本（`uapa-replaced`），读不到原输出。Codex 信任前插件 hooks 被静默跳过，属宿主的信任机制，已写入调研文档 | 调研文档：[Claude Code](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#uapa-夹具产物)、[Codex](../research/coding-agent-plugin-manifests/codex-local-tests.md#容器实测01621)、[agy](../research/coding-agent-plugin-manifests/agy-local-tests.md#uapa-夹具产物135容器)（宿主实测：Claude Code 2.1.296、codex-cli 0.162.1、agy 1.3.5） | ✅ |
| 2 | 硬约束：能力数据有出处 | 实测结论写入调研文档后，能力数据的注释指向该小节；结论与能力数据不一致时先改调研文档再改能力数据，并重跑 TA-09 | 实测结论都写入调研文档；与能力数据一致（Codex `replaceOutput: false` 的替换降级为扣留、agy 不生成执行后检查、三个宿主的 `components.mcp`），能力数据未改；TA-09 通过 | `fca0d18`；`pnpm check` 247 pass | ✅ |

## 2. 功能点逐条验收

本单在总览「工单构成」表中不挂功能点，本节没有条目；交付以 §1 与 §3 判定。各项实测与它关闭的
承接条目：

| 实测项 | 结果 | 关闭的承接条目 |
|---|---|---|
| TA-12：`claude-both` 产物的 `validate --strict` 与 `claude plugin test` | ✅ 容器与维护者机器（macOS）都通过，5 个用例通过（宿主实测，2.1.296） | M1 收口 §4 第 2 行 |
| TA-11：`--resume`、`--fork-session`、交互会话的 `/clear`、`/branch`、`/resume <id>` 之后同一事件只由模块执行 | ✅ 修复后五种情况下变量都等于当前会话 id，没有命令入口的停机计数文件（宿主实测） | M1 收口 §4 第 4 行 |
| TA-11：嵌套会话的命令 hooks 不被误跳过 | ⚠️ 仅以父会话的变量值由脚本启动内层会话：Bash 工具中变量为父会话 id，内层会话的命令入口拒绝标记命令并写出本会话的计数文件；在会话的 Bash 中启动的 `claude -p` 没有令牌，未登录 | M1 收口 §4 第 4 行（部分） |
| Codex：安装 `full`、信任 hooks 后拒绝的标记命令不执行且原因可见 | ✅ 改写与停机继续同样生效（宿主实测，0.162.1） | M1 收口 §4 第 3 行 |
| `after-tool`：Claude Code 两种形态与 Codex 的扣留与替换 | ✅（宿主实测） | M2-02 §7 第 1 行 |
| `components`：Claude Code 与 agy 列出 agents | ✅ Claude Code 列出 `components:reviewer`，agy 列出 `agy-helper` 与 `reviewer`（宿主实测） | M2-03 §7 第 1 行 |
| `components`：三个宿主加载 MCP 服务器，跳过的服务器不出现 | ✅（宿主实测） | M2-04 §7 第 1 行 |
| Codex 与 agy 按插件目录解析 `./mcp/server.mjs` | ✅ 桩服务器的工作目录都为安装后的插件目录（宿主实测） | M2-04 §7 第 2 行 |
| Codex：manifest 写 `"mcpServers": {}` 时不加载 `.mcp.json` | ✅ 与不写该字段的对照插件相比（宿主实测） | M2-01 §7 第 2 行 |
| agy：根 `agents.json` 与 `agents/*.md` 并存 | ⚠️ `agents/*.md` 照常加载；三种 `agents.json` 写法都未使其声明的子代理出现，格式未能确定 | M2-01 §7 第 1 行（部分） |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
pnpm check
node --test test/fixtures/fixtures.test.ts
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `pnpm check` | 容器内 `test/container/run.sh check`：tsc 与 Biome 通过，247 pass / 0 fail；功能清单检查“✓ 93 个功能，18 条用户故事，20 项技术验收，关系检查通过” | 无 |
| `node --test test/fixtures/fixtures.test.ts` | 容器内 18 pass / 0 fail | 无 |
| 宿主实测（容器 `shell`） | Claude Code、Codex 与 agy 的各项见 §2 的表，记录写入三份调研文档 | Claude Code 2.1.296、codex-cli 0.162.1、agy 1.3.5；Codex CLI 经维护者确认后使用；交互会话以 tmux 驱动 |
| 维护者机器 | macOS（arm64）的 Claude Code 2.1.296：`validate --strict` 通过，`claude plugin test` 5 pass / 0 fail，两者退出码 0 | 对 `claude-both` 的 Claude Code 产物运行 `claude plugin validate --strict` 与 `claude plugin test` |

## 4. 交付物

- 修复（`7bff5c2`）：`src/runtime/entries/claude-code-in-process.ts` 在 `classic.SessionStart` 中
  优先写 `e.session_id`；`test/runtime/in-process.test.ts` 新增用例；含去重变量的五个夹具产物重新
  打包；F-05-08 与调研文档同步。
- TA-12（`4910146`）：`test/fixtures/claude-both/source/overrides/claude-code/hooks/guard.test.ts`
  与期望产物；`package.json` 的测试 glob 与 `tsconfig.json` 的排除项。
- 调研文档（`fca0d18`）：`claude-code-local-tests.md`「双形态去重的会话实测」「UAPA 夹具产物」、
  `codex-plugins.md`「容器实测（0.162.1）」、`agy-plugins.md`「UAPA 夹具产物（1.3.5，容器）」、
  `codex-source-review.md` 的 `{}` 一行。

## 5. 与计划的偏差

- 修改了 `src/runtime/`（施工单的允许范围不含）：实测发现 `/branch` 与 `/resume` 之后
  `classic.SessionStart` 中的 `$.session.id()` 仍为旧会话 id，去重失效、守卫执行两次；修复后
  `after-tool`、`claude-both`、`command-hooks`、`full`、`merged` 五个夹具的 `uapa-guard.mjs` 多出
  `startedSessionId`，属于施工单红线之外的期望产物变化。
- 修改了 `package.json` 与 `tsconfig.json`：`claude-both` 的覆盖文件 `guard.test.ts` 会被
  `node --test "test/**/*.test.ts"` 收集并被 tsc 检查，它引入的 `claude-code/testing` 在仓库中
  不能解析；测试 glob 改为 `test/*.test.ts` 与 `test/*/*.test.ts`，测试总数不变（246 加修复的
  1 个用例为 247）。
- TA-12 的测试文件另加一例改写，共 5 例（施工单要求拒绝、放行、停机继续与提示阻断各一例）。
- Codex 的信任经 TUI 启动时的 “Hooks need review” 对话框写入，没有进入 `/hooks`；写入信任时
  TUI 以命令行覆盖 `requires_openai_auth`，之后的会话以原配置运行。
- 实测用的 MCP 服务器为放入插件副本 `mcp/` 中的桩服务器（与覆盖文件的放置方式相同），夹具的
  源项目未改。

## 6. 技术决策

| 决策 | 依据 | 回填状态 |
|---|---|---|
| `classic.SessionStart` 中以 `e.session_id` 写去重变量，没有时退回 `$.session.id()` | 交互会话实测：`/branch` 与 `/resume <id>` 之后该事件中的 `$.session.id()` 为切换前的会话 id，`e.session_id` 为新 id；`/clear` 之后两者相同；之后的 `prompt.submit` 中 `$.session.id()` 已为新 id | 已写入 F-05-08、`uapa-hook-adapters.md` 与 Mods 指南；原文“这三个命令之后的会话 id 与去重效果未实测”已替换 |
| 仓库测试只收集 `test/` 下两层的 `*.test.ts` | 夹具中原样复制进产物的测试面向宿主的测试工具，不属于仓库测试 | `package.json` 的 `check` 脚本 |

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|
| 1 | TA-11 的嵌套会话未在会话的 Bash 中启动：Bash 工具启动的 `claude -p` 没有容器中以环境变量提供的令牌 | 以父会话的变量值由脚本启动内层会话，与 Bash 工具中测得的变量值相同；其他继承的环境变量对命令 hooks 的影响未覆盖 | Sprint M2 收口 §4：可在以钥匙串登录的维护者机器上运行 |
| 2 | agy 根 `agents.json` 的格式未能确定 | UAPA 不生成该文件；覆盖文件写入它时 `agents/*.md` 仍加载，它声明的子代理是否加载未知 | Sprint M2 收口 §4：agy 文档给出格式后再测 |
| 3 | 用户文档未写明 Codex 中安装后须信任插件的 hooks，信任前 hooks 被静默跳过 | 使用者安装后守卫不生效而没有提示 | [M2-06](../workorders/M2-06-release-v0-2-0.md) 任务 2：README 写明信任步骤 |

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- Codex 的扣留一例中模型回复的标记与扣留原因中的标记相同，单看回复不能区分；替换一例中模型
  回复 `uapa-replaced`，说明模型读到的是 hook 的原因而不是原输出。
- 实测会话中停机门禁要求“先运行测试”，模型会尝试运行测试命令；容器中无害，在宿主机上实测停机
  门禁须限制工具（`AGENTS.md`）。
- 下一张：M2-06（发布 v0.2.0），创建与推送 tag 须维护者确认。
