# Antigravity CLI（agy）插件：开发方式与 manifest

本文说明 Google Antigravity CLI（命令 `agy`）插件的 manifest、组件位置、安装命令与 hooks 的配置
结构和控制语义。官方文档以 `antigravity.google/docs` 为准，核对日期为 2026-10-14；文档未写明的
行为以 agy 1.3.4 的本地实测补充，agents 与 MCP 服务器以 1.3.5 的容器实测补充，见「本地实测」
一节。

## 版本背景

- Antigravity 有桌面应用、IDE 与 CLI 三种形态，共用 `~/.gemini/config/` 下的全局配置：
  `hooks.json`、`mcp_config.json`、`plugins/` 等 [A1][A2]。CLI 自身的数据目录为
  `~/.gemini/antigravity-cli/`（对话记录、日志、设置）。
- 插件机制在 1.3.x 中仍在变化：1.3.2 加入插件管理命令、manifest 的替代位置、`skills` 字段、
  `PLUGIN_DATA` 与 `bin/`，1.3.3 加入根 `agents.json` [A3]。引用前以当前版本的文档与更新日志为准。

## 插件 manifest

插件根目录的 `plugin.json` 为必需文件 [A1]；1.3.2 起 manifest 也可放在 `.antigravity-plugin/` 或
`.gemini-plugin/` 目录中 [A3]。

| 字段 | 必填 | 含义 |
|---|---|---|
| `name` | CLI 必填（应用与 IDE 缺省为目录名） | 匹配 `^[a-zA-Z0-9-_]+$` |
| `description` | 否 | 插件列表中的说明 |
| `$schema` | 否 | 文档给出 `https://antigravity.google/schemas/v1/plugin.json`，2026-10-14 访问返回 404 |

- 文档所列 schema 设 `additionalProperties: false`，不允许其他字段 [A1]；1.3.2 的更新日志另记载
  可在 `plugin.json` 中列出 skills（`skills` 字段），文档未给出写法 [A3]。
- 插件目录中的 skills 无需在 manifest 中声明，`skills/` 下的每个 skill 都会加载 [A3]。

## 组件

| 组件 | 位置 | 依据 |
|---|---|---|
| skills | `skills/<name>/SKILL.md` | [A1] |
| 子代理 | `agents/<name>.md`，frontmatter 必填 `name` 与 `description`；1.3.3 起另可用根 `agents.json` 声明 | [A1][A3] |
| rules | `rules/<name>.md`；frontmatter 的 `trigger` 决定是否进入上下文，见下文「rules（1.3.5，容器）」 | [A1] |
| MCP 服务器 | 根 `mcp_config.json` | [A1] |
| hooks | 根 `hooks.json` | [A1] |
| 命令行工具 | `bin/`，代理可按名称运行 | [A3] |

- 插件没有斜杠命令组件 [A1]。
- 插件中的 MCP 服务器以 `<插件名>_<服务器名>` 命名，避免与其他插件冲突 [A3]。`mcp_config.json`
  的顶层键为 `mcpServers`；本地服务器写 `command`、`args`、`env`、`cwd`，远程服务器写
  `serverUrl` 与 `headers`，不支持 `url`、`httpUrl` [A4]。文档没有说明插件 MCP 配置中的变量是否
  展开，也没有插件根目录变量。1.1.28 起插件中本地服务器的 `cwd` 为相对路径或未写时按插件目录
  解析 [A3]；1.3.5 的服务器以安装后的插件目录为工作目录，`args` 中的相对路径可用，`env` 的值
  原样传入（容器实测）。
- 1.3.5 的会话中子代理的名称取 frontmatter 的 `name`，与文件名无关；frontmatter 含 `targets`
  等文档未列的键时照常加载（容器实测）。根 `agents.json` 与 `skills.json`、`rules.json` 格式相同
  （agy 内嵌文档）：顶层 `entries` 为目录条目数组，条目写 `path` 与可选的 `include_only`、
  `exclude`，目录只扫描一层。1.3.5 中以该格式声明的子代理与 `agents/*.md` 一起加载，
  `include_only` 写子代理名或文件名都只加载命中的项；`agy plugin list --json` 不列出这些子代理
  （容器实测，见下文）。
- 1.3.2 的更新日志称每个插件有数据目录，以 `PLUGIN_DATA` 提供 [A3]；1.3.4 的 hook 进程环境中
  没有该变量（本地实测）。1.3.5 的 MCP 服务器进程环境中有 `PLUGIN_ROOT`（插件目录）与
  `PLUGIN_DATA`（`~/.gemini/antigravity-cli/plugin_data/<插件名>`）（容器实测）。

## 安装与管理

- 会话内命令 `/plugin`（别名 `/plugins`）：`install <名称>@antigravity-plugins-official`、
  `install <本地路径>`、`enable`、`disable`、`uninstall`、`list` [A1]。
- 命令行：`agy plugin install <marketplace 名称 | GitHub 仓库 URL | 本地目录>`、
  `agy plugin list [--json]`、`agy plugin enable|disable|uninstall <名称>`；另有
  `agy plugin import [gemini|claude]` 与 `agy plugin validate [path]`
  （`agy plugin --help`）。
