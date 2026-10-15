# Claude Code 本地实测记录

本文记录调研中依赖本地实测的 Claude Code 行为，供复现。环境：Claude Code 2.1.296，macOS；
「命令 hooks」与「实测会话的工具权限」两节于 2026-10-14 实测，其余各节于 2026-10-13 实测。
「hooks 模块的静态校验」「双形态去重的会话实测」「执行后检查」「MCP 服务器与 agents」四节于
2026-10-14 在 Linux 测试容器中实测（同为 2.1.296），其中标注 2026-10-15 的条目为 UAPA 夹具产物的
实测。测试插件均为最小示例，不含业务逻辑。

## hooks 模块（mod）

| 项目 | 做法 | 结果 |
|---|---|---|
| 模块导入限制 | `validate` 一个导入 `node:fs` 的模块 | 报错 |
| 事件与状态键 | `validate` 含 `on('stop', ...)` 或 `$.state.get('badge')` 的模块 | 均报错 |
| 缺少 `.catch` | `validate --strict` 一个不带 `.catch` 的守卫钩子 | 只输出 `gating hook without .catch` 说明，通过 |
| 插件名 | 以 `claude-`、`anthropic-`、`cc-plugin-` 开头及 `@org/foo` 的插件 | 前三者 `validate` 报错；`@org/foo` 在 `validate` 中告警，`--plugin-dir` 加载被拒绝 |
| 名称中的 `claude` 段 | 2026-10-14，`validate --strict` 名为 `single-claude`、`my-claude`、`demo-claude-plugin`、`tool-anthropic`、`claudebot`、`myclaude` 的插件 | 前四者告警“reads as one of Anthropic's own”，`--strict` 判为失败，不带 `--strict` 时通过；后两者通过 |
| 守卫示例 | [Mods 指南](claude-code-mods-guide.md) 中的示例模块 | `validate --strict`、`tsc` 通过；3 个 `claude plugin test` 用例（拒绝、放行、扣留）通过 |

## hooks 模块的静态校验

`claude plugin validate --strict` 按模块源码做静态分析。最小插件的 `hooks/hooks.json` 为
`{"hooks":{},"modules":["./register.ts"]}`，`register.ts` 引入同目录的打包文件 `uapa-guard.mjs`。

| 项目 | 做法 | 结果 |
|---|---|---|
| 转手导出 `register` | `register.ts` 写 `export const register = guard`（`guard` 为引入的函数） | 报错：register 须以 const 函数导出 |
| 转导出 | `export { register } from './uapa-guard.mjs'`，或 `export * from './uapa-guard.mjs'` | 均报错：不跟踪从另一文件转导出的 `register` |
| 调用引入的函数 | `export const register: Register = (on, options) => guard(on, options)`；不写类型、只传 `on` 的写法同样测试 | 通过；分析跟踪进 `uapa-guard.mjs`，列出其中注册的事件、`$` 调用、环境变量与状态键 |
| `modules` 直接指向打包文件 | `modules` 为 `["./uapa-guard.mjs"]`，文件为 `function register(on) {...}` 加 `export { register }` | 通过 |
| `$.env.set` 的变量名 | 以 `const NAME = '...'` 转手后传入 | 报错：变量名须为字面量；直接写字符串字面量时通过，`env writes` 列出该名称 |
| 未声明的状态键 | 模块含 `atom({ plugin, key }, 0)`，没有类型契约；只声明 `atom`、不调用 `read` 与 `update` 时同样测试 | 两者都报错 `<插件>.<键> is not declared` |
| 声明而不使用 | 有类型契约与 `types` 字段，模块不读写状态 | 通过 |
| 状态读写 | `read($, a)` 与 `update($, a, fn)`，`a` 为模块顶层 `const` 持有的 `atom` | 通过；`calls` 记为 `$.state.get`、`$.state.set` |
| 条件中注册 | `on(...)` 写在 `if` 中 | 通过；分析按源码列出，不按条件取舍 |
| `classic.SessionStart` 的 matcher | `on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, hook)` | 通过；记为 `gating hook without .catch`，不计为告警 |

## 双形态去重的会话实测

插件为 `claude-both` 夹具的产物（两个 Claude Code 目标，守卫在连续继续次数小于 2 时要求继续），
对照为只含命令 hooks 的 `single-claude` 夹具产物。会话以 `claude -p --plugin-dir <插件目录>
--permission-mode default --allowedTools Read --output-format json` 运行，提示要求只回复 OK。

| 项目 | 结果 |
|---|---|
| 两种形态并存 | 停机门禁生效（`num_turns` 为 7）；插件数据目录中没有命令入口写的停机计数文件，即命令 hook 按会话 id 比对后提前结束，停机由模块处理 |
| 只有命令 hooks | 停机门禁生效；插件数据目录中出现 `uapa-stop-<会话 id>.json` |
| 停机原因的副作用 | 夹具的停机原因要求“先运行测试”，模型随即尝试运行仓库的检查命令，被权限模式拦下；实测停机门禁时须限制工具 |

