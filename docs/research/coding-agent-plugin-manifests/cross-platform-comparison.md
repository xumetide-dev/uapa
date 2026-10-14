# 跨平台对比：十个编码代理的插件与 manifest

本文横向比较 Claude Code、Codex、OpenCode、DeepSeek Harness（DSH）、Kimi Code、
CodeBuddy / WorkBuddy、GitHub Copilot、Cursor、Kiro、Antigravity CLI（agy）的插件形态、manifest、
skills、hooks 控制能力、MCP 配置与分发方式，并给出跨平台发布的取舍建议。各平台细节与出处见
同目录的平台文档；扩展机制的分层见 [扩展形态与迁移指南](modular-development.md)。事实核对日期为
2026-10-13，agy 为 2026-10-14。

## 插件形态与 manifest

| 平台 | 插件本质 | manifest 位置 | 必填字段 | 文档 |
|---|---|---|---|---|
| Claude Code | 声明式目录包；`hooks/hooks.json` 可含进程内 hooks 模块 | `.claude-plugin/plugin.json`，可选 | `name` | [链接](claude-code-plugins.md) |
| Codex | 声明式目录包 | 根 `plugin.json`；`.codex-plugin/plugin.json` 兼容 | `name`、`version`、`description` | [链接](codex-plugins.md) |
| OpenCode | JS/TS 代码模块 | 无；npm 包用 `package.json` | 不适用 | [链接](opencode-plugins.md) |
| DSH | npm 包 + Cordis 配置层 | `package.json` 的 `dsh.bundle` + `cordis.patch.yml` | `dsh.bundle.patch` | [链接](dsh-plugins.md) |
| Kimi Code | 声明式目录包 / zip | `kimi.plugin.json` 或 `.kimi-plugin/plugin.json` | `name` | [链接](kimi-code-plugins.md) |
| agy | 声明式目录包 | 根 `plugin.json`；1.3.2 起也可在 `.antigravity-plugin/`、`.gemini-plugin/` 中 | `name`（CLI） | [链接](agy-plugins.md) |
| CodeBuddy / WorkBuddy | 声明式目录包（Claude Code 兼容） | `.codebuddy-plugin/`、`.workbuddy-plugin/`、`.claude-plugin/` 下的 `plugin.json`，可选 | `name` | [链接](workbuddy-codebuddy-plugins.md) |
| GitHub Copilot | 声明式目录包 | 根 `plugin.json`（带 `$schema`）；另识别 Copilot、Claude、OpenPlugin 旧格式 | `$schema`、`name` | [链接](github-copilot-plugins.md) |
| Cursor | 声明式目录包 | `.cursor-plugin/plugin.json`；根 `plugin.json` 只承载 skills 与 MCP | `name` | [链接](cursor-plugins.md) |
| Kiro | Power（声明式目录包） | 根 `plugin.json`；旧版 `POWER.md` | kiro.dev 要求六项；Kiro 的 power-builder 参考只要求 `$schema`、`name` | [链接](kiro-powers.md) |

“必填字段”指各平台官方文档对其 manifest 的要求。

## manifest 位置的交叉读取

- **根目录 `plugin.json`**：Codex、GitHub Copilot、Cursor、Kiro、agy 都读取，但各自规则不同。
  Copilot 与 Kiro 要求 `$schema` 并拒绝未知顶层字段（Copilot 报告并忽略，Kiro 校验失败），
  专有设置放在 `extensions` 下各自的命名空间（`com.openai`、`com.github.copilot`、
  `dev.kiro`）；Cursor 的这种格式只承载 skills 与 MCP；agy 的 schema 只允许 `name`、`description`。
  同一份文件不能同时满足五家，应按宿主分别生成。
- **`.claude-plugin/`**：Claude Code 本身使用；CodeBuddy / WorkBuddy 兼容其 `plugin.json` 并
  提供 `CLAUDE_*` 路径变量；VS Code 与 Copilot CLI 识别其 manifest；Codex 与 Copilot CLI
  识别其 `marketplace.json`。
- **宿主自有格式**：Kimi Code（`kimi.plugin.json`）、DSH（`package.json` 的 `dsh` 键）、
  OpenCode（代码模块 + `opencode.json` 的 `plugin` 数组）。

