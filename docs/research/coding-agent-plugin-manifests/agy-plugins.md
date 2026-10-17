# Antigravity CLI（agy）插件：开发方式与 manifest

本文说明 Google Antigravity CLI（命令 `agy`）插件的 manifest、组件位置、安装命令与 hooks 的配置
结构和控制语义。官方文档以 `antigravity.google/docs` 为准，核对日期为 2026-10-14；文档未写明的
行为以 agy 1.3.4 的本地实测补充，agents、MCP 服务器、rules、commands、替代 manifest 位置与合并目录以 1.3.5 的容器实测补充，见「本地实测」
一节。

## 版本背景

- Antigravity 有桌面应用、IDE 与 CLI 三种形态，共用 `~/.gemini/config/` 下的全局配置：
  `hooks.json`、`mcp_config.json`、`plugins/` 等 [A1][A2]。CLI 自身的数据目录为
  `~/.gemini/antigravity-cli/`（对话记录、日志、设置）。
- 插件机制在 1.3.x 中仍在变化：1.3.2 加入插件管理命令、manifest 的替代位置、`skills` 字段、
  `PLUGIN_DATA` 与 `bin/`，1.3.3 加入根 `agents.json` [A3]。引用前以当前版本的文档与更新日志为准。
- 最新版本为 1.3.5（2026-10-14 发布），相对 1.3.4 没有插件相关的变更 [A3]。本文的会话实测以
  1.3.5 为准，标为“本地实测”的早期结论为 1.3.4。官方文档站 changelog 页的 CLI 部分只写到 1.3.1。

## 插件 manifest