2026-10-15，以 `claude-both` 夹具的产物继续实测会话切换与嵌套会话（TA-11）。插件副本另在
`SessionStart`、`UserPromptSubmit` 与 `Stop` 上挂记录用的命令 hook，记下 stdin 的 `session_id`、
`source` 与去重变量 `UAPA_MODULE_SESSION_BOTH_GUARD`；“只由模块执行”指插件数据目录中没有命令
入口写的 `uapa-stop-<会话 id>.json`。交互会话以 tmux 驱动，权限模式为 `dontAsk`。

| 项目 | 做法 | 结果 |
|---|---|---|
| Bash 工具的环境 | 会话中运行 `printenv UAPA_MODULE_SESSION_BOTH_GUARD` | 输出当前会话 id：模块写入的变量传给 Bash 工具启动的进程，嵌套会话因此继承父会话的值 |
| 嵌套会话的登录 | 在会话的 Bash 中运行 `claude -p` | 嵌套会话显示未登录：以环境变量提供的令牌没有传给 Bash 工具启动的进程 |
| 嵌套会话的命令 hooks | 以父会话 id 作为该变量的值启动只含命令 hooks 的同名插件的会话，要求运行 `echo uapa-deny-probe` | 命令入口拒绝该命令（`PreToolUse:Bash hook error: [node "…/uapa-claude-code.mjs" before-tool]: 拒绝标记命令 uapa-deny-probe`），并写出本会话的停机计数文件：变量与 stdin 的会话 id 不同，命令 hook 不被跳过 |
| `claude -p --resume <id>` | 恢复上一个会话 | 会话 id 不变；新进程触发 `session.start`，变量等于该 id，停机只由模块处理 |
| `claude -p --resume <id> --fork-session` | 分叉上一个会话 | 新会话 id；变量等于新 id，停机只由模块处理 |
| 交互会话的 `/clear` | 执行后再提交提示 | 新会话 id，`SessionStart` 的 `source` 为 `clear`；变量等于新 id，停机只由模块处理 |
| 交互会话的 `/branch` | 同上 | 新会话 id，`source` 为 `fork`。模块在 `classic.SessionStart` 中以 `$.session.id()` 写变量时，变量仍为分叉前的 id，命令 hook 不被跳过，停机门禁由两种形态各计一次 |
| 交互会话的 `/resume <id>` | 回到第一个会话 | 会话 id 为第一个会话的 id，`source` 为 `resume`；以 `$.session.id()` 写入时问题同 `/branch` |
| `classic.SessionStart` 的会话 id | 诊断副本在该处理函数中另写 `$.session.id()` 与事件 `e` | `/branch` 与 `/resume` 之后 `$.session.id()` 为切换前的会话 id，`e.session_id` 为新会话 id；`e` 的字段同命令 hook 的 stdin（`session_id`、`transcript_path`、`cwd`、`source`、`model` 等）。之后的 `prompt.submit` 中 `$.session.id()` 已为新 id |
| 改用 `e.session_id` | 入口在 `classic.SessionStart` 中优先写 `e.session_id` 后重新构建 | `/branch` 与 `/resume <id>` 之后变量都等于新会话 id，没有命令入口的停机计数文件 |

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

## 执行后检查

会话以 `claude -p --plugin-dir <插件目录> --permission-mode default --allowedTools <规则>
--output-format stream-json --verbose` 运行。提示只要求模型运行 `echo uapa-after-tool-probe`
（或 `echo uapa-after-tool-probe; false`），或读取工作目录中内容为 `uapa-read-probe` 的文件；
“模型读到”指输出流中该次调用的 `tool_result`。

### 命令 hooks 的 `PostToolUse`

插件在 `PostToolUse` 上挂一个不写 matcher 的脚本，按环境变量选择输出方式。

| 项目 | 做法 | 结果 |
|---|---|---|
| stdin 字段 | 记录 stdin | 公共字段之外有 `tool_name`、`tool_input`、`tool_response`、`tool_use_id`、`duration_ms`，另有 `prompt_id`、`permission_mode`、`effort` |
| Bash 的 `tool_response` | 运行 echo 命令 | 对象：`stdout`、`stderr`、`interrupted`、`isImage`、`noOutputExpected` |
| Read 的 `tool_response` | 读取文件 | 对象：`type` 为 `text`，`file` 含 `filePath`、`content`、`numLines`、`startLine`、`totalLines` |
| 替换 Bash 输出 | `hookSpecificOutput` 含 `hookEventName: "PostToolUse"` 与 `updatedToolOutput`：复制原 `tool_response`，只改 `stdout` | 模型读到改后的 `stdout` |
| 替换 Read 输出 | 同上，只改 `file.content` | 模型读到改后的内容，带行号前缀（`1\t…`） |
| `updatedToolOutput` 为字符串 | Bash 上返回字符串 | 被忽略，模型读到原输出 |
| `updatedToolOutput` 只含 `stdout` | Bash 上返回 `{ "stdout": ... }` | 被忽略，模型读到原输出 |
| `decision: "block"` | stdout 为 `{"decision":"block","reason":...}` | 原输出保留，另把 `reason` 交给模型 |
| 退出码 2 | stderr 写原因后以 2 结束 | 原输出保留，另把原因作为 blocking error 交给模型 |
| 退出码 1 | 以 1 结束 | 原输出保留 |
| 超时 | 条目写 `"timeout": 3`，脚本等待 10 秒 | 原输出保留 |
| 命令以非零退出码结束 | 运行 `echo uapa-after-tool-probe; false`，另在 `PostToolUseFailure` 上挂记录脚本 | 不触发 `PostToolUse`；触发 `PostToolUseFailure`，stdin 没有 `tool_response`，`error` 为 `Exit code 1` 加命令输出，另有 `is_interrupt`；模型读到的结果标为错误 |
| `PostToolUseFailure` 的输出 | 分别返回 `updatedToolOutput`、`decision: "block"` 与退出码 2 | 三者都不改变模型读到的结果；后两者另把原因交给模型 |
| 宿主拦下的命令 | 要求模型读取工作目录之外的文件，宿主以安全规则拦下 | `PostToolUse` 与 `PostToolUseFailure` 都不触发 |

