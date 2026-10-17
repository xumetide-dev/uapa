# agy 实测记录

本文记录调研中依赖实测的 agy 行为，供复现。「本地实测」一节为 agy 1.3.4，于 2026-10-14 在 macOS
上实测；其余各节为 agy 1.3.5，于 2026-10-14～2026-10-17 在 Linux 测试容器中实测。文档与更新日志
的结论见 [agy 插件机制](agy-plugins.md)。测试插件均为最小示例，提示只要求运行标记命令。

## 本地实测

环境：agy 1.3.4，macOS，2026-10-14；模型 `gemini-3.8-flash-low`。做法：在临时目录建一个只含
`plugin.json`、一个 skill 与 `hooks.json` 的插件，`hooks.json` 在 `SessionStart`、`PreToolUse`
（`matcher` 为 `""`，`timeout` 为 3）、`PostToolUse`、`Stop` 上运行同一个 Node 脚本；脚本把 stdin、
工作目录与环境变量名追加到日志，`PreToolUse` 按命令中的标记返回不同的决策或退出方式，`Stop`
第一次返回 `continue`。以 `agy plugin install <目录>` 安装后，用打印模式运行两次会话，让代理逐个
调用工具，再核对日志与工作区中的文件，最后 `agy plugin uninstall` 卸载。

```bash
agy plugin install ./uapa-probe
```

```bash
agy --model gemini-3.8-flash-low --dangerously-skip-permissions -p "Use only the run_command tool ..."
```

- 本机全局 `hooks.json` 另有一个对全部工具返回 `ask` 的 `PreToolUse` hook，两处的 hooks 都加载；
  在 `--dangerously-skip-permissions` 下，插件返回 `allow` 的调用照常执行。
- 卸载后 `~/.gemini/config/` 中留下安装时创建的 `import_manifest.json` 与空的 `plugins/` 目录。
- 未测：Windows、`.gemini-plugin/` 中的 manifest 与 `PreToolUse` 输出为空。`Stop` 的超时与输出无法
  解析见下文「`Stop` 的超时与无效输出（1.3.5，容器）」，继续的次数上限见「v0.4.0 覆盖审查
  （1.3.5，容器）」，`.antigravity-plugin/plugin.json` 与含 `.claude-plugin/` 的合并目录见
  「替代 manifest 位置与合并目录（1.3.5，容器）」。

## agents 与 MCP 服务器（1.3.5，容器）

环境：测试容器中的 agy 1.3.5（Linux），2026-10-14；模型 `gemini-3.8-flash-high`。插件含两个
agent（一个 frontmatter 含 `targets`，另一个的 `name` 与文件名不同）与 `mcp_config.json` 中的
三个服务器：`relative` 的 `args` 为 `./mcp/server.mjs`，`env` 的值为相对路径；`extpath` 的 `args`
为 `${extensionPath}/mcp/server.mjs`；`remote` 写 `serverUrl`（不存在的本地地址）与 `headers`。
本地服务器为最小 stdio 服务器，只响应初始化、工具列表与一个返回标记文本的工具，启动时把工作
目录、参数与环境变量追加到日志。安装后运行一次打印模式会话，结束后卸载。

| 项目 | 结果 |
|---|---|
| 安装 | `agy plugin install` 报告处理了 2 个 agents 与 3 个 mcpServers；`agy plugin list --json` 按文件名列出 agents，按配置名列出服务器 |
| 相对路径的服务器 | 以 `<插件名>_relative` 连接，模型调用工具后读到标记文本；服务器的工作目录为安装后的插件目录，`env` 的相对路径未展开 |
| `${extensionPath}` | 日志中只有 `relative` 一次启动记录，该服务器未能启动；据此推断 `args` 中的变量未展开（未核实）。`command` 中的变量见本文「v0.4.0 覆盖审查（1.3.5，容器）」 |
| 子代理 | 会话列出两个子代理，名称为 frontmatter 的 `name` |

## UAPA 夹具产物（1.3.5，容器）

2026-10-15，测试容器中的 agy 1.3.5；模型 `gemini-3.8-flash-high`。产物为夹具期望树中插件目录的
副本，以 `agy plugin install` 安装，打印模式运行会话（`--dangerously-skip-permissions`），结束后
卸载；提示只要求运行标记命令。