## marketplace 位置

| 平台 | marketplace 文件 | 安装命令 |
|---|---|---|
| Claude Code | `.claude-plugin/marketplace.json` | `claude plugin install p@m` |
| Codex | `.agents/plugins/marketplace.json`；兼容 `.claude-plugin/marketplace.json` | `codex plugin add p@m` |
| CodeBuddy | `.codebuddy-plugin/marketplace.json`（文档未列其他位置） | `codebuddy plugin install p@m` |
| GitHub Copilot | `.github/plugin/marketplace.json`；CLI 兼容 `.claude-plugin/marketplace.json` | `copilot plugin install p@m` |
| Cursor | `.cursor-plugin/marketplace.json` | 客户端内安装；公开发布需审核 |
| Kimi Code | 自定义 JSON（`version: "2"`、`plugins[].id/source`） | `/plugins install` |
| agy | 官方 marketplace `antigravity-plugins-official`；GitHub 仓库 URL、本地目录 | `agy plugin install p@m` |
| Kiro | kiro.dev/powers 目录、GitHub URL | Powers 面板 |
| DSH | npm 注册表 / git / 本地链接 | `dsh plugin --profile <n> add` |
| OpenCode | npm 注册表 | 写入 `opencode.json` 的 `plugin` |

## Skills

Agent Skills 规范定义 `SKILL.md`：必填 `name`（≤64 字符，小写字母、数字、连字符）与 `description`
（≤1024 字符），可选 `license`、`compatibility`、`metadata`、`allowed-tools`（实验性）[S1]。

| 平台 | 已核实的发现位置 |
|---|---|
| Claude Code | `.claude/skills/`、插件 `skills/` |
| Codex | 从当前目录逐级向上到仓库根的 `.agents/skills/`、`~/.agents/skills/`、`/etc/codex/skills` |
| OpenCode | `.opencode/skills/`、`.claude/skills/`、`.agents/skills/` 及对应用户目录 |
| DSH | `.dsh/skills`、`.agents/skills`、`customSkillDirs`、`<dshHome>/skills`、`<agentsHome>/skills` |
| Kimi Code | `.kimi-code/skills/`、`.agents/skills/`、`$KIMI_CODE_HOME/skills/`、`~/.agents/skills/` |
| agy | 插件 `skills/<name>/SKILL.md`；工作区与用户目录未逐字核实 |
| WorkBuddy | `.workbuddy/skills/`、`~/.workbuddy/skills/`（只有社区资料佐证） |
| Copilot / Cursor / Kiro | 插件 `skills/<name>/SKILL.md`；工作区目录未逐字核实 |

`.agents/skills/` 是被最多平台读取的共享目录（Codex、OpenCode、DSH、Kimi Code）。

## Hooks 控制能力

| 平台 | 执行前阻断 | 改写工具入参 | 替换工具输出 | 停机门禁 | 失败默认 | 进程内 |
|---|---|---|---|---|---|---|
| Claude Code 命令 hooks | 退出码 2 / `permissionDecision` | `updatedInput` | `updatedToolOutput`（v2.1.121+） | `Stop` 阻断，上限 8 次 | 放行 | 否 |
| Claude Code hooks 模块 | `{ deny }` | `next({ ...e })` | `next` 后返回 `{ result }` 或 `{ deny }` | `classic.Stop` 返回 `{ block }` | 跳过该 hook | 是 |
| Codex | 退出码 2 / `permissionDecision` | `updatedInput` | 部分：`decision: "block"` 以反馈替换 | `Stop` 阻断后继续 | 放行 | 否 |
| GitHub Copilot CLI | 退出码 2 / `permissionDecision` | `modifiedArgs` | `modifiedResult` | `agentStop` 阻断，上限 8 次 | `preToolUse` 拒绝；超时放行 | 否 |
| Cursor | 退出码 2 / 权限决定 | `updated_input` | 只限 MCP 工具 | 不支持 | 放行；可设 `failClosed` | 否 |
| Kimi Code | 退出码 2 / `permissionDecision` | 未提供 | 未提供 | `Stop` 可阻断 | 放行 | 否 |
| agy | `decision: "deny"` | `overwrite` | 不支持 | `Stop` 返回 `decision: "continue"` | `PreToolUse` 阻断（本地实测）；`Stop` 照常结束 | 否 |
| Kiro | 退出码 2（IDE 文档对其他非零码说法矛盾） | 未提供 | 未提供 | 仅 CLI V3 | CLI 放行；IDE 文档矛盾；超时未说明 | 否 |
| CodeBuddy | 退出码 2，原因先取 stdout | `modifiedInput` | `updatedToolOutput` | `continue: false` 或退出码 2，无上限 | 放行 | Mods（Beta） |
| OpenCode | 抛错 | `output.args` | `output.output` | 不支持 | 抛错即阻断 | 是 |
| DSH | `tools/pre-execute` 返回 `deny` | 不支持 | `tools/post-execute` 返回 `accept` | `agent/turn-stopping` + `steer()`，无上限 | 抛错即拒绝 | 是 |

