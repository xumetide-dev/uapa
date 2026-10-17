# Claude Code 插件：开发方式与 manifest

本文说明 Claude Code 插件（plugin）的目录结构、`plugin.json` 与 `marketplace.json`
的字段、MCP 服务器、开发调试命令与分发方式。事实核对日期为 2026-10-13，2026-10-15 按
Claude Code 2.1.300 的文档与 CHANGELOG 补充（2.1.300 于 2026-10-14 发布；stable 渠道为
2.1.292）；实测为 2.1.296。hooks 见 [Claude Code hooks](claude-code-hooks.md)，进程内 hooks
模块（mod）
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
| Commands | `commands/*.md` | 新插件建议改用 skills；以 `/<插件名>:<文件名>` 调用，子目录计入名称（`commands/db/migrate.md` 为 `/<插件名>:db:migrate`）[C9]；frontmatter 中文档未列的键不影响加载（2.1.296 本地实测） |
| Agents | `agents/*.md` | 递归加载，子目录计入名称：`agents/review/security.md` 为 `<插件>:review:security`；插件 agent 的 `permissionMode`、`hooks`、`mcpServers`、`initialPrompt` 被忽略 [C9] |
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

skill 的 frontmatter 中，`paths` 为 glob 列表，限定按匹配的文件自动加载；`user-invocable: false`
使 skill 不进入 `/` 菜单，模型仍可调用 [C7]。skill、command 与 agent 的正文中可写
`${CLAUDE_PLUGIN_ROOT}`、`${CLAUDE_PLUGIN_DATA}`、`${CLAUDE_SKILL_DIR}` 与 `${user_config.KEY}`，
加载时替换 [C1][C7]。会话中的效果见
[本地实测记录「v0.4.0 覆盖审查」](claude-code-local-tests.md#v040-覆盖审查21296容器)。

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
  （2.1.296 本地实测，2026-10-14）。文档另列：名称等于 `anthropics` 为错误，`official` 紧挨
  `claude` 或 `anthropic` 为错误，`anthropics` 作为整段出现时告警 [C1]。
- 目录展示字段（`icon` 等）在 2.1.281 之前的版本触发 `Unknown field` 告警，`--strict` 因此失败；
  `skills: "."` 在 2.1.221 之前校验失败 [C1]。
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

2.1.296 的本地实测（[本地实测记录「commands 与 userConfig」](claude-code-local-tests.md#commands-与-userconfig)）：

- 环境变量名为 `CLAUDE_PLUGIN_OPTION_` 加键的全大写（`maxRetries` 为 `MAXRETRIES`），值为文本形式
  （`5`、`false`）。只有用户设置过的选项才导出，默认值不导出。
- hooks 模块的 `options` 总是含全部选项：未设置时为 `default`，没有 `default` 时为空字符串；值的
  类型与选项的 `type` 一致。
- 取值以 `<插件>@<marketplace>` 为键保存，`--plugin-dir` 加载的插件读不到，只有默认值。文档另写
  `pluginConfigs` 可以 `<name>@inline` 为键 [C5]，对 `--plugin-dir` 加载的插件是否生效未实测。
- 文档写明每个选项都导出为环境变量 [C1]，与上面“默认值不导出”的实测不一致。
- 写了 `options` 的插件在 2.1.271 之前的版本中无法加载 [C1]。
- `claude plugin configure <插件> --values-stdin` 按 `type` 校验取值，不合格时拒绝保存。
- 文档写明选项名只含字母、数字与下划线，不以数字开头 [C1]。

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

## Hooks

命令 hooks 与 hooks 模块的控制语义、事件、失败处理与本地实测结论见
[Claude Code hooks](claude-code-hooks.md)。

## MCP 服务器

`.mcp.json` 的顶层键为 `mcpServers` [C8]：

- 传输：本地服务器写 `command`、`args`、`env`；远程服务器写 `type`（`http`、`sse`、`ws`）、`url`、
  `headers`，另可写 `headersHelper`（运行命令生成请求头）与 `oauth`（`clientId`、`callbackPort`、
  `scopes`、`authServerMetadataUrl`）。有 `url` 而未写 `type` 的条目被跳过。
- 每个服务器另可写 `timeout` 与 `alwaysLoad`。
- 配置中的 `${VAR}` 与 `${VAR:-default}` 按环境变量展开；插件中另可写 `${CLAUDE_PLUGIN_ROOT}`、
  `${CLAUDE_PLUGIN_DATA}` 与 `${user_config.KEY}`。凭据类变量在 `url` 与 `headers` 中读为空 [C1]。
- 2.1.299 起 OAuth 请求也发送 `headers` 与 `headersHelper` 的请求头（CHANGELOG）。
- 本地服务器继承会话的环境变量，未在 `env` 中声明的变量也能读到；工作目录为会话的工作目录
  （2.1.296 容器实测，见
  [本地实测记录「v0.4.0 覆盖审查」](claude-code-local-tests.md#v040-覆盖审查21296容器)）。

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
插件自带 `plugin.json` 时，条目中的 `mcpServers`、`lspServers`、`userConfig`、`channels`
不生效 [C3]。

2.1.296 容器实测，见
[本地实测记录「v0.4.0 覆盖审查」](claude-code-local-tests.md#v040-覆盖审查21296容器)：

- `source` 为 `./<子目录>` 与 `"./"`（插件即 marketplace 根目录）时，都能
  `claude plugin marketplace add` 并安装；条目不写 `version` 也能安装。
- 缺少 marketplace 的描述时 `validate` 只告警；写 `metadata.description` 后 `--strict` 通过。

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
- `--plugin-dir` 也接受 `.zip`，另有 `--plugin-url`；`plugin eval`（2.1.269 起）运行插件的评测，
  `plugin tag` 为发布打标签 [C6]。

## 分发与组织管控

- 分享单个插件可直接发送目录或 zip；面向团队建立 marketplace 并推送到 git 托管；
  面向所有用户可提交到 Anthropic 插件目录 [C2]。
- 用户设置中的 `enabledPlugins` 记录启用状态，键为 `<entry-name>@<marketplace>` [C2]。
- 团队分发：项目 `.claude/settings.json` 写 `extraKnownMarketplaces` 与 `enabledPlugins`；项目级插件
  须先信任工作区，MCP 服务器逐个审批，monitors 不加载 [C10]。
- 写了 `version` 的插件，在作者修改版本号之前用户不会收到更新；本地路径的 marketplace 原地加载，
  不受此影响 [C1][C10]。
- `extraKnownMarketplaces`（名称 → `{source}`）用于预登记 marketplace；
  管理员用 `strictKnownMarketplaces`（白名单）与 `blockedMarketplaces`（黑名单）管控来源，
  支持 `hostPattern`、`pathPattern`、`owner/*` 等仅限策略列表的写法 [C3]。
- `disableCommandPluginSources` 可关闭 `command` 类型来源；未设置时取
  `allowManagedHooksOnly` 的值 [C3]。

## 安全提示

- 命令 hooks、hooks 模块、LSP、monitors、MCP stdio 服务器与 `bin/` 以当前用户权限在本机运行。
- hooks 模块位于用户设置 hooks 之上，可代替其作答（见 [hooks](claude-code-hooks.md) 的调用链顺序），
  审查第三方插件时需同时审查 `modules` 指向的代码。
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
- [C7] Skills：<https://code.claude.com/docs/en/skills>
- [C8] MCP：<https://code.claude.com/docs/en/mcp>
- [C9] Plugin components：<https://code.claude.com/docs/en/plugins/components>
- [C10] Plugin loading：<https://code.claude.com/docs/en/plugins/loading>
- Claude Code CHANGELOG：<https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md>
  （版本号引用截至 v2.1.300）