- 安装位置：文档写全局为 `~/.gemini/config/plugins/`，工作区为项目根的 `.agents/plugins/` [A1]。
  1.3.4 的 `agy plugin install <本地目录>` 把目录复制到 `~/.gemini/config/plugins/<name>/`（本地
  实测）。直接放进 `~/.gemini/config/plugins/` 的插件默认禁用，需要启用 [A3]。
- 全局安装的插件对本机该用户的所有 agy 会话生效，hooks 也是（本地实测）。
- `agy plugin validate` 只报告各组件是否找到：插件名含空格与 `!`、`plugin.json` 含多余字段、
  `hooks.json` 结构错误或无法解析时，都输出 `[ok]` 且以退出码 0 结束（本地实测）。它不能作为
  manifest 与 hooks 的校验手段。

## Hooks

插件的 hooks 写在根 `hooks.json` 中，与全局 `~/.gemini/config/hooks.json` 同构，两处同时加载 [A2]。
顶层键是 hook 定义的名称，值为该定义的各事件：

```json
{
  "my-guard": {
    "PreToolUse": [{
      "matcher": "",
      "hooks": [
        { "type": "command", "command": "node hooks/guard.mjs before-tool", "timeout": 30 }
      ]
    }],
    "Stop": [
      { "type": "command", "command": "node hooks/guard.mjs before-stop", "timeout": 30 }
    ]
  }
}
```

- hook 定义可写 `enabled`（默认 `true`）[A2]。
- `PreToolUse`、`PostToolUse` 的数组元素为 `{ matcher, hooks }`，`matcher` 为正则，`""` 或 `"*"`
  匹配全部工具；`SessionStart`、`PreInvocation`、`PostInvocation`、`Stop` 的数组元素直接是处理器，
  不使用 matcher [A2]。
- 处理器字段：`type`（只支持 `"command"`）、`command`（必填）、`timeout`（秒，默认 30）[A2]。
- 事件共 6 个：`SessionStart`、`PreToolUse`、`PostToolUse`、`PreInvocation`、`PostInvocation`、
  `Stop`；没有提示提交事件，也没有会话结束事件 [A2]。
- 命令的工作目录为 `hooks.json` 所在目录，即安装后的插件目录；hook 进程环境中有
  `ANTIGRAVITY_CONVERSATION_ID`，没有插件根目录与插件数据目录变量（本地实测）。命令是否经
  shell 执行文档未写明。

### 输入

stdin 为 camelCase 字段的 JSON [A2]：

| 事件 | 字段 |
|---|---|
| 全部 | `conversationId`、`workspacePaths`、`transcriptPath`、`artifactDirectoryPath`、`modelName` |
| `PreToolUse` | `toolCall.name`、`toolCall.args`、`stepIdx` |
| `PostToolUse` | 同 `PreToolUse`，另有 `error`；不含工具输出 |
| `Stop` | `executionNum`、`terminationReason`、`error`、`fullyIdle` |

`toolCall.args` 的键为 PascalCase（本地实测）：

| 工具 | 主要入参 |
|---|---|
| `run_command` | `CommandLine`、`Cwd`、`IsDaemon`、`WaitMsBeforeAsync` |
| `view_file` | `AbsolutePath` |
| `write_to_file` | `TargetFile`、`CodeContent`、`Overwrite`、`Description` |
| `replace_file_content` | `TargetFile`、`TargetContent`、`ReplacementContent`、`StartLine`、`EndLine`、`AllowMultiple` |

各工具的入参另含 `toolAction`、`toolSummary` 两个说明字段。

### 输出

| 事件 | stdout JSON | 依据 |
|---|---|---|
| `PreToolUse` | `decision` 必填：`allow`、`auto_approve`、`deny`、`ask`、`force_ask`、`deny_unless_prior_grant`；可选 `reason`、`overwrite`、`permissionOverrides` | [A2] |
| `PostToolUse` | `{}`，不能阻断或替换输出 | [A2] |
| `Stop` | `decision` 为 `"continue"` 时不结束本轮，`reason` 作为系统消息注入；其他取值结束 | [A2] |
| `SessionStart`、`PreInvocation` | 可选 `injectSteps` | [A2] |
| `PostInvocation` | 可选 `injectSteps`、`terminationBehavior` | [A2] |

- `overwrite` 按键浅合并进 `toolCall.args`，工具结果前会附加一条说明，列出被改写的键 [A2]。
- 退出码、stderr、超时与失败时的处理文档未写明 [A2]，本地实测结果：

| 情况 | `PreToolUse` | `Stop` |
|---|---|---|
| `decision: "deny"` | 阻断，模型看到 `tool call denied by pre-tool hook: <reason>` | 不适用 |
| 退出码 1 或 2 | 阻断，模型看到退出码与 stderr | 退出码 1：记录错误，本轮照常结束 |
| 超时 | 进程被终止，阻断 | 本轮照常结束，不采用超时后的输出；hook 进程不被终止 |
| stdout 不是 JSON | 阻断 | 本轮照常结束 |
| `{"decision":"continue","reason":...}` | 不适用 | 不结束，`executionNum` 由 0 变为 1 |
| `{}` | 未测 | 结束 |