### hooks 模块的 `tool.call`

插件的 `hooks/hooks.json` 只含 `modules`；模块在 `tool.call` 上注册一个不带 matcher 的处理
函数，先 `await next(e)`，再按入参中的标记返回不同的值。

| 项目 | 做法 | 结果 |
|---|---|---|
| 两个不带 matcher 的处理函数 | 同一插件在 `tool.call` 上注册两次 | 模块校验失败（registered twice without a matcher），插件的模块不加载 |
| `e` 的字段 | 记录 Bash 调用的 `e` | `command`、`description`、`tool`、`tool_use_id` |
| `next` 的结果 | 记录 Bash 与 Read 的结果 | `{ ref, result, text, isReadOnly }`：`result` 的形状同命令 hooks 的 `tool_response`，`text` 为模型读到的文本，Read 的 `text` 带行号前缀 |
| 报错的结果 | 运行 `echo uapa-after-tool-probe; false`；另运行被宿主拦下的命令 | `{ ref, result, text, isError: true }`（前者另有 `isReadOnly`），`result` 为以 `Error: ` 开头的字符串 |
| 替换 Bash 输出 | 返回 `{ ...ran, result: { ...ran.result, stdout } }`，或只返回 `{ result }` | 模型读到改后的 `stdout` |
| 替换 Read 输出 | 返回 `{ ...ran, result: { ...ran.result, file: { ...ran.result.file, content } } }` | 模型读到改后的内容，带行号前缀；`validate --strict` 通过 |
| 只改 `text` | 返回 `{ ...ran, text }` | 无效果，模型读到原输出 |
| 只返回 `{ text }` | — | 返回形状不符，转入 `.catch` |
| 扣留 | `next` 之后返回 `{ deny: reason }` | 对 Bash、Read 与报错的结果都生效：模型读到 `<工具名> ran, and a plugin withheld its result: <reason>`，报错的结果为以 `<tool_use_error>` 包裹的原因 |
| `next` 之后抛错 | 处理函数在 `next` 之后抛错，`.catch` 返回 `{ deny }` | `.catch` 中 `next.called` 为 `true`；扣留生效 |
| `next` 之前拒绝 | 返回 `{ deny: reason }` | 工具不运行；模型读到以 `<tool_use_error>` 包裹的原因 |

## MCP 服务器与 agents

插件根有 `.mcp.json` 与 `agents/` 下的两个 agent。`.mcp.json` 含一个本地服务器与一个远程
服务器：本地服务器为最小 stdio 服务器，只响应初始化、工具列表与一个返回标记文本的工具，
启动时把工作目录、参数与一个环境变量追加到日志；远程服务器指向不存在的本地地址。

| 项目 | 做法 | 结果 |
|---|---|---|
| 插件根变量 | 本地服务器的 `args` 与 `env` 含 `${CLAUDE_PLUGIN_ROOT}`；另一次运行中 `command` 为 `${CLAUDE_PLUGIN_ROOT}/mcp/run.sh`（启动该服务器的 shell 脚本） | 三处都展开为插件目录 |
| 服务器的工作目录 | 服务器日志 | 会话的工作目录 |
| 远程服务器 | `{ "type": "http", "url": ..., "headers": {...} }` | 列在会话初始化信息中，状态为 `failed`（地址不可达），即配置被读取 |
| 服务器与工具名 | 会话初始化信息；让模型调用该工具 | 服务器为 `plugin:<插件名>:<服务器名>`，工具为 `mcp__plugin_<插件名>_<服务器名>__<工具名>`；模型读到标记文本 |
| agent 的 frontmatter | 一个 agent 含 `targets` 键，另一个的 `name` 与文件名不同；`validate --strict` | 通过；会话初始化信息按 frontmatter 的 `name` 列出 `<插件名>:<name>` |

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

```bash
claude -p "<提示>" --plugin-dir ./after-tool-probe --permission-mode default --allowedTools Read --output-format stream-json --verbose
```