- 各单元格的出处见对应平台文档的“扩展能力摘要”或 hooks 一节。
- “替换工具输出”发生在工具执行之后，不撤销已执行的命令。
- Claude Code 的 `PostToolUse` 用退出码 2 或 `decision: "block"` 只附加原因，模型仍能读到原始输出。
- 同名字段在不同平台含义不同：`continue: false` 在 Claude Code 中终止处理，在 CodeBuddy 的
  `Stop` 中表示继续工作。

## Hooks 命名差异

| 风格 | 平台 | 示例事件 |
|---|---|---|
| PascalCase | Claude Code、Codex、Kimi Code、CodeBuddy、Kiro（JSON 示例）、agy | `PreToolUse`、`PostToolUse`、`Stop` |
| camelCase | GitHub Copilot CLI、Cursor | `preToolUse`、`agentStop`；Cursor 另有 `beforeShellExecution` 等 |
| 点分事件名 | OpenCode、Claude Code hooks 模块 | `tool.execute.before`；`tool.call`、`session.start` |
| Cordis 事件 | DSH | `tools/pre-execute`、`agent/turn-stopping` |

hook 配置文件格式各平台不同，不能共用。VS Code 中的 Copilot 只支持 8 个 PascalCase 事件。

## 工具名差异

执行前 hook 收到的内置工具名（核对日期 2026-10-13，agy 为 2026-10-14；“未查到”指官方文档与
对应版本源码中均未找到）：

| 能力 | Claude Code | Codex 0.162.1 | Copilot CLI | Cursor | Kimi Code 2.1.1 | Kiro IDE / CLI V3 | CodeBuddy | OpenCode 1.19.0 | DSH | agy 1.3.4 |
|---|---|---|---|---|---|---|---|---|---| --- |
| 执行 shell | `Bash`、`PowerShell` | `Bash` | `bash`、`powershell` / `Bash` | `Shell` | `Bash` | `execute_bash`、`execute_pwsh` | `Bash`、`PowerShell` | `bash` | `bash` | `run_command` |
| 读文件 | `Read` | 未查到 | `view` / `Read` | `Read` | `Read` | `read_file` | `Read` | `read` | `read` | `view_file` |
| 编辑文件 | `Edit` | `apply_patch` | `edit` / `Edit` | `Write` | `Edit` | `str_replace` | `Edit`、`MultiEdit` | `edit` 或 `apply_patch` | `edit` | `replace_file_content`、`multi_replace_file_content` |
| 新建文件 | `Write` | `apply_patch` | `create` / `Write` | `Write` | `Write` | `fs_write` | `Write` | `write` 或 `apply_patch` | `write` | `write_to_file` |
| 按模式找文件 | `Glob` | 未查到 | `glob` / `Glob` | 未查到 | `Glob` | `file_search` | `Glob` | `glob` | `glob` | `find_by_name` |
| 内容搜索 | `Grep` | 未查到 | `grep` / `Grep` | `Grep` | `Grep` | `grep_search` | `Grep` | `grep` | `grep` | `grep_search` |
| 抓取网页 | `WebFetch` | 未查到 | `web_fetch` / `WebFetch` | 未查到 | `FetchURL` | `web_fetch` | `WebFetch` | `webfetch` | `web_fetch` | `read_url_content` |
| 网络搜索 | `WebSearch` | 不触发 hook | `web_search` / `WebSearch` | 未查到 | `WebSearch` | `remote_web_search` | `WebSearch` | `websearch` | `web_search` | `search_web` |
| 子代理 | `Agent` | `spawn_agent` | `task` / `Agent` | `Task` | `Agent` | `invoke_sub_agent` | `Agent` | `task` | `subagent` | `invoke_subagent` |
| 待办 | `TaskCreate` 等 | `update_plan` | `update_todo` / `TodoWrite` | 未查到 | `TodoList` | 未查到 | `TaskCreate` 等 | `todowrite` | `todo_write` | 未查到 |
| 名称所在字段 | stdin `tool_name`；模块 `e.tool` | `tool_name` | `toolName` / `tool_name` | `tool_name` | `tool_name` | `tool_name` | `tool_name` | `input.tool` | `exec.name` | `toolCall.name` |