### 扩展能力摘要

| 能力 | 支持情况 | 依据 |
|---|---|---|
| 阻断 | `PreToolUse` 返回 `decision: "deny"` | [A2]；本地实测 |
| 失败时的默认行为 | `PreToolUse` 出错、超时或输出无法解析时阻断；`Stop` 出错、超时或输出无法解析时照常结束 | 本地实测 |
| 执行前改写工具入参 | `overwrite` | [A2]；本地实测 |
| 执行后替换工具输出 | 不支持 | [A2] |
| 停机门禁 | `Stop` 返回 `decision: "continue"`；文档未写明次数上限 | [A2]；本地实测 |
| 提示提交前检查 | 没有提示提交事件 | [A2] |
| 进程内扩展 | 不支持 | [A1] |

## 工具名

`PreToolUse` 的 matcher 与 stdin `toolCall.name` 使用的内置工具名 [A2]：

| 类别 | 工具名 |
|---|---|
| 文件与目录 | `view_file`、`write_to_file`、`replace_file_content`、`multi_replace_file_content`、`list_dir`、`find_by_name` |
| 搜索 | `grep_search`、`search_web`、`read_url_content` |
| 执行 | `run_command`、`manage_task`、`schedule`、`list_permissions`、`ask_permission` |
| 子代理 | `invoke_subagent`、`define_subagent`、`send_message`、`manage_subagents` |
| 交互与媒体 | `ask_question`、`generate_image` |

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
- 未测：Windows、`.antigravity-plugin/` 与 `.gemini-plugin/` 中的 manifest、`PreToolUse` 输出为空、
  `Stop` 继续的次数上限，以及插件目录同时含 `.claude-plugin/` 时安装命令的处理。`Stop` 的超时与
  输出无法解析见下文「`Stop` 的超时与无效输出（1.3.5，容器）」。

### agents 与 MCP 服务器（1.3.5，容器）

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
| `${extensionPath}` | 日志中只有 `relative` 一次启动记录，该服务器未能启动；据此推断变量未展开（未核实） |
| 子代理 | 会话列出两个子代理，名称为 frontmatter 的 `name` |

### UAPA 夹具产物（1.3.5，容器）

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
| `agents.json` 的 `entries` | 三个插件各含 `agents/uapa-probe-a<n>.md` 与 `extra/` 下的 `uapa-probe-b<n>.md`、`uapa-probe-c<n>.md`；`agents.json` 分别写 `{"entries": [{"path": "extra"}]}`、加 `"include_only": ["uapa-probe-b2"]`（子代理名）与 `"include_only": ["uapa-probe-b3.md"]`（文件名） | 会话列出 `a1`～`a3`、`b1`～`b3` 与 `c1`（省略前缀 `uapa-probe-`），不列 `c2`、`c3`：`entries` 中的目录被加载，`include_only` 按两种写法都只保留命中的项；`agy plugin list --json` 只列出 `a1`～`a3` |

### `Stop` 的超时与无效输出（1.3.5，容器）

2026-10-15，测试容器中的 agy 1.3.5；模型 `gemini-3.8-flash-high`。探测插件只在 `Stop` 上挂一个
`timeout` 为 3 的 hook，脚本记录每次调用的 stdin 与时刻，按模式文件等待 10 秒后返回
`{"decision":"continue","reason":"uapa-stop-probe"}`，或立即输出非 JSON 文本 `uapa-not-json`。
提示只要求回复 `ok`、不调用工具。

| 情况 | 结果 |
|---|---|
| 超时 | hook 开始后约 4.7 秒 agy 退出，回复 `ok`，`Stop` 只被调用一次：本轮照常结束，10 秒后的 `continue` 未被采用。agy 退出后 hook 进程仍在运行，按时写出结束记录 |
| stdout 不是 JSON | `Stop` 只被调用一次，本轮照常结束，stderr 无输出 |

### rules（1.3.5，容器）

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
- 文档 [A5]：`trigger` 取 `always_on`、`model_decision`、`glob`、`manual`，缺少 frontmatter 或取值
  无法识别的规则被忽略；`globs` 为逗号分隔的字符串；单个规则文件上限 24,000 字节，超出部分截断；
  全局规则与 `always_on` 规则共用 20,000 token 的预算，超出时较大的文件只保留路径与 `description`。
- 1.3.2 的更新日志记载以 `/plugin` 安装插件时可以“在表单中填写插件需要的设置” [A3]；文档没有
  说明这些设置的声明方式，也没有说明取值是否传给 hook 进程，未实测。

## 来源

- [A1] Plugins：<https://antigravity.google/docs/plugins/>
- [A2] Hooks：<https://antigravity.google/docs/hooks/>
- [A3] Antigravity CLI CHANGELOG（1.1.28、1.2.2、1.2.11、1.3.2、1.3.3）：
  <https://github.com/google-antigravity/antigravity-cli/blob/main/CHANGELOG.md>
- [A4] MCP：<https://antigravity.google/docs/mcp/>
- [A5] Rules：<https://antigravity.google/docs/rules>
