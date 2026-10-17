# Claude Code hooks

本文说明 Claude Code 插件 hooks 的两种形态、命令 hooks 的控制语义、失败处理与上下文注入，以及
2.1.296 的实测结论。版本引用截至 2.1.300（2026-10-14）；实测为 2.1.296。插件的目录、manifest 与
分发见 [Claude Code 插件](claude-code-plugins.md)，hooks 模块的开发细节见
[Claude Code Mods 开发指南](claude-code-mods-guide.md)。

## 两种形态

`hooks/hooks.json` 承载两种形态，可单独使用，也可在同一文件中并存 [C4][C5]：

| 形态 | 声明方式 | 执行方式 | 引入版本 |
|---|---|---|---|
| 命令 hooks（command hooks，文档亦称 settings hooks） | `"hooks": { "<Event>": [...] }` | 每次事件启动一个子进程，stdin 传 JSON，以退出码与 stdout JSON 回传决定 | 早期版本即有 |
| hooks 模块（function hooks，即 mod） | `"modules": ["./register.ts"]`，一个相对路径 | 模块导出 `register(on, options)`，在宿主提供的独立环境中常驻，以 `($, e, next)` 链式处理事件 | v2.1.287 起终端版默认启用（CHANGELOG） |

## 命令 hooks 的控制语义

依据 [C4]：

- 退出码 0：解析 stdout JSON。退出码 2：阻断，stderr 回传给 Claude；stdout JSON 仍被读取，
  但不能推翻阻断。其他非零退出码：非阻断错误，流程继续。
- `PreToolUse`：`hookSpecificOutput.permissionDecision` 取 `allow` / `deny` / `ask` / `defer`；
  `hookSpecificOutput.updatedInput` 整体替换工具入参（v2.0.10+）。顶层
  `decision: "approve" | "block"` 已标为 deprecated。
- `PostToolUse`：工具已执行。stdin 中工具输出字段为 `tool_response`。
  `hookSpecificOutput.updatedToolOutput` 可替换任意工具的输出（v2.1.121+，此前仅
  `updatedMCPToolOutput` 支持 MCP 工具），取值须符合该工具的输出 schema，不符时被静默忽略；
  退出码 2 与 `decision: "block"` 只把原因附加给 Claude，不阻止其读到原始输出。工具报错时
  触发 `PostToolUseFailure` 而不是 `PostToolUse`。
- `Stop`：退出码 2 或 `decision: "block"` + `reason` 使 Claude 继续工作；连续阻断 8 次后
  强制结束，上限可由 `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` 调整。
- 默认超时 600 秒（v2.1.3 起由 60 秒调整），`UserPromptSubmit` 等少数事件更短。
- `SessionEnd` 默认总预算 1.5 秒，插件 hooks 写的 `timeout` 不提高该预算。
- hook 进程可读取 `CLAUDE_PROJECT_DIR`、`CLAUDE_PLUGIN_ROOT`、`CLAUDE_PLUGIN_DATA`、
  `CLAUDE_PLUGIN_OPTION_<KEY>`、`CLAUDECODE=1`；`SessionStart` 等事件另有 `CLAUDE_ENV_FILE`。
- 处理器类型有 `command`、`http`、`mcp_tool`、`prompt`、`agent`，各事件支持的类型不同；通用字段
  有 `timeout`、`if`、`statusMessage`、`once`、`async`、`asyncRewake` 与 `onFailure`（2.1.295）。
- exec 形式（2.1.139 起）：处理器写 `args` 数组时不经 shell 运行，`${user_config.KEY}` 可写进
  `args`；`shell` 字段选择运行命令的 shell。
- 同一事件有多个 hook 时，决策按 `deny`、`defer`、`ask`、`allow` 的优先级合并；`defer` 只在 `-p`
  模式中可用。同名插件的 hooks 只有一份生效。
- 用 `@` 引用的文件不经 `PreToolUse`；2.1.299 起设置 `CLAUDE_CODE_DISABLE_FILE_MENTIONS=1` 可关闭
  `@` 引用。
- `UserPromptSubmit` 除用户提交的提示外，定时任务、后台子代理的汇报与跨会话消息也会触发；
  2.1.299 起在 skill 或命令展开之前运行（CHANGELOG）。

## 失败处理与 `onFailure`