插件根目录的 `plugin.json` 为必需文件 [A1]；1.3.2 起 manifest 也可放在 `.antigravity-plugin/` 或
`.gemini-plugin/` 目录中 [A3]。1.3.5 容器实测：只含 `.antigravity-plugin/plugin.json`（无根
`plugin.json`）的目录，以及同时含 `.claude-plugin/plugin.json`、`.codex-plugin/plugin.json` 与
`.antigravity-plugin/plugin.json`（或根 `plugin.json`）的合并目录，经 `agy plugin install` 安装后
`source` 均为 `"antigravity"`，skills、agents、commands、rules、MCP 服务器与根 `hooks.json` 照常
加载，见[实测记录「替代 manifest 位置与合并目录（1.3.5，容器）」](agy-local-tests.md#替代-manifest-位置与合并目录135容器)。

UAPA 生成 manifest 时的路径规范（F-11-15，SD-47）：单宿主独立目录默认写根 `plugin.json`；多宿主
合并目录默认写 `.antigravity-plugin/plugin.json`（避免与 Codex 根 `plugin.json` 优先规则冲突导致
Codex 忽略 hooks）；同时支持通过 `hosts.agy.manifest` 自定义清单路径（可显式指定为 `'plugin.json'`
或 `'.antigravity-plugin/plugin.json'`）。

| 字段 | 必填 | 含义 |
|---|---|---|
| `name` | CLI 必填（应用与 IDE 缺省为目录名） | 匹配 `^[a-zA-Z0-9-_]+$` |
| `description` | 否 | 插件列表中的说明 |
| `$schema` | 否 | 文档给出 `https://antigravity.google/schemas/v1/plugin.json`，2026-10-14 访问返回 404 |

- 文档所列 schema 设 `additionalProperties: false`，不允许其他字段 [A1]；1.3.2 的更新日志另记载
  可在 `plugin.json` 中列出 skills（`skills` 字段），文档未给出写法 [A3]。
- 插件目录中的 skills 无需在 manifest 中声明，`skills/` 下的每个 skill 都会加载 [A3]。
- 更新日志另记载 manifest 可写 `"disabled": true` 作为初始启用状态（1.1.11），`agy plugin list`
  显示插件版本（1.3.4）[A3]；文档的 schema 没有这些字段，未实测。

## 组件

| 组件 | 位置 | 依据 |
|---|---|---|
| skills | `skills/<name>/SKILL.md` | [A1] |
| 子代理 | `agents/<name>.md`，frontmatter 必填 `name` 与 `description`；1.3.3 起另可用根 `agents.json` 声明 | [A1][A3] |
| rules | `rules/<name>.md`；frontmatter 的 `trigger` 决定是否进入上下文，见[实测记录「rules（1.3.5，容器）」](agy-local-tests.md#rules135容器) | [A1] |
| commands | `commands/<name>.md`，安装时由宿主转换为技能，以 `/<插件名>:<命令名>` 调用，正文 `$ARGUMENTS` 替换为参数 | [A3]；容器实测 |
| MCP 服务器 | 根 `mcp_config.json` | [A1] |
| hooks | 根 `hooks.json` | [A1] |
| 命令行工具 | `bin/`，代理可按名称运行 | [A3] |

- UAPA 的 `agy:subprocess` 目标支持承载全部 6 类组件：`skills`、`agents`、`mcp`、`hooks`、
  `rules` 与 `commands`（F-11-01、F-11-06～F-11-09，SD-30、SD-32、SD-39）。源项目的 `commands/`
  原样复制进插件包，由宿主在安装时转换为技能；`rules/` 换算为 frontmatter `trigger` 与逗号分隔
  的 `globs`。
- 每个 skill 自动成为斜杠命令 [A6]，插件 skill 的命令为 `/<插件名>:<skill>`（1.2.7 修复了双前缀）；
  打印模式中以 `/<skill>` 开头的提示展开该 skill（1.1.9）；frontmatter 写
  `disable-slash-command: true` 时不进入 `/` 菜单（1.1.12）[A3]。`agy plugin import gemini` 把
  Gemini CLI 扩展的命令转换为 skills [A9]。1.3.5 安装插件时把 `commands/` 下的命令转换为 skills，
  以 `/<插件名>:<命令名>` 调用（容器实测，见
  [实测记录「v0.4.0 覆盖审查（1.3.5，容器）」](agy-local-tests.md#v040-覆盖审查135容器)）。
- 子代理 frontmatter 另可写 `tools`（agy 工具名）、`model`（`inherit`、`flash`、`pro`）、
  `mainAgent`、`subagent`、`commandExecutionPolicy`、`mcpServers`、`skills`、`plugins` [A7]；
  1.2.1 起可写 `excludeDefaultComponents`，1.3.1 起可写 `plugins` 与 `hooks` [A3]。文档列出的
  已知问题：`tools` 中有未映射或拼错的工具名时，子代理可能挂起 [A7]。自定义代理的
  `inheritCustomizations` 决定是否继承 skills、rules、plugins、子代理与 MCP 服务器（1.1.14）[A3]。
- `bin/` 中的命令行工具，代理可按名称运行 [A3]；其进程环境与文件权限未核实。sidecars
  （`sidecars/<name>/sidecar.json`）只在 Antigravity 桌面应用中可用，且须在 `config.json` 中启用
  [A8]；UI extensions 也只在桌面应用中，声明方式没有文档。
- rules 文档 [A5]：`trigger` 取 `always_on`、`model_decision`、`glob`、`manual`，缺少 frontmatter
  或取值无法识别的规则被忽略；`globs` 为逗号分隔的字符串；单个规则文件上限 24,000 字节，超出
  部分截断；全局规则与 `always_on` 规则共用 20,000 token 的预算，超出时较大的文件只保留路径与
  `description`。
- 插件中的 MCP 服务器以 `<插件名>_<服务器名>` 命名，避免与其他插件冲突 [A3]。`mcp_config.json`
  的顶层键为 `mcpServers`；本地服务器写 `command`、`args`、`env`、`cwd`，远程服务器写
  `serverUrl` 与 `headers`，不支持 `url`、`httpUrl` [A4]；1.0.5 的更新日志却记载新增对 `url` 的
  支持 [A3]，两处冲突。可选字段另有 `disabled`、`disabledTools`、
  `authProviderType: "google_credentials"` 与 `oauth`（`clientId`、`clientSecret`）[A4]；
  `enabledTools`、`timeoutSeconds`、`tools.eager` 只见于 1.1.16 的更新日志 [A3]。
- 文档没有说明插件 MCP 配置中的变量是否展开，也没有插件根目录变量。1.0.7 的更新日志称插件中
  Gemini CLI 的变量（如 `${extensionPath}`）解析为安装目录 [A3]；1.3.5 中 `command` 里的
  `${extensionPath}` 与 `${PLUGIN_ROOT}` 都不展开，服务器无法启动，`args` 中的 `${…}` 同样按字面
  原样传入（容器实测）。本地服务器继承
  会话的环境变量（1.3.5 容器实测）。1.1.28 起插件中本地服务器的 `cwd` 为相对路径或未写时按插件目录
  解析 [A3]；1.3.5 的服务器以安装后的插件目录为工作目录，`args` 中的相对路径可用，`env` 的值
  原样传入（容器实测）。
- 1.3.5 的会话中子代理的名称取 frontmatter 的 `name`，与文件名无关；frontmatter 含 `targets`
  等文档未列的键时照常加载（容器实测）。根 `agents.json` 与 `skills.json`、`rules.json` 格式相同
  （agy 内嵌文档）：顶层 `entries` 为目录条目数组，条目写 `path` 与可选的 `include_only`、
  `exclude`，目录只扫描一层。1.3.5 中以该格式声明的子代理与 `agents/*.md` 一起加载，
  `include_only` 写子代理名或文件名都只加载命中的项；`agy plugin list --json` 不列出这些子代理
  （容器实测，见下文）。
- 1.3.2 的更新日志称每个插件有数据目录，以 `PLUGIN_DATA` 提供 [A3]；hook 进程环境中没有该变量，
  也没有 `PLUGIN_ROOT`（1.3.4 本地实测，1.3.5 容器实测）。1.3.5 的 MCP 服务器进程环境中有
  `PLUGIN_ROOT`（插件目录）与
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
  实测）。文档的 CLI 一节把安装位置写为 `~/.gemini/antigravity-cli/plugins/`，与同页的 JSON 示例
  和实测不符 [A1]。直接放进 `~/.gemini/config/plugins/` 的插件，只有 MCP 服务器需要配置变量时
  默认禁用（1.2.11）[A3]。
- `agy plugin install` 可从 GitHub 仓库的子路径安装并解析分支（1.0.7），支持子模块（1.0.9）；
  重装时精确替换受管目录（1.1.28）；`plugins.json` 可写目录条目（1.2.10、1.2.16）[A3]。
- agy 只支持官方 marketplace，没有第三方 marketplace 的文件格式 [A10]。
- 全局安装的插件对本机该用户的所有 agy 会话生效，hooks 也是（本地实测）。
- `agy plugin validate` 只报告各组件是否找到：插件名含空格与 `!`、`plugin.json` 含多余字段、
  `hooks.json` 结构错误或无法解析时，都输出 `[ok]` 且以退出码 0 结束（本地实测）。它不能作为
  manifest 与 hooks 的校验手段。
- 1.3.2 的更新日志记载以 `/plugin` 安装插件时可以“在表单中填写插件需要的设置”，远程 MCP 服务器
  在填写后启动 [A3]；这与 1.2.11 中“MCP 服务器需要配置变量”的插件可能是同一机制。文档没有
  说明这些设置的声明方式，也没有说明取值是否传给 hook 进程，未实测。

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
  `ANTIGRAVITY_CONVERSATION_ID`，没有插件根目录与插件数据目录变量（1.3.4 本地实测，1.3.5 容器
  实测）。文档称处理器为 shell 命令 [A2]，命令中的环境变量是否展开未实测。
- `/btw` 不运行用户与工作区的 hooks（1.3.3）[A3]，是否运行插件的 hooks 未写明；打印模式不支持
  `/btw`（1.3.5 容器实测）。
- 插件 agent 的会话中 `PreToolUse` 与 `Stop` 照常触发，会话 id 与主会话不同（1.3.5 容器实测）。

### 输入

stdin 为 camelCase 字段的 JSON [A2]：

| 事件 | 字段 |
|---|---|
| 全部 | `conversationId`、`workspacePaths`（UAPA 取 `workspacePaths[0]` 作为 `GuardContext.cwd`）、`transcriptPath`、`artifactDirectoryPath`、`modelName` |
| `PreToolUse` | `toolCall.name`、`toolCall.args`、`stepIdx` |
| `PostToolUse` | 同 `PreToolUse`，另有 `error`；不含工具输出 |
| `Stop` | `executionNum`、`terminationReason`（`model_stop`、`max_steps_exceeded`、`error`）、`error`、`fullyIdle` |
| `PreInvocation` | `invocationNum`（本次模型调用的序号，从 0 起）、`initialNumSteps`（当前轨迹的步数） |

- stdin 的 `workspacePaths` 为工作区绝对路径数组。UAPA 子进程入口
  （`src/runtime/entries/agy-subprocess.ts`）从中提取 `workspacePaths[0]` 作为
  `GuardContext.cwd` 传入守卫；当 `workspacePaths` 缺失、非数组、为空数组或首项为空串时，
  `GuardContext.cwd` 静默退化为 `null`，不因工作目录缺失阻断执行前检查（F-04-10、F-11-15，
  SD-50；1.3.5 容器实测）。

`toolCall.args` 的键为 PascalCase（本地实测）：

| 工具 | 主要入参 |
|---|---|
| `run_command` | `CommandLine`、`Cwd`、`IsDaemon`、`WaitMsBeforeAsync` |
| `view_file` | `AbsolutePath` |
| `write_to_file` | `TargetFile`、`CodeContent`、`Overwrite`、`Description` |
| `replace_file_content` | `TargetFile`、`TargetContent`、`ReplacementContent`、`StartLine`、`EndLine`、`AllowMultiple` |

各工具的入参另含 `toolAction`、`toolSummary` 两个说明字段。文档列出的入参 [A2]：

| 工具 | 入参（括号内为可选） |
|---|---|
| `view_file` | `AbsolutePath`（`StartLine`、`EndLine`、`IsSkillFile`） |
| `run_command` | `CommandLine`、`Cwd`、`WaitMsBeforeAsync`（`RunPersistent`、`RequestedTerminalID`）；实测另有 `IsDaemon` |
| `list_dir` | `DirectoryPath` |
| `find_by_name` | `SearchDirectory`、`Pattern`（`Type`、`Excludes`、`Extensions`、`FullPath`、`MaxDepth`） |
| `grep_search` | `SearchPath`、`Query`（`IsRegex`、`CaseInsensitive`、`Includes`、`MatchPerLine`） |
| `search_web` | `query`（`domain`），键为小写 |
| `write_to_file` | `TargetFile`、`Overwrite`、`CodeContent`、`Description`（`IsArtifact`、`ArtifactMetadata`） |
| `replace_file_content` | `TargetFile`、`Instruction`、`Description`、`AllowMultiple`、`TargetContent`、`ReplacementContent`、`StartLine`、`EndLine`（`TargetLintErrorIds`） |

### 输出

| 事件 | stdout JSON | 依据 |
|---|---|---|
| `PreToolUse` | `decision` 必填：`allow`、`auto_approve`、`deny`、`ask`、`force_ask`、`deny_unless_prior_grant`；可选 `reason`、`overwrite`、`permissionOverrides` | [A2] |
| `PostToolUse` | `{}`，不能阻断或替换输出 | [A2] |
| `Stop` | `decision` 为 `"continue"` 时不结束本轮，`reason` 作为系统消息注入；其他取值结束 | [A2] |
| `SessionStart`、`PreInvocation` | 可选 `injectSteps` | [A2] |
| `PostInvocation` | 可选 `injectSteps`、`terminationBehavior` | [A2] |

- `overwrite` 按键浅合并进 `toolCall.args`，工具结果前会附加一条说明，列出被改写的键 [A2]。
- `injectSteps` 的每个元素只含以下一个字段：`systemMessage`（对象，给代理的带外指令）、
  `userMessage`（字符串）、`ephemeralMessage`（字符串，临时的系统消息）、`toolCall`（对象，
  要执行的工具调用，文档未列内部字段）[A2]。
- 退出码、stderr、超时与失败时的处理文档未写明 [A2]，本地实测结果：

| 情况 | `PreToolUse` | `Stop` |
|---|---|---|
| `decision: "deny"` | 阻断，模型看到 `tool call denied by pre-tool hook: <reason>` | 不适用 |
| 退出码 1 或 2 | 阻断，模型看到退出码与 stderr | 退出码 1：记录错误，本轮照常结束 |
| 超时 | 进程被终止，阻断 | 本轮照常结束，不采用超时后的输出；hook 进程不被终止 |
| stdout 不是 JSON | 阻断 | 本轮照常结束 |
| `{"decision":"continue","reason":...}` | 不适用 | 不结束，`executionNum` 由 0 变为 1 |
| `{}` | 未测；1.0.16 的更新日志称能安全处理空的 decision 字符串 [A3] | 结束 |

### 扩展能力摘要

| 能力 | 支持情况 | 依据 |
|---|---|---|
| 阻断 | `PreToolUse` 返回 `decision: "deny"` | [A2]；本地实测 |
| 失败时的默认行为 | `PreToolUse` 出错、超时或输出无法解析时阻断；`Stop` 出错、超时或输出无法解析时照常结束 | 本地实测 |
| 执行前改写工具入参 | `overwrite` | [A2]；本地实测 |
| 执行后替换工具输出 | 不支持 | [A2] |
| 停机门禁 | `Stop` 返回 `decision: "continue"`；连续继续达到可配置的次数后不再能阻断（1.1.9），1.3.5 中连续继续 10 次后本轮结束 | [A2][A3]；本地与容器实测 |
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

## 实测记录

会话实测的做法与结果见 [agy 实测记录](agy-local-tests.md)：1.3.4 的本地实测，以及 1.3.5 在测试
容器中的 agents 与 MCP 服务器、UAPA 夹具产物、`Stop` 的超时与无效输出、rules、v0.4.0 覆盖审查、
替代 manifest 位置与合并目录。

## 来源

- [A1] Plugins：<https://antigravity.google/docs/plugins/>
- [A2] Hooks：<https://antigravity.google/docs/hooks/>
- [A3] Antigravity CLI CHANGELOG（1.0.5、1.0.7、1.0.9、1.0.16、1.1.9、1.1.11、1.1.12、1.1.14、
  1.1.16、1.1.28、1.2.1、1.2.2、1.2.7、1.2.10、1.2.11、1.2.16、1.3.1～1.3.5）：
  <https://github.com/google-antigravity/antigravity-cli/blob/main/CHANGELOG.md>
- [A4] MCP：<https://antigravity.google/docs/mcp/>
- [A5] Rules：<https://antigravity.google/docs/rules>
- [A6] Skills：<https://antigravity.google/docs/skills/>
- [A7] Custom subagents：<https://antigravity.google/docs/subagents/>
- [A8] Sidecars：<https://antigravity.google/docs/sidecars/>
- [A9] Migrating from Gemini CLI：<https://antigravity.google/docs/cli/gcli-migration/>
- [A10] Marketplace：<https://antigravity.google/docs/marketplace/>