| 项目 | 做法 | 结果 |
|---|---|---|
| 拒绝 | `full` 产物，要求运行 `echo uapa-deny-probe > deny.txt` | 命令不执行，`deny.txt` 不存在；模型读到 `tool call denied by pre-tool hook: 拒绝标记命令 uapa-deny-probe` |
| 改写 | 要求运行 `echo uapa-rewrite-probe x > rewrite.txt` | `rewrite.txt` 的内容为 `uapa-rewritten x` |
| 停机继续 | 同一会话；副本在 UAPA 的 `Stop` hook 之后另挂记录用的 hook | 模型作答三次（继续两次）后结束，计数文件归零；记录用的 hook 只在最后一次停机时运行，stdin 含 `conversationId`、`terminationReason`、`transcriptPath` 等字段，工作目录为安装后的插件目录 |
| agents 与 MCP 服务器 | `components` 产物，`mcp/` 中另放桩服务器 | 安装报告 2 个 agents 与 3 个 mcpServers（`launcher` 已由 UAPA 跳过）；会话列出子代理 `agy-helper`、`reviewer` 与服务器 `components_docs`；桩服务器的工作目录为安装后的插件目录，`./mcp/server.mjs` 按它解析，`UAPA_DATA` 原样为 `./data` |
| `agents.json` 并存 | 插件含 `agents/a.md` 与 `extra/b.md`，`agents.json` 分别写 `[{"path": "extra"}]`、`{"agents": [{"path": "extra"}]}` 与 `["extra"]` | 三种写法下会话都只列出 `agents/a.md` 的子代理；`agy plugin list --json` 同样只列出 `a.md`（这三种写法都不是 agy 的格式） |
| rules：`always_on` | `rules-commands` 产物；提示不调用工具，要求逐字引用适用的规则 | 回复引用 `回复使用中文，代码标识符保持英文。`，并以中文作答 |
| rules：`model_decision` | 提示为设计 HTTP API，允许读取规则文件 | 模型读取 `api-design.md` 并引用正文（`路径用名词复数`、`错误响应含 code 与 message`） |
| rules：`glob`（修正前） | `globs: "*.ts,src/**/*.tsx"`；分别读取 `a.ts` 与 `src/ui/b.tsx` 后要求引用适用的规则 | 读取 `a.ts` 后规则正文出现；读取 `src/ui/b.tsx` 后不出现，原因见本文「rules（1.3.5，容器）」中的路径匹配 |
| rules：`glob`（修正后） | `globs: "*.ts,**/src/**/*.tsx"`；同上，另有读取 `c.txt` 的对照会话 | 读取 `a.ts` 与 `src/ui/b.tsx` 后规则正文都出现，对照会话中不出现。读取 `src/ui/b.tsx` 的会话给出回复后进程未退出，结束该进程后测试继续 |
| `agents.json` 的 `entries` | 三个插件各含 `agents/uapa-probe-a<n>.md` 与 `extra/` 下的 `uapa-probe-b<n>.md`、`uapa-probe-c<n>.md`；`agents.json` 分别写 `{"entries": [{"path": "extra"}]}`、加 `"include_only": ["uapa-probe-b2"]`（子代理名）与 `"include_only": ["uapa-probe-b3.md"]`（文件名） | 会话列出 `a1`～`a3`、`b1`～`b3` 与 `c1`（省略前缀 `uapa-probe-`），不列 `c2`、`c3`：`entries` 中的目录被加载，`include_only` 按两种写法都只保留命中的项；`agy plugin list --json` 只列出 `a1`～`a3` |

## `Stop` 的超时与无效输出（1.3.5，容器）

2026-10-15，测试容器中的 agy 1.3.5；模型 `gemini-3.8-flash-high`。探测插件只在 `Stop` 上挂一个
`timeout` 为 3 的 hook，脚本记录每次调用的 stdin 与时刻，按模式文件等待 10 秒后返回
`{"decision":"continue","reason":"uapa-stop-probe"}`，或立即输出非 JSON 文本 `uapa-not-json`。
提示只要求回复 `ok`、不调用工具。

| 情况 | 结果 |
|---|---|
| 超时 | hook 开始后约 4.7 秒 agy 退出，回复 `ok`，`Stop` 只被调用一次：本轮照常结束，10 秒后的 `continue` 未被采用。agy 退出后 hook 进程仍在运行，按时写出结束记录 |
| stdout 不是 JSON | `Stop` 只被调用一次，本轮照常结束，stderr 无输出 |

## rules（1.3.5，容器）

2026-10-15，测试容器中的 agy 1.3.5；模型 `gemini-3.8-flash-high`。探测插件只含 `plugin.json` 与
`rules/` 下的若干规则，每条规则的正文要求“被问到探测词时包含 `uapa-rule-<标记>`”。以
`agy plugin install` 安装后用打印模式提问“列出规则要求包含的探测词”，结束后卸载。需要读文件的
用例先在工作目录放置匹配的文件，并在提示中要求先读取它们。

