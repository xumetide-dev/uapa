# Claude Code 插件：开发方式与 manifest

本文说明 Claude Code 插件（plugin）的目录结构、`plugin.json` 与 `marketplace.json`
的字段、两种 hooks 形态的控制语义、开发调试命令与分发方式。事实核对日期为
2026-10-13（「命令 hooks 的本地实测」一节为 2026-10-14），以官方文档与 Claude Code 2.1.296
本地实测为准。进程内 hooks 模块（mod）
的开发细节见 [Claude Code Mods 开发指南](claude-code-mods-guide.md)，横向对比见
[跨平台对比](cross-platform-comparison.md)。

## 概述

- 插件是一个目录，可打包 skills、commands、agents、hooks、MCP 服务器、LSP 服务器、
  output styles、workflows、themes、monitors 与 `bin/` 可执行文件。
- manifest 位于 `.claude-plugin/plugin.json`，**可选**。缺省时按标准布局自动发现组件，
  插件名取自 marketplace 条目，或 `--plugin-dir` 加载时取目录名 [C1]。
- 分发单位是 marketplace：一个含 `.claude-plugin/marketplace.json` 的目录或仓库 [C2]。
- 插件内组件按插件名加命名空间，如插件 `deploy-tools` 中的 agent `reviewer`
  显示为 `deploy-tools:reviewer`，skill 调用为 `/deploy-tools:<skill>` [C1]。

## 标准布局

除 `plugin.json` 外，所有文件放在插件根目录，不放进 `.claude-plugin/` [C1]。

| 组件 | 默认位置 | 说明 |
|---|---|---|
| Manifest | `.claude-plugin/plugin.json` | 可选 |
| Skills | `skills/<name>/SKILL.md` | 根目录直接有 `SKILL.md` 且无 `skills/` 时整体作为单个 skill |
| Commands | `commands/*.md` | 新插件建议改用 skills |
| Agents | `agents/*.md` | 子目录计入 agent 名 |
| Hooks | `hooks/hooks.json` | 顶层 `"hooks"` 声明命令 hooks，`"modules"` 声明 hooks 模块，二者可并存 |
| MCP 服务器 | `.mcp.json` | |
| LSP 服务器 | `.lsp.json` | |
| Output styles | `output-styles/` | |
| Workflows | `workflows/*.js` | |
| Themes | `themes/` | 实验性 |
| Monitors | `monitors/monitors.json` | 实验性，仅交互会话 |
| 可执行文件 | `bin/` | 插件启用时加入 Bash 工具的 `PATH` |
| 默认设置 | `settings.json` | 仅 `agent` 与 `subagentStatusLine` 生效 |

插件根目录的 `CLAUDE.md` 不会作为上下文加载，`claude plugin validate` 会对此告警 [C1]。

## plugin.json 字段

`name` 是唯一必填字段。`claude plugin validate` 对缺少 `version`、`description`、
`author` 只给告警 [C1]。