- Claude Code：`Task` 于 v2.1.63 改名为 `Agent`，设置中的 `Task(...)` 仍作为别名生效；
  `TodoWrite` 默认关闭，由 `TaskCreate`、`TaskGet`、`TaskList`、`TaskUpdate` 取代
  [官方工具参考](https://code.claude.com/docs/en/tools-reference)。
- Codex：模型侧的 shell 工具名为 `exec_command`，hook 收到 `Bash`；`Edit`、`Write`、`Agent`
  只是 matcher 别名，stdin 中仍是 `apply_patch`、`spawn_agent`；托管的 `web_search` 不触发
  `PreToolUse`（`codex-rs/core/src/tools/hook_names.rs`，tag `rust-v0.162.1`）。
- Copilot CLI：斜杠前为 camelCase `preToolUse` 收到的运行时名，斜杠后为 PascalCase
  `PreToolUse`（VS Code 兼容格式）收到的 Claude Code 兼容名。
- Cursor：`tool_name` 的文档取值为 `Shell`、`Read`、`Write`、`Grep`、`Delete`、`Task`，MCP 工具
  写作 `MCP:<tool_name>`；编辑与新建都是 `Write`。
- Kiro：IDE / CLI V3 与 CLI 2.x 使用不同的 ID，CLI 2.x 为 `fs_read`、`fs_write`、
  `execute_bash`、`use_subagent` 等；IDE 的命令 hook 收不到 `tool_name` 的问题见
  [Kiro](kiro-powers.md)。
- CodeBuddy：hooks 页把子代理写作 `Task`，工具参考页写作 `Agent`，并称工具参考中的名称即
  hook matcher 使用的标识符；matcher 不自动锚定，`Write` 也会匹配 `NotebookWrite`。
- OpenCode：模型 ID 含 `gpt-`（不含 `oss`、`gpt-4`）时，`apply_patch` 取代 `edit` 与 `write`。
- DSH：名称取自 mods 兼容包的对照表
  （`packages/experimental/claude-code-mods/src/tool-names.ts`），该表仍以 `Task` 对应
  `subagent`。
- agy：工具名取自 hooks 文档的 matcher 列表，入参键为 PascalCase（如 `run_command` 的
  `CommandLine`），见 [agy](agy-plugins.md#输入)。
- 按 `Bash` 编写的 matcher 在 Cursor（`Shell`）与 Kiro（`execute_bash`）上不会命中；跨平台
  守卫需要逐平台映射工具名，存在文档内部不一致的项需在目标版本上实测。

## MCP 配置差异

| 平台 | 文件 | 根键 | 本地命令写法 |
|---|---|---|---|
| Claude Code 插件 | `.mcp.json` 或 `plugin.json` 的 `mcpServers` | `mcpServers` | `command` + `args`，`env` |
| Codex | `config.toml`；插件内 `mcp.json` | `[mcp_servers.<id>]`；`mcpServers` | `command` + `args`，`env` |
| OpenCode | `opencode.json` | `mcp` | `command` 数组，`environment` |
| DSH | Cordis 配置中的 `@deepseek-ai/dsh-mcp-client` 行 | 不适用 | 见 mcp-client README |
| Kimi Code | `~/.kimi-code/mcp.json`、`.kimi-code/mcp.json` | 未逐字核实 | 未逐字核实 |
| Copilot / Cursor / Kiro 插件 | 插件根 `mcp.json` | 未逐字核实 | Kiro：`type: "stdio"` + `command`、`args`、`env` |

## 路径变量

| 平台 | 插件根目录变量 |
|---|---|
| Claude Code | `${CLAUDE_PLUGIN_ROOT}`、`${CLAUDE_PLUGIN_DATA}` |
| CodeBuddy | `${CODEBUDDY_PLUGIN_ROOT}`、`${CODEBUDDY_PLUGIN_DATA}`，兼容 `CLAUDE_*` |
| Codex | hook 环境变量 `PLUGIN_ROOT`、`PLUGIN_DATA`，兼容 `CLAUDE_PLUGIN_ROOT`、`CLAUDE_PLUGIN_DATA` |
| GitHub Copilot | 带 `$schema` 的根 `plugin.json` 用 `${PLUGIN_ROOT}`、`${PLUGIN_DATA}`；Claude 与 Copilot 旧格式用 `${CLAUDE_PLUGIN_ROOT}` |
| Cursor | MCP 配置中展开 `${CURSOR_PLUGIN_ROOT}`、`${CLAUDE_PLUGIN_ROOT}`；不展开 `${PLUGIN_ROOT}`、`${PLUGIN_DATA}` |
| Kimi Code | hook 环境变量 `KIMI_PLUGIN_ROOT`、`KIMI_CODE_HOME` |

插件数据目录：Claude Code、CodeBuddy、Codex、Copilot CLI 为插件 hook 提供可写的数据目录变量；
Cursor、Kimi Code、Kiro 没有文档化的插件数据目录。

Copilot 展开 `${PLUGIN_ROOT}`，Cursor 不展开；没有一个变量能在所有宿主中通用。需要引用插件
根目录的 `mcp.json` 应按平台分别生成。

## 跨平台发布建议

- **manifest 按宿主分别生成**：根 `plugin.json` 在 Codex、Copilot、Cursor、Kiro 中的必填字段、
  允许字段与组件位置各不相同；`.claude-plugin/plugin.json` 可同时覆盖 Claude Code 与
  CodeBuddy / WorkBuddy。Kiro 按 kiro.dev 的六项必填填写。
- **需要单独适配的平台**：Kimi Code 需要 `kimi.plugin.json`；DSH 与 OpenCode 需要代码层适配
  （Cordis 插件或 JS 模块），只能复用 skills 与 MCP 服务器本身。
- **hooks 按平台分别生成**：各宿主 hooks 格式互不兼容；Kiro 的 Power 不能携带 hooks；
  Codex 插件携带的 hooks 只对桌面端手动安装的插件生效，含 hooks 的插件不能公开发布。
  生成方式见 [统一代理插件架构（UAPA）设计提案](unified-agent-plugin-architecture.md)。
- **格式各异的部分**：agents、commands、rules / steering 在各平台格式不同，按平台分别维护。

## 供应链与安全要点

- 插件中的命令 hooks、MCP stdio 服务器与代码模块以当前用户权限在本机运行。Claude Code 的
  hooks 模块只能经 `$` 访问宿主能力；DSH 的 mods 兼容层运行的模块拥有 DSH 进程的全部权限。
- 宿主侧的管控手段：Codex 运行 hook 前要求持久化的 hook 信任；VS Code 的
  `allowManagedHooksOnly` 只允许托管配置强制启用的插件运行 hooks；Cursor 支持企业级
  `hooks.json`。
- 可固定来源的手段：Claude Code 的 git `sha` 与 archive `sha256`；Codex 的
  `marketplaces.<name>.ref`；DSH 与 OpenCode 依赖 npm / pnpm 的版本锁定；Cursor 公开
  marketplace 需人工审核。
- 第三方目录（如 dshpluginhub.ai、各类 awesome 列表）为社区项目，其“Verified”标识不等于官方审计。
- 在本次核对范围内，未见任何平台对插件包做密码学签名校验的官方说明。

## 来源

- [S1] Agent Skills specification：
  <https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx>
- 各平台来源见对应平台文档的“来源”一节。
