# Codex hooks 源码核对记录（rust-v0.162.1）

本文记录 Codex 插件 manifest 与命令 hooks 的加载、输入、输出与失败处理，以及插件中的 MCP
服务器、agents、commands、rules 与用户配置，依据为
[`openai/codex`](https://github.com/openai/codex) tag `rust-v0.162.1` 的源码与其中的单元测试，
核对日期 2026-10-14（「commands、rules 与用户配置」为 2026-10-15）。文件路径相对 `codex-rs/`。官方文档见 [Codex](codex-plugins.md)。
本文不是宿主实测：结论来自源码与上游测试，未在 Codex 中安装插件运行。

## manifest 的发现与格式

| 项目 | 结论 | 依据 |
|---|---|---|
| 发现顺序 | 根 `plugin.json` 的 `$schema` 以 `https://agent-plugins.org/schemas/` 开头时视为 AgentPlugin 格式并优先；否则依次查找 `.codex-plugin/plugin.json`、`.claude-plugin/plugin.json`、`.cursor-plugin/plugin.json`（兼容格式） | `utils/plugins/src/plugin_namespace.rs`；测试 `preserves_codex_claude_cursor_legacy_precedence` |
| AgentPlugin 格式的 hooks | `load_plugin` 对 AgentPlugin 格式返回空的 hook 列表：`extensions.com.openai.hooks` 与默认 `hooks/hooks.json` 都不加载 | `core-plugins/src/loader.rs` 的 `load_plugin` |
| 兼容格式的 hooks | manifest 写了 `hooks` 时替换默认文件；未写时读取 `hooks/hooks.json` | `core-plugins/src/loader.rs` 的 `load_plugin_hooks`；测试 `load_plugin_hooks_manifest_paths_replace_default_hooks_file` |
| skills | manifest 未写 `skills` 时使用 `skills/`；兼容格式递归发现，AgentPlugin 格式只认直接子目录 | `core-plugins/src/loader.rs` |

兼容 manifest 的字段（`core-plugins/src/manifest.rs` 的 `RawPluginManifest`，camelCase，未知字段
忽略，各字段都可省略）：`name`、`version`、`description`、`keywords`、`skills`、`mcpServers`、
`apps`、`hooks`、`interface`、`extensions`。没有 `author`。

- `name` 为空时取插件目录名；该文件不检查 kebab-case。
- `hooks` 可为以 `./` 开头的路径、路径数组、内联 hooks 对象或其数组。路径须以 `./` 开头、不含
  `..`、位于插件目录内；违反时该路径被丢弃并告警，不报解析错误。
- `hooks` 的解析（`resolve_manifest_hooks`）：路径数组或内联对象数组为空、或其中路径全部被丢弃时，
  结果与未写 `hooks` 相同，仍读取默认的 `hooks/hooks.json`；单个内联对象（如 `{"hooks": {}}`）解析为
  内联 hooks，`load_plugin_hooks` 跳过事件全为空的条目且不回退到默认文件。因此 `"hooks": []` 不能阻止
  读取默认文件，`"hooks": {"hooks": {}}` 可以。`HooksFile` 的两个字段都有默认值，`{}` 与
  `{"hooks": {}}` 都能解析。
- `interface` 的字段：`displayName`、`shortDescription`、`longDescription`、`developerName`、
  `category`、`capabilities`、`websiteUrl`、`privacyPolicyUrl`、`termsOfServiceUrl`、
  `defaultPrompt`、`brandColor`、`composerIcon`、`logo`、`logoDark`、`screenshots`；后三个 URL 字段
  另接受 `websiteURL`、`privacyPolicyURL`、`termsOfServiceURL`。`defaultPrompt` 至多 3 条，每条
  至多 128 字符。

## hooks 文件结构

`config/src/hook_config.rs`：

- 根对象 `HooksFile` 只有 `description`、`hooks` 两个键，带 `deny_unknown_fields`：出现 `modules`
  等其他键时整份文件解析失败，其中的 hooks 全部跳过并记启动警告（测试
  `load_plugin_hooks_reports_invalid_hook_file`）。
- `hooks` 的键为 `PreToolUse`、`PermissionRequest`、`PostToolUse`、`PreCompact`、`PostCompact`、
  `SessionStart`、`SessionEnd`、`UserPromptSubmit`、`SubagentStart`、`SubagentStop`、`Stop`、
  `Interrupt`；该层不拒绝未知键，未知事件名被忽略。
- 每个事件为分组数组，分组为 `{ matcher?, hooks: [<处理器>] }`。处理器以 `type` 区分：`command`
  的字段为 `command`、`commandWindows`、`timeout`（秒）、`async`、`statusMessage`、
  `additionalContextLimit`；没有 `timeoutSec` 别名。分组与处理器的未知字段被忽略；缺少 `type`
  或类型不符时整份文件解析失败。

## matcher、命令执行与超时

| 项目 | 结论 | 依据 |
|---|---|---|
| matcher | 省略、`""` 与 `"*"` 匹配全部工具；只含字母、数字、`_`、`\|` 时按 `\|` 分隔整串匹配；其余按正则 `is_match`，不自动锚定；`UserPromptSubmit`、`Stop` 忽略 matcher | `hooks/src/engine/matcher.rs`；测试 `pre_tool_use_star_matcher_matches_all_tools` |
| 执行方式 | 命令交给 shell：会话的本地 shell 以 `-c` 执行（PowerShell 为 `-NoProfile -Command`，cmd 为 `/c`）；取不到时用 `$SHELL -lc` 或 `/bin/sh -lc` | `hooks/src/engine/command_runner.rs`；`core/src/session/mod.rs` |
| 插件目录变量 | 插件来源的命令中 `${PLUGIN_ROOT}`、`${PLUGIN_DATA}` 由 Codex 在交给 shell 前按字面替换；进程环境另有 `PLUGIN_ROOT`、`PLUGIN_DATA`、`CLAUDE_PLUGIN_ROOT`、`CLAUDE_PLUGIN_DATA` | `hooks/src/engine/discovery.rs`；测试 `plugin_hook_sources_expand_plugin_placeholders` |
| 工作目录 | stdin 中的 `cwd` | `hooks/src/engine/command_runner.rs` |
| 数据目录 | `$CODEX_HOME/plugins/data/<插件名>-<marketplace>`；hook 路径上没有创建该目录的代码 | `core-plugins/src/store.rs` |
| 超时 | 默认 600 秒，最小 1 秒；`SessionEnd`、`Interrupt` 默认 1 秒、上限 3 秒；超时杀进程组并记为失败 | `hooks/src/engine/discovery.rs` |

## stdin

stdin 为一个 snake_case JSON 对象，不以换行结尾，写完即关闭（`hooks/src/schema.rs`）：

| 事件 | 字段 |
|---|---|
| 共有 | `session_id`、`turn_id`、`transcript_path`、`cwd`、`hook_event_name`、`model`、`permission_mode`；子代理中另有 `agent_id`、`agent_type` |
| `PreToolUse` | `tool_name`、`tool_input`、`tool_use_id` |
| `UserPromptSubmit` | `prompt` |
| `Stop` | `stop_hook_active`、`last_assistant_message` |

工具名：执行命令为 `Bash`，`tool_input` 为 `{"command": <命令字符串>}`；`apply_patch` 的
`tool_input` 为 `{"command": <补丁文本>}`，matcher 另以 `Write`、`Edit` 匹配；`spawn_agent`
另以 `Agent` 匹配；MCP 工具为 `mcp__<命名空间>__<工具>`；`write_stdin` 不触发 `PreToolUse`
（`core/src/tools/hook_names.rs`、`core/src/tools/handlers/`）。

## 输出

stdout 去掉首尾空白后须为单个 JSON 对象，按带 `deny_unknown_fields` 的类型解析
（`hooks/src/engine/output_parser.rs`）。

| 事件 | 输出 | 结果 |
|---|---|---|
| 共有 | 退出码 0 且 stdout 为空 | 无操作 |
| 共有 | 退出码 2 且 stderr 非空 | 阻断（`PreToolUse`、`UserPromptSubmit`）或继续本轮（`Stop`），原因为去掉首尾空白的 stderr，不读 stdout |
| 共有 | 退出码 2 且 stderr 为空、其他退出码、超时、启动失败 | 记为 hook 失败，按放行处理 |
| `PreToolUse` | `hookSpecificOutput` 含 `hookEventName`、`permissionDecision: "deny"` 与非空 `permissionDecisionReason` | 阻断 |
| `PreToolUse` | `hookSpecificOutput` 含 `hookEventName`、`permissionDecision: "allow"` 与 `updatedInput` | 改写；`Bash` 与 `apply_patch` 只读回 `updatedInput.command`（须为字符串，否则该调用报错不执行），其余工具整体替换参数 |
| `PreToolUse` | `allow` 不带 `updatedInput`、`ask`、顶层 `decision: "approve"`、`continue: false` | 无效，按放行处理 |
| `PreToolUse` | 不以 `{` 或 `[` 开头的文本 | 忽略 |
| `UserPromptSubmit` | 顶层 `decision: "block"` 与非空 `reason`，或 `continue: false` | 拦下提示，不写入历史，不调用模型；退出码 0 的纯文本 stdout 作为附加上下文 |
| `Stop` | 顶层 `decision: "block"` 与非空 `reason` | 以 `reason` 为续写提示继续本轮，再次调用时 `stop_hook_active` 为 `true`；`continue: false` 优先结束；代码中没有续写次数上限 |
| `Stop` | 退出码 0 的纯文本 | 记为 hook 失败，照常结束 |

依据为 `hooks/src/events/pre_tool_use.rs`、`user_prompt_submit.rs`、`stop.rs` 与
`core/src/session/turn.rs`；测试包括 `exit_code_two_blocks_processing`、
`permission_decision_allow_can_update_input`、
`permission_decision_allow_without_updated_input_fails_open`、
`claude_block_decision_blocks_processing`、`continue_false_overrides_block_decision`。
同一事件的同步处理器并发执行；多个改写时最后完成的生效，任一处理器阻断时改写作废。
`async: true` 的处理器不能阻断或改写。

## PostToolUse

stdin 在共有字段之外有 `tool_name`、`tool_input`、`tool_response`、`tool_use_id`
（`hooks/src/schema.rs` 的 `PostToolUseCommandInput`）。`tool_response` 的类型随工具不同：

| 工具 | `tool_response` | 依据 |
|---|---|---|
| 执行命令（`Bash`） | 字符串：截断后交给模型的输出 | `core/src/tools/context.rs` 的 `ExecCommandToolOutput::post_tool_use_response`；测试 `post_tool_use_records_additional_context_for_exec_command` |
| `apply_patch` | 字符串，以 `Exit code: 0` 开头 | 测试 `post_tool_use_records_additional_context_for_apply_patch` |
| MCP 工具 | 对象：MCP 的 `CallToolResult`（`content`、`structuredContent`、`isError`、`_meta`） | `core/src/tools/handlers/mcp.rs`；测试 `post_tool_use_records_mcp_tool_payload_and_context` |
| 其他函数工具 | 交给模型的输出 | `core/src/tools/registry.rs` 的默认 `post_tool_use_payload` |

- 触发条件：只对执行成功的调用触发（`core/src/tools/registry.rs`）。命令以非零退出码结束仍算
  成功；处理器返回错误、MCP 结果的 `isError` 为真、执行会话仍在运行时不触发，会话经
  `write_stdin` 结束时才触发
  （测试 `post_tool_use_blocks_when_exec_session_completes_via_write_stdin`）。
- 输出字段（带 `deny_unknown_fields`）：顶层 `continue`、`stopReason`、`suppressOutput`、
  `systemMessage`、`decision`（只接受 `"block"`）、`reason`；`hookSpecificOutput` 含
  `hookEventName`、`additionalContext`、`updatedMCPToolOutput`。形似 JSON 而无法解析时记为
  hook 失败，不产生效果（`hooks/src/events/post_tool_use.rs` 的 `parse_completed`）。

| 输出 | 结果 | 依据 |
|---|---|---|
| `decision: "block"` 与非空 `reason` | 以 `reason` 替换工具输出，模型读到的是原因；已执行的命令不撤销；多个处理器阻断时原因以空行连接 | `core/src/tools/registry.rs`；测试 `post_tool_use_block_decision_replaces_exec_command_output_with_reason` |
| `decision: "block"` 而 `reason` 缺失或为空白 | 记为 hook 失败，原输出保留 | `hooks/src/events/post_tool_use.rs` |
| 退出码 2 且 stderr 非空 | 以去掉首尾空白的 stderr 替换工具输出 | 测试 `post_tool_use_exit_two_replaces_one_shot_exec_command_output_with_feedback` |
| `continue: false` | 以 `reason`、`stopReason` 或固定文字替换工具输出，本轮继续 | 测试 `post_tool_use_continue_false_replaces_exec_command_output_with_stop_reason` |
| `updatedMCPToolOutput`、`suppressOutput: true`、只有 `reason` 没有 `decision` | 记为 hook 失败，原输出保留 | 测试 `unsupported_updated_mcp_tool_output_fails_open` |
| 退出码 2 而 stderr 为空、其他退出码、超时、无法解析的 JSON | 记为 hook 失败，原输出保留 | `hooks/src/events/post_tool_use.rs` 的 `parse_completed` |
| 不以 `{` 开头的纯文本 | 忽略 | 测试 `plain_stdout_is_ignored_for_post_tool_use` |

Codex 没有替换为任意文本的输出字段；`decision: "block"` 替换后的结果对模型是一次失败的工具
调用（`FunctionCallError::RespondToModel`），不是正常输出。`async: true` 的处理器不能阻断。

## 插件中的 MCP 服务器

兼容 manifest 的 `mcpServers`（`core-plugins/src/manifest.rs` 的 `RawPluginManifestMcpServers`）：

| 写法 | 读取的服务器 | 依据 |
|---|---|---|
| 以 `./` 开头的路径（不含 `..`，位于插件目录内） | 只读该文件，不读 `.mcp.json` | 测试 `load_plugins_uses_manifest_configured_component_paths`、`legacy_manifest_can_point_at_root_mcp_json` |
| 对象 | 只用内联的服务器；`{}` 时没有服务器（无专门测试；容器实测见 [Codex](codex-plugins.md#容器实测01621)） | `core-plugins/src/loader.rs`；测试 `load_plugins_loads_manifest_mcp_server_objects` |
| 未写 | 读插件根的 `.mcp.json`（带点）；不自动读取 `mcp.json` | `core-plugins/src/loader.rs` 的 `DEFAULT_MCP_CONFIG_FILE` |

MCP 文件的解析（`codex-mcp/src/plugin_config.rs` 的 `parse_plugin_mcp_config`）：

- 顶层为 `{"mcpServers": {...}}` 或直接为服务器名到配置的映射。
- 服务器字段为 snake_case，与 `config.toml` 的 `[mcp_servers]` 相同（`config/src/mcp_types.rs`）：
  本地服务器 `command`、`args`、`env`、`env_vars`、`cwd`；远程服务器 `url`、
  `bearer_token_env_var`、`http_headers`、`env_http_headers`。`command` 与 `url` 同时出现时该
  服务器出错并被跳过。
- `type` 可省略，解析前被移除；`stdio`、`http`、`streamable_http`、`streamable-http` 静默接受，
  其他取值只告警。传输方式由有 `command` 还是 `url` 决定。
- 未知字段被静默忽略（测试 `deserialize_ignores_unknown_server_fields`），因此 `headers` 等
  其他宿主的写法不生效。
- 单个服务器出错只跳过该服务器；顶层格式错误时整个文件被忽略并告警。
- 不展开任何占位符：本地服务器以 `Command::new` 启动，不经 shell
  （`rmcp-client/src/stdio_server_launcher.rs`），`env` 原样传入；`${PLUGIN_ROOT}`、
  `${CLAUDE_PLUGIN_ROOT}` 保持字面量。这些变量只注入插件的 hook 进程。
- `cwd` 为相对路径时拼到插件目录下（`normalize_plugin_mcp_server_value`；测试
  `declared_placement_preserves_local_plugin_normalization`）；省略时为会话的工作目录。
- 服务器名不加命名空间；多个插件重名时按配置名排序后先出现的生效，并告警
  （`core-plugins/src/loader.rs`）；用户 `[mcp_servers]` 中的同名项覆盖插件的服务器。

## agents

插件不承载 agents：`plugin/src/manifest.rs` 的 `PluginManifestPaths` 只有 `skills`、
`onboarding_skill`、`mcp_servers`、`apps`、`hooks`，兼容 manifest 中没有 agents 字段，写了也被
忽略，`agents/*.md` 不被加载。Codex 自己的自定义 agent 来自 `config.toml` 的
`[agents.<role>]` 与各配置层的 `agents/**/*.toml`（`agent-roles/src/loader.rs`），不在插件体系内。

## commands、rules 与用户配置

2026-10-15 核对，同一 tag。

| 项目 | 结论 | 依据 |
|---|---|---|
| commands | 兼容格式的插件在安装时把 `commands/*.md`（manifest 写了 `commands` 时为其指定的路径）转换为技能，写到插件内的 `.codex-plugin/migrated-command-skills/source-command-<slug>/SKILL.md`；AgentPlugin 格式不转换。命令的 frontmatter 只读取 `description`。以下命令被跳过：没有 `description`；正文含 `$ARGUMENTS`、`$N`、`{{…}}`、`` !`cmd` `` 或 `@file` 一类模板写法；转换结果超过 4000 字节；文件名为 README；生成的名称超过 64 个字符；slug 重复 | `core-plugins/src/command_migration/plugin.rs` 的 `migrate_plugin_commands`；`core-plugins/src/command_migration.rs` 的 `has_unsupported_command_template_features`；`core-plugins/src/store.rs` 中按格式判断的分支；测试 `install_plugin_materializes_default_command_skills`、`agent_plugin_install_does_not_migrate_commands`、`commands_without_description_are_skipped`、`commands_with_provider_runtime_expansion_are_skipped` |
| rules 与指令文件 | 插件不承载：`PluginManifestPaths` 只有 `skills`、`onboarding_skill`、`mcp_servers`、`apps`、`hooks`，`LoadedPlugin` 没有指令或规则字段，插件代码中没有加载 `AGENTS.md` 或规则文件的路径 | `plugin/src/manifest.rs`；`plugin/src/load_outcome.rs` |
| 用户配置 | 没有传给 hook 或 MCP 服务器的插件用户配置。`[plugins."<插件>@<marketplace>"]` 只有 `enabled` 与按服务器设置工具策略的 `mcp_servers.<服务器>`；插件 hook 进程只额外收到 `PLUGIN_ROOT`、`CLAUDE_PLUGIN_ROOT`、`PLUGIN_DATA`、`CLAUDE_PLUGIN_DATA` | `config/src/types.rs` 的 `PluginConfig`、`PluginMcpServerConfig`；`hooks/src/engine/discovery.rs` 的 `append_plugin_hook_sources` |

转换后的技能在 TUI 中的调用方式未核对。

## 信任与加载条件

- 插件 hooks 在 `features.hooks` 与 `features.plugins`（默认都开启）、插件已安装且启用时加载；
  调用链中未见按客户端（TUI、`codex exec`、app-server）区分的条件（推断）。
- 非托管 hook 须经信任才注册为可执行处理器；未信任或配置改动后（状态为 Modified）的 hook 被
  静默跳过，不告警。信任记录在用户层配置 `[hooks.state."<key>"] trusted_hash`，哈希覆盖替换前的
  `command`、`timeout`、`statusMessage`、`async` 等字段；插件 hook 的 key 形如
  `<插件>@<marketplace>:hooks/hooks.json:pre_tool_use:<分组>:<处理器>`。安装插件不自动信任其
  hooks；`--dangerously-bypass-hook-trust` 可临时绕过（`hooks/src/engine/discovery.rs`、
  `hooks/src/config_rules.rs`）。

## 未能由源码确定的项

- `hookEventName` 与当前事件不一致时是否被拒绝。
- `PostToolUse` 输出中的未知字段使整份输出无效：由与其他事件相同的 `deny_unknown_fields`
  写法推断，没有该事件的专门测试。
- 兼容 manifest 的 `mcpServers` 为 `{}` 时不回退到 `.mcp.json`：由 `resolve_manifest_mcp_servers`
  与 `load_plugin_mcp_servers_from_manifest_with_format` 的代码路径推断，没有专门测试。
- `PLUGIN_DATA` 目录是否由其他代码路径创建。
- 桌面端写入 `trusted_hash` 的方式；社区记录（openai/codex #46210、#47283）显示 `codex exec`
  静默跳过未信任的 hook，桌面端的 `/hooks` 存在无法写入信任的问题。