| 字段 | 类型 | 含义 |
|---|---|---|
| `$schema` | string | 编辑器补全用，加载时忽略；官方文档未给出 URL，SchemaStore 社区维护版为 `https://json.schemastore.org/claude-code-plugin-manifest.json` |
| `name` | string | 必填；kebab-case；不得含空格、`@`、`:`、路径分隔符 |
| `displayName` | string | UI 展示名，不参与命名空间 |
| `version` | string | 不校验 semver；设置后用户停留在该版本直到修改 |
| `description` | string | 简述 |
| `author` | object | `name` 必填，`email`、`url` 可选 |
| `homepage` / `repository` / `license` / `keywords` | string / string / SPDX / string[] | 元数据；`homepage` 须能解析为 URL |
| `metadata` | object | 自由字段，Claude Code 不读取（v2.1.222+） |
| `icon`、`documentationUrl`、`supportUrl`、`privacyPolicyUrl`、`termsOfServiceUrl` | string | 仅供 Anthropic 插件目录展示，运行时忽略 |
| `defaultEnabled` | boolean | 用户未设置时是否默认启用，默认 `true` |
| `dependencies` | (string \| object)[] | 依赖插件：`"name"`、`"name@marketplace"` 或 `{name, marketplace, version}` |
| `settings` | object | 仅 `agent`、`subagentStatusLine` 生效 |
| `userConfig` | object | 启用时向用户询问的配置项，见下文 |
| `channels` | object[] | 绑定到插件内某个 MCP 服务器的消息通道 |
| `types` | path | hooks 模块的类型契约（自包含 `.d.ts`），见 [Mods 开发指南](claude-code-mods-guide.md#类型契约) |
| `skills` | path \| path[] | **追加**到默认 `skills/` 扫描 |
| `commands` | path \| path[] \| object | **替换**默认 `commands/`；对象形式为 `命令名 → {source \| content, description, argumentHint, model, allowedTools}` |
| `agents` | path \| path[] | **替换**默认 `agents/`；只接受 `.md` 文件 |
| `hooks` | path \| object \| 数组 | 与 `hooks/hooks.json` **合并** |
| `mcpServers` | path \| object \| 数组 | 与 `.mcp.json` 合并；也接受 `.mcpb` / `.dxt` 包路径或 URL |
| `lspServers` | path \| object \| 数组 | 与 `.lsp.json` 合并；每项必填 `command`、`extensionToLanguage` |
| `outputStyles` / `workflows` | path \| path[] | 替换默认目录 |
| `experimental.themes` / `experimental.monitors` / `experimental.evals` | 见官方表 | 形状仍可能变化；顶层 `themes`、`monitors` 仍可加载但会告警 |

规则要点 [C1]：

- 组件路径相对插件根目录，必须以 `./` 开头；`skills` 另接受 `"."`。
- 路径解析结果必须留在插件根目录内且存在，含 `..` 的路径报错。
- 未知顶层字段在加载时被忽略，`validate` 给出告警，`--strict` 下判为失败；
  `userConfig` 选项、`channels` 条目、`lspServers` 配置、`monitors` 条目是严格对象，
  出现未知键则插件不加载。
- 名称以 `claude-`、`anthropic-`、`anthropics-`、`cc-plugin-` 开头，或等于 `claude`、
  `anthropic`、`claude-code`、`claude-mods` 等保留名时，`validate` 报错（2.1.296 本地实测）。
- 名称中某个以 `-` 分隔的段为 `claude` 或 `anthropic` 时（如 `my-claude`、`demo-claude-plugin`、
  `tool-anthropic`），`validate` 告警，`--strict` 下判为失败；`claudebot`、`myclaude` 不受影响
  （2.1.296 本地实测，2026-10-14）。
- 非 kebab-case 名称（如 `@org/foo`）在 `validate` 中为告警，但按路径加载
  （`--plugin-dir`）时被拒绝，也无法从 marketplace 按此名安装（本地实测）。

### userConfig

每个选项为严格对象，必填 `type`（`string`、`number`、`boolean`、`directory`、`file`）、
`title`、`description`；可选 `required`、`default`、`options`（v2.1.271+）、`multiple`、
`sensitive`、`min` / `max`。非敏感值写入 `settings.json` 的 `pluginConfigs`，
`sensitive: true` 的值进入系统凭据存储 [C1]。引用方式：

- `${user_config.KEY}`：在 MCP / LSP 配置、exec 形式 hook 的 `args`、skill 与 agent 正文中替换。
- `CLAUDE_PLUGIN_OPTION_<KEY>`：作为环境变量导出给 hook 进程。
- shell 形式的 hook 命令、monitor 命令与 MCP `headersHelper` 拒绝 `${user_config.*}`。
- hooks 模块通过 `register(on, options)` 的 `options` 读取这些值 [C5]。

### 路径变量

| 变量 | 解析为 |
|---|---|
| `${CLAUDE_PLUGIN_ROOT}` | 已安装版本的插件根目录；更新后会变化，不要写入状态 |
| `${CLAUDE_PLUGIN_DATA}` | `~/.claude/plugins/data/<id>/`（`<id>` 中非 `[A-Za-z0-9_-]` 字符替换为 `-`），跨更新保留，用于依赖与缓存 |
| `${CLAUDE_PROJECT_DIR}` | 项目根目录 |

这些变量不出现在 Claude 通过 Bash 工具执行的命令环境中 [C1]。

### 最小示例

以下为示意写法：

```json
{
  "name": "team-tools",
  "version": "0.1.0",
  "description": "团队常用技能与提交前检查",
  "author": { "name": "Example Team" }
}
```

配合 `skills/<name>/SKILL.md` 与 `hooks/hooks.json` 即可构成可用插件；
不需要在 manifest 中声明默认位置的组件。

## Hooks：命令 hooks 与 hooks 模块

`hooks/hooks.json` 承载两种形态，可单独使用，也可在同一文件中并存 [C4][C5]：

| 形态 | 声明方式 | 执行方式 | 引入版本 |
|---|---|---|---|
| 命令 hooks（command hooks，文档亦称 settings hooks） | `"hooks": { "<Event>": [...] }` | 每次事件启动一个子进程，stdin 传 JSON，以退出码与 stdout JSON 回传决定 | 早期版本即有 |
| hooks 模块（function hooks，即 mod） | `"modules": ["./register.ts"]`，一个相对路径 | 模块导出 `register(on, options)`，在宿主提供的独立环境中常驻，以 `($, e, next)` 链式处理事件 | v2.1.287 起终端版默认启用（CHANGELOG） |

### 命令 hooks 的控制语义

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
- hook 进程可读取 `CLAUDE_PROJECT_DIR`、`CLAUDE_PLUGIN_ROOT`、`CLAUDE_PLUGIN_DATA`、
  `CLAUDE_PLUGIN_OPTION_<KEY>`、`CLAUDECODE=1`；`SessionStart` 另有 `CLAUDE_ENV_FILE`。

### 命令 hooks 的本地实测

2.1.296 本地实测结论（`claude -p` + `--plugin-dir`），做法见
[Claude Code 本地实测记录](claude-code-local-tests.md#命令-hooks)：

- stdin 中会话 id 为 `session_id`，工具名为 `tool_name`，工具入参为 `tool_input`（Bash 的命令为
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

### hooks 模块与命令 hooks 并存

2.1.296 本地实测结论（`claude -p` + `--plugin-dir`，同一插件同时声明二者）：

- `validate` 通过；同一事件上，模块的 hook 与命令 hook **都会执行**。需要两种形态互为
  兜底时，必须自行去重，做法见 [UAPA hooks 适配 §5](uapa-hook-adapters.md#5-claude-code-双形态去重)。
- 模块在 `session.start` 中调用 `$.env.set(...)` 设置的环境变量，会出现在随后启动的
  命令 hook 进程环境中；`$.session.id()` 与命令 hook stdin 中的 `session_id` 一致。

调用链顺序为 managed 设置 hooks、各插件的 hooks 模块、其余设置 hooks；模块不调用
`next` 直接作答时，其下的用户设置 hooks 不再参与该次决定 [C5]。`disableAllHooks` 与
`--safe-mode` 会关闭第三方 hooks 模块，但不关闭 Claude Code 内置的 mods [C4]。

## marketplace.json 字段

文件位于 `<marketplace-root>/.claude-plugin/marketplace.json`；相对路径从 marketplace 根目录
（含 `.claude-plugin/` 的目录）解析 [C3]。

顶层字段：`name`、`owner`、`plugins` 必填。

| 字段 | 类型 | 含义 |
|---|---|---|
| `name` | string | 字母、数字、`.`、`_`、`-`；构成插件 id 中 `@` 之后的部分；有保留名单 |
| `owner` | object | `name` 必填，`email`、`url` 可选 |
| `plugins` | array | 插件条目；单条无效不影响其他条目 |
| `description` / `version` | string | 也可写在 `metadata.description` / `metadata.version` |
| `metadata.pluginRoot` | string | 裸名称 source 的解析根目录（v2.1.239+） |
| `forceRemoveDeletedPlugins` | boolean | 从列表删除的插件在用户机器上卸载 |
| `allowCrossMarketplaceDependenciesOn` | string[] | 允许跨 marketplace 依赖的来源 |
| `renames` | object | 旧插件名 → 新名或 `null`（v2.1.193 起自动跟随改名） |

插件条目：`name`、`source` 必填；另可写 `description`、`version`、`category`、`tags`、
`strict`（默认 `true`）、`relevance`、`dependencies`、`defaultEnabled`、`displayName`、
`metadata`、`headers`、`headersHelper`，以及除目录展示字段外的全部 `plugin.json` 字段 [C3]。
条目中的 `hooks` 只接受内联对象，写成路径或数组时 `validate` 可通过但加载报错。

`source` 类型 [C3]：

| 类型 | 字段 | 说明 |
|---|---|---|
| 相对路径 | 字符串本身 | 须以 `./` 开头，不得含 `..` |
| `github` | `repo`、`ref`、`sha` | `owner/repo` |
| `url` | `url`、`ref`、`sha` | 任意 git URL |
| `git-subdir` | `url`、`path`、`ref`、`sha` | 稀疏克隆仓库子目录 |
| `npm` | `package`、`version`、`registry` | 不运行 install 脚本 |
| `archive` | `url`、`sha256` | HTTPS zip（v2.1.224+） |
| `command` | `command`、`timeout`、`mode` | 运行本机命令输出插件目录（v2.1.229+） |

插件条目的 source 没有 `git` 类型；`git` 只用于 marketplace 自身的来源。
`strict` 决定条目中的组件字段与插件自带 `plugin.json` 的关系：`true` 时追加
（`hooks` 按事件替换），`false` 时出现组件字段即冲突，插件不加载 [C1][C3]。
条目 `name` 应与插件 `plugin.json` 的 `name` 一致，否则按 manifest 名安装会找不到 [C2]。

## 开发与调试

下列命令在 shell 中执行，`./my-plugin` 等路径替换为实际目录 [C1][C2][C6]：

```bash
claude --plugin-dir ./my-plugin
```

```bash
claude plugin validate ./my-plugin --strict
```

```bash
claude plugin test ./my-plugin
```

```bash
claude plugin marketplace add ./my-marketplace
```

```bash
claude plugin install my-plugin@my-marketplace
```

```bash
claude plugin details my-plugin
```

- 会话内修改插件后用 `/reload-plugins` 重载；本地目录型 marketplace 的相对路径插件
  直接从源目录读取，无需改版本号 [C2]。
- `/plugin` 面板的 **Errors** 标签页显示加载错误，如路径越界、路径不存在 [C1]。
- `validate` 结果分为 `Validation passed`、`passed with warnings`、`failed`；
  `--strict` 把告警升级为失败，适合 CI；`--json` 输出结构化报告（v2.1.259+）[C6]。
- `claude plugin test` 运行 hooks 模块的 `*.test.ts` / `*.test.tsx` [C6]。

## 分发与组织管控

- 分享单个插件可直接发送目录或 zip；面向团队建立 marketplace 并推送到 git 托管；
  面向所有用户可提交到 Anthropic 插件目录 [C2]。
- 用户设置中的 `enabledPlugins` 记录启用状态，键为 `<entry-name>@<marketplace>` [C2]。
- `extraKnownMarketplaces`（名称 → `{source}`）用于预登记 marketplace；
  管理员用 `strictKnownMarketplaces`（白名单）与 `blockedMarketplaces`（黑名单）管控来源，
  支持 `hostPattern`、`pathPattern`、`owner/*` 等仅限策略列表的写法 [C3]。
- `disableCommandPluginSources` 可关闭 `command` 类型来源；未设置时取
  `allowManagedHooksOnly` 的值 [C3]。

## 安全提示

- 命令 hooks、hooks 模块、LSP、monitors、MCP stdio 服务器与 `bin/` 以当前用户权限在本机运行。
- hooks 模块位于用户设置 hooks 之上，可代替其作答（见上文调用链顺序），审查第三方插件时
  需同时审查 `modules` 指向的代码。
- `npm` 来源不执行 install 脚本；`archive` 来源可用 `sha256` 固定内容；git 来源可用
  `sha` 固定提交 [C3]。
- 保留名与冒充检测只在 `init`、`tag`、`validate` 时检查，不能替代来源审查 [C1]。

## 来源

- [C1] Plugin manifest reference：<https://code.claude.com/docs/en/plugins/manifest-reference>
  （旧地址 `/docs/en/plugins-reference` 仍可访问）
- [C2] Create a marketplace：<https://code.claude.com/docs/en/plugin-marketplaces>
- [C3] Marketplace reference：<https://code.claude.com/docs/en/plugins/marketplace-reference>
- [C4] Hooks reference：<https://code.claude.com/docs/en/hooks>
- [C5] Mods reference：<https://code.claude.com/docs/en/plugins/mods/reference>
- [C6] Plugin CLI reference：<https://code.claude.com/docs/en/plugins/cli-reference>
- Claude Code CHANGELOG：<https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md>
  （版本号引用截至 v2.1.296）