| 规则的 frontmatter | 结果 |
|---|---|
| `trigger: always_on` | 探测词出现在回复中：规则正文进入上下文 |
| `trigger: always_on`，另有 `description` 与文档未列的 `targets` | 同上，额外的键不影响加载 |
| 没有 frontmatter | 探测词不出现 |
| `trigger: model_decision` 与 `description` | 不允许调用工具时，模型报告能看到该规则但未应用；允许读文件且 `description` 与提示相关时，模型读取规则并给出探测词 |
| `trigger: glob`，`globs: "*.uapaprobe"` | 读取匹配的文件之后探测词出现；没有读取匹配文件的对照会话中不出现 |
| `trigger: glob`，`globs` 为逗号分隔的字符串（`"*.a,*.b"` 与 `"*.a, *.b"`） | 读取匹配其中一个模式的文件后，两种写法的探测词都出现 |
| `trigger: glob`，`globs` 为 YAML 列表 | 读取匹配的文件后探测词仍不出现 |
| `trigger: glob`，含目录的模式；读取工作区中的 `src/ui/b.tsx` | 生效：`*.tsx`、`**/*.tsx`、`**/b.tsx`、`**/src/**/*.tsx`、`**/src/ui/*.tsx`、`/tmp/**/b.tsx`，以及以工作区目录名开头的 `**/<目录名>/src/**/*.tsx`；不生效：`src/**/*.tsx`、`src/ui/*.tsx`、`ui/*.tsx`、`*.md,src/**/*.tsx`、`<目录名>/src/ui/b.tsx`。同一组规则在另一工作区目录中重跑，只有含原目录名的模式改为不生效 |
| `trigger: manual` 与 `description` | 打印模式的提示以 `@<规则文件名>` 开头时探测词不出现；交互式会话中的引用方式未测 |

- `globs` 按被读文件的绝对路径匹配：不含 `/` 的模式匹配文件名，含 `/` 的模式须匹配整个绝对路径。
  按工作区相对路径写的模式（如 `src/**/*.tsx`）不生效，写为 `**/src/**/*.tsx` 时生效。
- `agy plugin install` 与 `agy plugin validate` 的输出只列 skills、agents、commands、mcpServers、
  hooks，不报告 rules；`agy plugin list --json` 的 `rules` 列出 `rules/` 下的全部文件名。
- agy 内嵌的说明文字写明 `model_decision` 规则与 skill 类似，只有 `always_on` 的规则始终进入上下文。

## v0.4.0 覆盖审查（1.3.5，容器）

2026-10-15，测试容器中的 agy 1.3.5；模型 `gemini-3.8-flash-high`。探测插件 `uapa-agy-probe` 含：

- `skills/probe-cmd`（正文要求回复 `AGY-CMD-PROBE [$ARGUMENTS]`）与 `skills/auto-probe`
  （`description` 为“用户询问 agy auto probe marker 时使用”，正文给出标记词）。
- `commands/raw-cmd.md`（有 `description`，正文要求回复固定标记）。
- `agents/probe-agent.md`（运行调用方给出的命令并报告输出）。
- `hooks.json`：`PreToolUse`（`matcher` 为 `""`）与 `Stop` 运行同一个记录脚本，记录工具名、会话 id、
  `PLUGIN_DATA` 与 `PLUGIN_ROOT` 是否存在、工作目录；`Stop` 按环境变量设定的次数返回 `continue`。
- `mcp_config.json` 中的三个本地服务器：`args`（`command` 为 `node`，`args` 为 `./mcp.mjs`）、`ext`
  （`command` 为 `${extensionPath}/mcp-launch.sh`）、`proot`（`command` 为
  `${PLUGIN_ROOT}/mcp-launch.sh`）。
  服务器启动时只记录标记变量 `UAPA_PROBE_ENV` 是否存在与工作目录，不记录变量的值。

会话前在 shell 中导出 `UAPA_PROBE_ENV`，以 `agy plugin install` 安装，每项在新的临时工作目录中以
打印模式运行（`--dangerously-skip-permissions`），结束后卸载。提示只要求运行标记命令。

