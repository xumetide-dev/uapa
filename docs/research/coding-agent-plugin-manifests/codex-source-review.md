# Codex hooks 源码核对记录（rust-v0.162.1）

本文记录 Codex 插件 manifest 与命令 hooks 的加载、输入、输出与失败处理，依据为
[`openai/codex`](https://github.com/openai/codex) tag `rust-v0.162.1` 的源码与其中的单元测试，
核对日期 2026-10-14。文件路径相对 `codex-rs/`。官方文档见 [Codex](codex-plugins.md)。
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
- `PLUGIN_DATA` 目录是否由其他代码路径创建。
- 桌面端写入 `trusted_hash` 的方式；社区记录（openai/codex #46210、#47283）显示 `codex exec`
  静默跳过未信任的 hook，桌面端的 `/hooks` 存在无法写入信任的问题。