- 默认情况下，hook 无法启动、以 0 与 2 以外的退出码结束、超时或输出无效时，流程继续 [C4]。
- 2.1.295 起处理器可写 `onFailure: "block"`：上述情况按退出码 2 处理，`PreToolUse` 阻断工具调用，
  `UserPromptSubmit` 阻断提示；对 `Stop` 与 async hooks 无效 [C4]（CHANGELOG 2.1.295）。2.1.296 中
  入口文件不存在时，`onFailure: "block"` 的 `PreToolUse` 阻断了标记命令，未写时命令照常运行（容器
  实测，见[本地实测记录「v0.4.0 覆盖审查」](claude-code-local-tests.md#v040-覆盖审查21296容器)）。
- 2.1.299 起，未设 `shell` 的 `PreToolUse` hook 在 Windows 上缺少 Git for Windows 时改为阻断；hook
  拿不到或交不回值时，能阻断的动作改为拒绝，已运行的工具结果被扣留（CHANGELOG 2.1.299）。
- 2.1.300 起 `updatedInput` 受校验：未知键被丢弃，工具拒绝的入参使该次调用被拒
  （CHANGELOG 2.1.300）。

## 上下文注入与事件

- `additionalContext` 不阻断，只给模型补充上下文，用于 `PreToolUse`、`PostToolUse`、
  `UserPromptSubmit`、`Stop`、`SessionStart`，单条上限 10,000 字符 [C4]。
- `SessionStart` 以退出码 0 输出的纯文本 stdout 作为上下文加入；该事件在启动、恢复、清空与压缩
  （`startup`、`resume`、`clear`、`compact`）时触发 [C4]。2.1.296 中 `-p` 会话的首个回复能引用该
  输出（容器实测）。
- 通用输出字段另有 `continue`、`stopReason`、`systemMessage` [C4]。
- 事件表 [C4] 在 UAPA 使用的六个事件之外，另有 `SubagentStop`、`PreCompact`、`Notification`、
  `PermissionRequest`、`UserPromptExpansion`、`PostToolBatch` 等。
- 工具名与入参以 tools reference 为准 [C11]：`Monitor` 运行命令，与 Bash 使用相同的权限规则；
  `NotebookEdit` 使用 `Edit(...)` 的权限格式。2.1.296 中两者的 `tool_input` 分别为
  `command`、`description`、`timeout_ms` 与 `notebook_path`、`cell_id`、`new_source`、`edit_mode`；
  按需加载的工具先经 `ToolSearch` 调用，它同样触发 `PreToolUse`（容器实测）。

## 命令 hooks 的本地实测

2.1.296 本地实测结论（`claude -p` + `--plugin-dir`），做法见
[Claude Code 本地实测记录](claude-code-local-tests.md#命令-hooks)：

- stdin 中会话 id 为 `session_id`，工作目录为 `cwd`，工具名为 `tool_name`，工具入参为 `tool_input`（Bash 的命令为
  `tool_input.command`），提示文本为 `prompt`。
- `PreToolUse` 只输出 `hookSpecificOutput.updatedInput`、不带 `permissionDecision` 时改写同样生效。
- `PreToolUse` 条目省略 matcher 时对全部工具触发。
- `UserPromptSubmit` 以退出码 2 或 `decision: "block"` 拦下提示，不调用模型。
- 条目的 `timeout` 字段以秒为单位；超时后 hook 进程被结束，工具照常运行。
- `SessionEnd` 在 `-p` 模式下也触发。
- `PostToolUse` 的 `updatedToolOutput` 为复制原 `tool_response` 后改动的对象时生效（Bash 改
  `stdout`，Read 改 `file.content`）；字符串或缺字段的对象被忽略。出错、超时与
  `decision: "block"` 都保留原输出。命令以非零退出码结束时只触发 `PostToolUseFailure`，它的
  输出不能替换结果。做法见[执行后检查](claude-code-local-tests.md#执行后检查)。
- `.mcp.json` 中 `command`、`args` 与 `env` 的 `${CLAUDE_PLUGIN_ROOT}` 展开为插件目录，服务器的
  工作目录为会话的工作目录；agent 的 frontmatter 含 `targets` 等其他键时 `validate --strict`
  通过。做法见 [MCP 服务器与 agents](claude-code-local-tests.md#mcp-服务器与-agents)。

## hooks 模块与命令 hooks 并存

2.1.296 本地实测结论（`claude -p` + `--plugin-dir`，同一插件同时声明二者）：

- `validate` 通过；同一事件上，模块的 hook 与命令 hook **都会执行**。需要两种形态互为
  兜底时，必须自行去重，做法见
  [UAPA hooks 适配 §5](uapa-hook-adapters.md#5-claude-code-双形态去重)。
- 模块在 `session.start` 中调用 `$.env.set(...)` 设置的环境变量，会出现在随后启动的
  命令 hook 进程环境中；`$.session.id()` 与命令 hook stdin 中的 `session_id` 一致。

调用链顺序为 managed 设置 hooks、各插件的 hooks 模块、其余设置 hooks；模块不调用
`next` 直接作答时，其下的用户设置 hooks 不再参与该次决定 [C5]。`disableAllHooks` 与
`--safe-mode` 会关闭第三方 hooks 模块，但不关闭 Claude Code 内置的 mods [C4]。

守卫可能不生效的情形：

- 用户安装的 mod 的 `tool.check` 可以放行插件 `PreToolUse` 拒绝的调用，managed 设置中的 hooks
  除外 [C12]。
- `disableAllHooks`、`--safe-mode`、`--bare`、`allowManagedHooksOnly`、`allowManagedModsOnly`
  关闭插件的 hooks 或 hooks 模块；Anthropic 可以远程关闭已安装的 mods；Desktop 的 WSL 会话不
  加载插件 [C5][C13]。
- 2.1.299 起，用户安装的 mod 调用 `$.env.set` 不再改变 managed 设置中命令 hooks 的环境
  （CHANGELOG）；插件 mod 设置的变量是否仍传给同一插件的命令 hooks，未在 2.1.299 之后实测。

## 来源

- [C4] Hooks reference：<https://code.claude.com/docs/en/hooks>
- [C5] Mods reference：<https://code.claude.com/docs/en/plugins/mods/reference>
- [C11] Tools reference：<https://code.claude.com/docs/en/tools-reference>
- [C12] Permissions：<https://code.claude.com/docs/en/permissions>
- [C13] Mods overview：<https://code.claude.com/docs/en/plugins/mods/overview>
- Claude Code CHANGELOG：<https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md>
  （版本号引用截至 v2.1.300）
