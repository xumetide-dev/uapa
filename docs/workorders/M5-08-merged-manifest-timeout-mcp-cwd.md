# 施工单 M5-08：合并布局 manifest、命令超时、MCP 目标过滤与守卫工作目录

> 补齐多宿主合并布局与插件迁移中暴露的四项跨宿主兼容能力（SD-47～SD-50）：
> - agy 支持 `hosts.agy.manifest`（默认布局写 `plugin.json`，合并布局写 `.antigravity-plugin/plugin.json`），三宿主合并布局不再触发 Codex 根 `plugin.json` 优先遮蔽；`dir: '.'` 时源项目 `rules/<name>.md` 计入原位组件保护。
> - `CommandHookDecl` 支持单条命令可选 `timeout`（正整数，单位秒）；Codex `SessionEnd` 写 `Math.min(hook.timeout ?? 30, 3)`。
> - `mcp/servers.json` 支持服务器级可选 `targets`；本地服务器 `env` 含 `${user_config.<KEY>}` 时，Codex 与 agy 从生成的 `env` 中剥离该键并记残余风险，Codex 将整值匹配的 `<KEY>` 并入 `env_vars`。
> - `GuardContext` 增加 `readonly cwd: string | null`，子进程入口从宿主 stdin 提取当前会话工作目录；子进程守卫可静态导入 `node:` 内置模块配合 `ctx.cwd` 读取工作区文件。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M5-00](M5-00-v0-4-0-host-coverage.md) |
| 覆盖功能点 | `F-01-15`、`F-02-06`、`F-03-20`、`F-04-10`、`F-05-27`、`F-06-17`、`F-11-15` |
| 依赖工单 | [M5-03](M5-03-converted-rules-and-commands.md)、[M5-04](M5-04-mcp-server-environment.md)、[M5-05](M5-05-guard-reliability-and-risks.md) |
| 关联 issue | 无 |
| 验收文件 | [M5-08](../acceptance/M5-08-merged-manifest-timeout-mcp-cwd.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 已有且够用：
  - `src/bundle/index.ts` 在 `external: 'node'` 时已保留 `node:` 内置模块，`external: 'claude-code'` 时已拒绝 `node:` 导入（F-04-06、F-04-07）。
  - `src/targets/codex/hooks.ts` 已有 `SessionEnd` 固定写 `3` 秒并由 `src/targets/codex/risks.ts` 报告截断残余风险（F-06-14）。
  - `src/targets/codex/mcp.ts` 与 `src/targets/agy/mcp.ts` 已处理 `envVars` 与 `${` 字面传递残余风险（F-06-12、F-11-12）。
- 已有但不对：
  - `src/targets/agy/index.ts` 固定写根 `plugin.json`，合并布局中与 Codex 根 `plugin.json` 优先规则冲突（Codex 读到根 `plugin.json` 时忽略 `.codex-plugin/plugin.json` 且不加载任何 hooks）；且与 Claude Code 共用目录时仍写“安装转换未实测”残余风险。
  - `src/build/placement.ts` 在 `dir: '.'` 时只把 `skills/`、`agents/`、`commands/` 计入原位组件保护，漏掉源项目的 `rules/<name>.md`，三宿主写入 `dir: '.'` 时 agy 生成的 `rules/<name>.md` 会覆盖源码规则文件。
  - `CommandHookDecl`（`src/config/types.ts`）无 `timeout` 字段，三个宿主模块的命令 hooks 统一写 `hookTimeoutSeconds`（30 秒），Codex `SessionEnd` 无条件写 3 秒并报截断风险。
  - `McpServer`（`src/source/types.ts`）无 `targets` 字段；Codex 与 agy 把含 `${user_config.<KEY>}` 的 `env` 项原样写出，以字面量覆盖会话环境中的同名变量。
  - `GuardContext`（`src/runtime/core/types.ts`）只有 `options`，子进程入口的 `parse` 未提取宿主 stdin 中的工作目录。
- 宿主事实（2026-10-17 容器实测核实）：
  - agy 1.3.5：[agy 实测记录「替代 manifest 位置与合并目录」](../research/coding-agent-plugin-manifests/agy-local-tests.md#替代-manifest-位置与合并目录135容器)确认仅含 `.antigravity-plugin/plugin.json`（无根 `plugin.json`）的独立目录与三宿主合并目录均通过 `agy plugin validate`、`claude plugin validate --strict`，`agy plugin install` 以 `source: "antigravity"` 安装全部组件，`agy -p` 会话中 `PreToolUse` 的 `stdin.workspacePaths[0]` 为当前工作目录。
  - Claude Code 2.1.296 与 Codex rust-v0.162.1：子进程 hook 的 stdin 顶层含 `cwd`；Claude Code hooks 模块（`in-process`）的事件对象 `e` 不含工作目录。

## ⚠️ 关键落地约束（必须先验证）

- **默认布局向后兼容**：省略 `hosts.agy.manifest` 时，默认布局（`sharedWith` 为空）仍写根 `plugin.json`，现有默认布局夹具（`full`、`throwing-guard`、`after-tool`、`components`、`rules-commands`、`guard-options`、`command-hooks`）与 TA-08 的 `dist/agy/plugin.json` 断言保持不变；合并布局（`sharedWith` 非空）默认写 `.antigravity-plugin/plugin.json`。
- **原位规则文件保护**：`dir: '.'` 时，源项目的 `rules/<name>.md` 必须与 `skills/`、`agents/`、`commands/` 一并计入 `src/build/components.ts` 的 `componentPaths`，防止 agy 生成的 `rules/<name>.md` 覆盖源项目规则文件。
- **Codex `mcpServers: {}` 遮蔽**：合并布局下，若 Codex 因承载限制跳过或因 `targets` 过滤排除而无写出服务器，但源项目有 MCP 服务器（`plan.mcpServers.length > 0` 或 `input.hasMcpServers === true`），Codex manifest 仍须写 `"mcpServers": {}`，防止 Codex 回退读取 Claude Code 的 `.mcp.json`。
- **单文件与单函数行数红线**：修改 `src/config/validate.ts`、`src/source/mcp.ts`、`src/targets/codex/mcp.ts`、`src/targets/agy/mcp.ts`、`src/build/components.ts` 等文件前先检查行数与函数长度，单文件控制在 200 行以内（硬上限 500 行），单函数 ≤ 30 行。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 是 | 子进程入口 `parse` 在 `cwd` 缺失、非字符串或空串时静默退化为 `null`，不改变必选字段校验；守卫在子进程入口读取 `ctx.cwd` 与 `node:fs` 抛错时仍按异常收口拒绝执行前检查（单元测试与 `host-coverage` 入口用例） |
| 产物零依赖 | 是 | TA-01 与 `bundle` 单元测试验证子进程入口打包守卫中的 `node:fs`、`node:path` 时只保留 `node:` 内置模块，不引入 npm 包；`claude-code:in-process` 导入 `node:` 时打包失败 |
| 不在运行时推断宿主 | 是 | 各子进程入口分别在自身 `parse` 中按固定字段（Claude Code 与 Codex 取 `cwd`，agy 取 `workspacePaths[0]`）提取工作目录，不读取其他宿主的字段或环境变量（TA-05 与入口单元测试） |
| 确定性输出 | 是 | `merged`、`command-hooks`、`host-coverage` 夹具在临时目录中构建并逐字节比对（TA-06、TA-26） |
| 不越权写入 | 是 | `dir: '.'` 且源项目含 `rules/` 时，`agy:subprocess` 生成 `rules/<name>.md` 按同路径冲突失败，不覆盖源项目文件（`test/build/components.test.ts` 单元测试） |
| 安装不运行脚本 | 否 | 不改 `package.json` |
| 能力数据有出处 | 否 | 不改 `src/capabilities/` 的能力布尔值；宿主行为出处已记入 `agy-local-tests.md`、`claude-code-local-tests.md` 与 `uapa-hook-adapters.md` |

## 任务

### 1. 配置、MCP 读取与守卫公共类型（`src/config/`、`src/source/`、`src/runtime/core/`）

- `src/config/types.ts`、`src/config/validate.ts`、`src/config/command-hooks.ts`（F-01-15）：
  - `CommandHookDecl` 增加 `readonly timeout?: number`，校验为正整数（`Number.isInteger(n) && n >= 1`），违反时返回 `InputIssue`（`field: 'commandHooks[i].timeout'`）。
  - `hosts.agy` 增加 `readonly manifest?: 'plugin.json' | '.antigravity-plugin/plugin.json'`，校验取值。
- `src/source/types.ts`、`src/source/mcp.ts`、`src/source/mcp-fields.ts`（F-01-15）：
  - `McpServer` 增加 `readonly targets: readonly TargetName[] | null`，按 F-01-05 规则校验 `targets`（非空、不重复、只含已登记的目标名），违反时返回 `InputIssue`（`field: 'mcpServers.<name>.targets...'`）。
- `src/runtime/core/types.ts`、`src/runtime/core/options.ts`（F-02-06、F-04-10）：
  - `GuardContext` 增加 `readonly cwd: string | null`。
  - `guardContext(result: OptionsResult, cwd: string | null = null): Checked<GuardContext>` 把 `cwd` 写入返回的 `GuardContext`。

### 2. 构建编排与子进程入口（`src/build/`、`src/targets/types.ts`、`src/runtime/entries/`）

- `src/build/plan.ts`（F-03-20）：
  - `planMcpServers` 按 `server.targets` 筛选进入 `TargetPlan.mcpServers` 的服务器：写了 `targets` 且不含本目标时不进入 `TargetPlan.mcpServers`，也不记入 `skipped`；写了 `targets` 且含本目标而本目标 `components.mcp === 'none'` 时本目标失败。
- `src/build/components.ts`（F-03-20）：
  - `componentPaths` 在插件目录为源项目根目录（`dir === root`）时，除 `skills/`、`agents/`、`commands/` 外一并加入 `source.rules` 的 `rules/<name>.md`，使生成同路径文件时按同路径冲突失败。
- `src/targets/types.ts`、`src/build/generate.ts`（F-06-17）：
  - `HostInput` 增加 `readonly hasMcpServers?: boolean`，`hostInput` 传入 `build.source.mcpServers.length > 0`。
- `src/runtime/entries/subprocess.ts`、`claude-code-subprocess.ts`、`codex-subprocess.ts`、`agy-subprocess.ts`、`claude-code-in-process.ts`（F-04-10、F-05-27、F-06-17、F-11-15）：
  - `HostEvent` 增加 `readonly cwd?: string | null`。
  - `claude-code-subprocess.ts` 与 `codex-subprocess.ts` 从 `stdin.cwd` 提取非空字符串，否则为 `null`；`agy-subprocess.ts` 从 `stdin.workspacePaths[0]` 提取非空字符串，否则为 `null`。
  - `subprocess.ts` 以 `guardContext(optionsResult, event.cwd ?? null)` 构造 `GuardContext`；`claude-code-in-process.ts` 以 `guardContext(optionsResult, null)` 构造（`cwd` 为 `null`）。

### 3. 三个宿主模块（`src/targets/claude-code/`、`src/targets/codex/`、`src/targets/agy/`）

- 命令 hooks 单条超时（F-05-27、F-06-17、F-11-15）：
  - Claude Code 与 agy 的命令 hooks 条目写 `hook.timeout ?? capabilities.hookTimeoutSeconds`。
  - Codex 的非 `SessionEnd` 命令 hooks 写 `hook.timeout ?? capabilities.hookTimeoutSeconds`；`SessionEnd` 写 `Math.min(hook.timeout ?? 30, 3)`，仅在省略 `timeout` 或 `hook.timeout > 3` 时报告 3 秒截断残余风险，`hook.timeout <= 3` 时按原值写出且不报该残余风险。
- MCP `${user_config.<KEY>}` 剥离与 Codex 遮蔽（F-06-17、F-11-15）：
  - Claude Code 原样保留 `env` 中的 `${user_config.<KEY>}`。
  - Codex 与 agy 在生成本地服务器时，从 `env` 中剥离值含 `${user_config.` 的键（剥离后为空对象时省略 `env`；`{pluginRoot}` 换算与 `${` 字面传递残余风险只按保留的键计算），写残余风险列出已剥离的键；Codex 对整值匹配 `^\$\{user_config\.([A-Za-z_][A-Za-z0-9_]*)\}$` 的项把 `<KEY>` 并入 `env_vars`（去重）。
  - Codex 在 `sharedWith` 非空且本目标无写出服务器时，若 `plan.mcpServers.length > 0` 或 `input.hasMcpServers === true`，manifest 仍写 `"mcpServers": {}`。
- agy 的 manifest 位置与合并布局残余风险（F-11-15）：
  - `manifestPath = input.config.hosts?.agy?.manifest ?? (input.sharedWith.length > 0 ? '.antigravity-plugin/plugin.json' : 'plugin.json')`。
  - 移除与 Claude Code 共用目录时“安装转换未实测”的残余风险；与 Codex 共用目录且 `manifestPath === 'plugin.json'` 时由 `src/targets/agy/risks.ts` 写残余风险说明 Codex 优先读取根 `plugin.json` 而不加载任何 hooks。

### 4. 夹具与帮助文档（`test/fixtures/`、`docs/guide/`）

- `test/fixtures/merged/`：在 `hosts` 中加入 `agy: { dir: '.' }`，验证三宿主合并布局写出 `.antigravity-plugin/plugin.json` 与根 `hooks.json`。
- `test/fixtures/command-hooks/`：为一条命令声明自定义 `timeout: 10`，更新期望产物。
- `test/fixtures/host-coverage/`：覆盖命令 hooks 自定义 `timeout`、MCP `targets` 与 `${user_config.<KEY>}`、子进程守卫读取 `ctx.cwd`。
- `docs/guide/configuration.md`、`docs/guide/guards.md`、`docs/guide/command-hooks.md`、`docs/guide/source-project.md`、`docs/guide/targets.md`：同步 `hosts.agy.manifest`、命令 hooks `timeout`、MCP `targets` 与 `${user_config.<KEY>}`、`GuardContext.cwd` 及子进程守卫使用 `node:` 内置模块的说明。

### 不改的地方（红线）

- 默认布局且未显式配置 `hosts.agy.manifest` 时，agy 仍写根 `plugin.json`；`full`、`throwing-guard`、`after-tool`、`components`、`rules-commands`、`guard-options` 的 agy manifest 路径不变。
- `src/runtime/core/` 与 `claude-code-in-process.ts` 不引用 Node 类型与 `node:` 模块，`tsconfig.runtime-core.json` 检查不变。

### 测试

- 单元：
  - `test/config/validate.test.ts`：`commandHooks[i].timeout` 非整数、`<= 0` 报错，正整数通过；`hosts.agy.manifest` 非法值报错，两个合法值通过。
  - `test/source/mcp.test.ts`：`mcpServers.<name>.targets` 为空、重复、未知目标名报错，合法目标列表通过。
  - `test/build/checks.test.ts` 与 `test/build/components.test.ts`：MCP `targets` 过滤与不承载目标显式指定时报错；`dir: '.'` 时源项目 `rules/<name>.md` 与生成文件同路径冲突报错。
  - `test/targets/codex.test.ts`、`test/targets/agy.test.ts`、`test/targets/claude-code.test.ts`、`test/targets/merged-manifest-and-guard-cwd.test.ts`：命令 hooks 自定义 `timeout`、Codex `SessionEnd` `timeout <= 3` 与 `> 3`、MCP `${user_config.<KEY>}` 剥离与 `env_vars` 并入、agy 默认与合并布局 manifest 路径。
  - `test/runtime/subprocess.test.ts` 与 `test/bundle/bundle.test.ts`：三个子进程入口提取 `cwd`（含缺失/空串退化为 `null`）、子进程守卫导入 `node:fs` / `node:path` 打包通过、`claude-code:in-process` 守卫导入 `node:fs` 打包失败。
- 夹具：`merged`、`command-hooks`、`host-coverage` 比对与入口用例通过。

## 验收

```bash
test/container/run.sh check
```

```bash
test/container/run.sh exec node --test test/fixtures/fixtures.test.ts
```

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 最终实现方案、关键技术决策及其验证依据；
3. 主要改动点与涉及模块清单；
4. 测试覆盖、宿主实测结果、判断范围和已知限制；
5. 如适用，附生成的产物或入口的输入输出示例。

## 边界

- 允许新增与修改：`src/config/`、`src/source/`、`src/build/`、`src/runtime/`、`src/targets/`、
  `test/`、`docs/guide/`。
- 禁止修改：`package.json`、`tsconfig.runtime-core.json`、`test/container/run.sh` 的启动参数。

## 依赖

M5-03、M5-04、M5-05 的实现；2026-10-17 容器实测结论（已记入 `agy-local-tests.md`）。