| 项目 | 做法 | 结果 |
|---|---|---|
| 安装 | `agy plugin install` | 输出 `commands : 1 processed (converted to skills)`；`agy plugin list --json` 的 `skills` 只列 `skills/` 下的两项 |
| skill 的斜杠命令与参数 | 提示为 `/uapa-agy-probe:probe-cmd alpha beta` | 回复 `AGY-CMD-PROBE [alpha beta]`：`$ARGUMENTS` 替换为命令之后的文本 |
| `commands/` 的命令 | 提示为 `/uapa-agy-probe:raw-cmd` | 回复命令正文要求的标记 |
| skill 的自动选用 | 提示询问标记词，不提 skill 名，不允许运行 shell 命令 | 回复 `auto-probe` 正文中的标记词：模型按 `description` 选用了该 skill |
| MCP `command` 中的变量 | 三个服务器 | 只有 `args` 启动；`ext` 与 `proot` 没有启动记录：`command` 中的 `${extensionPath}` 与 `${PLUGIN_ROOT}` 都不展开 |
| MCP 服务器的环境 | 同上 | `args` 的进程中有 `UAPA_PROBE_ENV`（未在 `env` 中声明）与 `PLUGIN_ROOT`，工作目录为安装后的插件目录 |
| hook 进程的环境 | 全部会话的 `PreToolUse` 与 `Stop` 调用 | `PLUGIN_DATA` 与 `PLUGIN_ROOT` 都不存在，工作目录为安装后的插件目录 |
| 插件 agent 中的 hooks | 要求把运行 `echo uapa-subagent-probe` 交给 `probe-agent` | 主会话的 `PreToolUse` 记录 `invoke_subagent`；子代理的会话（另一个会话 id）中 `PreToolUse` 记录 `view_file` 8 次与 `send_message` 1 次，`Stop` 触发 1 次；日志中没有 `run_command`，子代理的回复中有标记命令的输出，是否实际运行了命令未能确认 |
| `/btw` | 提示为 `/btw what is 2 plus 2` | 退出码 2，报告打印模式不支持 `/btw`；未测 |
| 停机继续的上限 | `Stop` 每次返回 `continue`（设定最多 12 次），提示只要求回复一个词 | `Stop` 被调用 11 次，前 10 次的 `continue` 被采用，第 11 次返回的 `continue` 未被采用，本轮结束 |

- 未测：内置子代理（如 research）与 `inheritCustomizations: false` 的自定义代理中的 hooks；交互式
  会话中的 `/btw`；插件 MCP 工具的调用是否触发 `PreToolUse`；`args` 中 `${PLUGIN_ROOT}` 的展开。

## 替代 manifest 位置与合并目录（1.3.5，容器）

2026-10-17，测试容器中的 agy 1.3.5；模型 `gemini-4-argon-medium`。分别构造三个探测目录，以
`agy plugin validate`、`agy plugin install`、`agy plugin list --json` 与打印模式会话验证，结束后
卸载：

- 目录 A（只含 `.antigravity-plugin/plugin.json`，无根 `plugin.json`）：含 `skills/s1/SKILL.md`、
  `agents/a1.md`、`commands/c1.md`、`rules/always.md`、根 `mcp_config.json` 与根 `hooks.json`。
- 目录 B（三宿主合并目录，无根 `plugin.json`）：同时含 `.claude-plugin/plugin.json`、
  `.codex-plugin/plugin.json`、`.antigravity-plugin/plugin.json`、`skills/s1/SKILL.md` 与根
  `hooks.json`（`PreToolUse` 运行记录 stdin 的脚本并返回 `{"decision":"allow"}`）。
- 目录 C（含 `.claude-plugin/plugin.json` 与根 `plugin.json`）：将目录 B 的
  `.antigravity-plugin/plugin.json` 移至根 `plugin.json`。

| 项目 | 做法 | 结果 |
|---|---|---|
| 仅 `.antigravity-plugin/plugin.json` 的校验与安装 | 对目录 A 运行 `agy plugin validate` 与 `agy plugin install` | 两个命令均输出 `skills : 1 processed`、`agents : 1 processed`、`commands : 1 processed (converted to skills)`、`mcpServers : 1 processed`、`hooks : 1 processed`；`agy plugin list --json` 的 `source` 为 `"antigravity"`，`rules` 列出 `["always.md"]`，安装目录中保留 `.antigravity-plugin/plugin.json` |
| 三宿主合并目录的校验与安装 | 对目录 B 运行 `claude plugin validate --strict`、`agy plugin validate` 与 `agy plugin install` | Claude Code 与 agy 校验均通过；`agy plugin list --json` 的 `source` 为 `"antigravity"`，列出 `skills` 与 `hooks`，未把含 `.claude-plugin/` 的目录按 Claude Code 插件转换 |
| 三宿主合并目录的会话与 `workspacePaths` | 在临时工作区目录中运行 `agy -p` 触发 `run_command`（只运行 `echo uapa-merged-probe-ok`） | 根 `hooks.json` 的 `PreToolUse` 触发，stdin 的 `workspacePaths` 为 `["<临时工作区目录>"]`（`workspacePaths[0]` 与 `toolCall.args.Cwd` 同为会话工作目录） |
| 根 `plugin.json` 与 `.claude-plugin/` 并存 | 对目录 C 运行 `agy plugin validate` 与 `agy plugin install` | `agy plugin list --json` 的 `source` 同样为 `"antigravity"`，列出 `skills` 与 `hooks` |

