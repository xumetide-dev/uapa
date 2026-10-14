# Claude Code 本地实测记录

本文记录调研中依赖本地实测的 Claude Code 行为，供复现。环境：Claude Code 2.1.296，macOS；
「命令 hooks」与「实测会话的工具权限」两节于 2026-10-14 实测，其余各节于 2026-10-13 实测。
测试插件均为最小示例，不含业务逻辑。

## hooks 模块（mod）

| 项目 | 做法 | 结果 |
|---|---|---|
| 模块导入限制 | `validate` 一个导入 `node:fs` 的模块 | 报错 |
| 事件与状态键 | `validate` 含 `on('stop', ...)` 或 `$.state.get('badge')` 的模块 | 均报错 |
| 缺少 `.catch` | `validate --strict` 一个不带 `.catch` 的守卫钩子 | 只输出 `gating hook without .catch` 说明，通过 |
| 插件名 | 以 `claude-`、`anthropic-`、`cc-plugin-` 开头及 `@org/foo` 的插件 | 前三者 `validate` 报错；`@org/foo` 在 `validate` 中告警，`--plugin-dir` 加载被拒绝 |
| 名称中的 `claude` 段 | 2026-10-14，`validate --strict` 名为 `single-claude`、`my-claude`、`demo-claude-plugin`、`tool-anthropic`、`claudebot`、`myclaude` 的插件 | 前四者告警“reads as one of Anthropic's own”，`--strict` 判为失败，不带 `--strict` 时通过；后两者通过 |
| 守卫示例 | [Mods 指南](claude-code-mods-guide.md) 中的示例模块 | `validate --strict`、`tsc` 通过；3 个 `claude plugin test` 用例（拒绝、放行、扣留）通过 |

## hooks 模块与命令 hooks 并存

| 项目 | 做法 | 结果 |
|---|---|---|
| 同一文件并存 | 同一插件的 `hooks/hooks.json` 声明 `"modules"` 与 `UserPromptSubmit` 命令 hook，用 `claude -p --plugin-dir` 运行 | 两者都执行；模块在 `session.start` 中 `$.env.set` 的变量出现在命令 hook 进程环境中；`$.session.id()` 与 stdin 的 `session_id` 一致 |
| 未知顶层键 | `hooks.json` 同时含 `hooks` 与未知键 `foo` | `validate --strict` 通过；命令 hook 正常执行 |
| 拆分文件 | `plugin.json` 的 `hooks` 指向只含命令 hooks 的文件，默认 `hooks.json` 只含 `modules` | 两者都执行 |
| 数组形式 | `plugin.json` 的 `hooks` 为两个文件路径的数组，其中一个只含 `modules` | 两者都执行 |

## 命令 hooks

功能清单 TA-15 中 Claude Code 的各项。插件的 `hooks/hooks.json` 在 `PreToolUse`（不写
matcher，`timeout` 为 3）、`PostToolUse`、`UserPromptSubmit`、`Stop`、`SessionStart`、
`SessionEnd` 上运行同一个记录脚本：脚本把 stdin 与环境变量追加到日志，再按命令中的标记或
环境变量选择返回方式。会话以 `claude -p --model haiku --plugin-dir <插件目录>` 运行，插件不安装。

| 项目 | 做法 | 结果 |
|---|---|---|
| 公共字段 | 六个事件各触发一次 | stdin 均含 `session_id`、`transcript_path`、`cwd`、`hook_event_name` |
| 工具事件字段 | 让模型运行 Bash 与 Read | `PreToolUse` 含 `tool_name`、`tool_input`、`tool_use_id`、`permission_mode`；Bash 的 `tool_input` 为 `command` 与 `description`；`PostToolUse` 另含 `tool_response` 与 `duration_ms` |
| 提示与停机字段 | 同一会话 | `UserPromptSubmit` 的提示文本在 `prompt`；`Stop` 含 `stop_hook_active` 与 `last_assistant_message` |
| 会话事件 | `-p` 模式运行一次 | `SessionStart`（`source` 为 `startup`）与 `SessionEnd`（`reason` 为 `other`）都触发 |
| 省略 matcher | `PreToolUse` 条目不写 matcher | Bash 与 Read 都触发该 hook |
| 退出码 2 | 脚本在 stderr 写原因后以 2 结束 | 工具不运行；模型收到 `PreToolUse:Bash hook error: [<命令>]: <stderr>` |
| 退出码 1 | 脚本以 1 结束 | 非阻断错误，工具照常运行 |
| 改写，不带 `permissionDecision` | stdout 为 `{"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{...}}}` | 生效：运行的是改写后的命令，`PostToolUse` 的 `tool_input` 为改写后的值；`updatedInput` 整体替换入参，脚本写回了原入参的其余字段 |
| 改写，带 `permissionDecision: "allow"` | 同上，另含 `permissionDecision` 与 `permissionDecisionReason` | 同样生效 |
| 超时 | 条目写 `"timeout": 3`，脚本等待 10 秒 | 约 3 秒时 hook 进程被结束，日志中没有等待之后的记录，工具照常运行：字段名为 `timeout`，单位为秒，超时放行 |
| 提示阻断：退出码 2 | 脚本在 stderr 写原因后以 2 结束 | 提示被拦下，不调用模型；输出 `UserPromptSubmit operation blocked by hook:`、stderr 与原提示；`claude -p` 以 0 结束；事件顺序为 `SessionStart`、`UserPromptSubmit`、`SessionEnd` |
| 提示阻断：JSON | 退出码 0，stdout 为 `{"decision":"block","reason":"..."}` | 同样拦下，输出 `reason` |
| 停机继续 | `Stop` 的 stdout 为 `{"decision":"block","reason":"..."}`，`stop_hook_active` 为 `true` 时不再阻断 | 会话按 `reason` 再进行一轮；第二次 `Stop` 的 `stop_hook_active` 为 `true` |
| hook 进程环境 | 记录指定的环境变量 | 继承启动 `claude` 时的环境变量；`CLAUDE_PLUGIN_ROOT`、`CLAUDE_PLUGIN_DATA`（以 `--plugin-dir` 加载时同样设置）与 `CLAUDE_PROJECT_DIR` 均有值 |

`--allowedTools` 接受多个值，写在它之后的提示会被当作工具名，因此提示经 stdin 传入。

## 实测会话的工具权限

2026-10-14，在临时目录中以 `claude -p --model haiku --allowedTools "Bash(echo:*)"` 运行，
要求模型执行规则之外的命令：

| 项目 | 做法 | 结果 |
|---|---|---|
| 沿用本机权限模式 | 不写 `--permission-mode`；hook stdin 的 `permission_mode` 为 `auto` | `touch <文件>` 照常执行，`--allowedTools` 不构成限制 |
| `--permission-mode default` | 同上，另加该参数 | `touch <文件>` 被拒绝，记入结果的 `permission_denials` |
| 只读命令 | 两种模式下分别运行 `pwd`、`ls`、`find` | 均执行，不受 `--allowedTools` 限制 |

需要限制实测会话可用的工具时，同时写 `--permission-mode default` 与 `--allowedTools`；
只读命令仍会执行。

## 使用的命令

```bash
claude plugin validate ./command-guard --strict
```

```bash
claude plugin test ./command-guard
```

```bash
claude -p --plugin-dir ./dualtrack-probe "hello"
```

```bash
echo "<提示>" | claude -p --model haiku --plugin-dir ./command-probe --allowedTools Bash Read
```
