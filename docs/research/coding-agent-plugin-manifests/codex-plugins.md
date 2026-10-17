# OpenAI Codex 插件：开发方式与 manifest

本文说明 Codex 插件的组成、manifest 位置与字段、marketplace 格式、hooks 控制语义、
`config.toml` 相关键与 CLI 命令。事实核对日期为 2026-10-13；manifest 与 hooks 的加载、输入与
输出另按 rust-v0.162.1 源码核对（2026-10-14），见「源码核对（rust-v0.162.1）」。Codex 文档已从
`developers.openai.com/codex/*` 308 重定向到 `learn.chatgpt.com/docs/*`；
插件打包参考页仍在 `developers.openai.com/plugins/build/plugins` [X2]。
其他平台见 [Claude Code](claude-code-plugins.md)、[OpenCode](opencode-plugins.md)。

## 概述

- 插件在 ChatGPT 与 Codex 之间通用，可打包 skills、MCP 服务器、应用连接
  （`.app.json`）与 hooks [X1][X2]。
- skill 是可复用工作流的编写格式，插件是 skill 的分发单位；仅本地使用时 skill 已足够 [X3]。
- manifest 有两种位置 [X2]：
  - **根目录 `plugin.json`**：当前推荐形式
    （`$schema` 为 `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`），
    OpenAI 专有设置放在 `extensions.com.openai` 下。
  - **`.codex-plugin/plugin.json`**：兼容回退，旧包继续可用。
  - 根 `plugin.json` 中存在 `extensions.com.openai` 对象时，整体替代
    `.codex-plugin/plugin.json` 作为 OpenAI 专有设置的来源，两者不合并。
  - 0.162.1 不为根 `plugin.json`（AgentPlugin 格式）的插件加载任何 hooks，含
    `extensions.com.openai.hooks` 与默认 `hooks/hooks.json`；只有兼容 manifest 的插件加载 hooks
    （源码核对）。

## 目录布局

```text
plugin-root/
├── plugin.json            # 规范 manifest
├── mcp.json               # MCP 服务器定义
├── skills/<name>/SKILL.md
├── hooks/hooks.json       # 默认 hook 配置，自动发现
├── assets/                # composerIcon、logo、screenshots
├── .app.json              # OpenAI 已登记 MCP 服务器映射（可选）
└── .codex-plugin/
    └── plugin.json        # 兼容 manifest（可选）
```

布局依据 [X2]；路径相对插件根目录、以 `./` 开头、不得越出根目录。
`mcp.json` 要求每个服务器声明传输 `type`；旧脚手架生成的 `.mcp.json`
不能直接改名沿用 [X2]。兼容 manifest `.codex-plugin/plugin.json` 未写 `mcpServers` 时读取
`.mcp.json`，不读取 `mcp.json`（rust-v0.162.1 源码核对）。安装后的插件缓存在
`~/.codex/plugins/cache/<marketplace>/<plugin>/<version>/` [X2]；`<version>` 取 manifest 的
`version`，没有时为 `local`（`core-plugins/src/store.rs`，源码核对）。

## plugin.json 字段

根目录 `plugin.json` 的通用字段 [X2]：

| 字段 | 类型 | 必填 | 含义 |
|---|---|---|---|
| `$schema` | string | 是 | schema URL，取值见上文 |
| `name` | string | 是 | kebab-case；作为组件命名空间 |
| `version` | string | 是（OpenAI 打包参考） | semver；marketplace 据此判断升级 |
| `description` | string | 是（OpenAI 打包参考） | 简述 |
| `author` | object | 否 | `name`、`email`、`url` |
| `homepage` / `repository` / `license` / `keywords` | string / string / string / string[] | 否 | 元数据 |

`extensions.com.openai` 下的 OpenAI 专有字段 [X2]：

| 字段 | 含义 |
|---|---|
| `apps` | 指向 `./.app.json` |
| `hooks` | 路径、路径数组或内联对象；缺省时发现 `hooks/hooks.json` |
| `onboardingSkill` | 安装后引导用的 skill |
| `interface.displayName` / `shortDescription` / `longDescription` / `developerName` | 展示信息 |
| `interface.category` / `capabilities` | 分类与能力标签（如 `Read`、`Write`） |
| `interface.websiteURL` / `privacyPolicyURL` / `termsOfServiceURL` | 链接 |
| `interface.defaultPrompt` / `brandColor` | 默认提示词数组、品牌色 |
| `interface.composerIcon` / `logo` / `screenshots` | 资源路径，建议放 `./assets/` |

兼容形式 `.codex-plugin/plugin.json` 把 `skills`、`mcpServers`、`apps`、`interface`
等写在顶层。曾用于生成该形式的 openai/codex 内置 `plugin-creator` 示例 skill 已于
2026-09-27 从仓库删除，其字段表不再作为依据。

hook 进程可读取 `PLUGIN_ROOT`、`PLUGIN_DATA`，并兼容 `CLAUDE_PLUGIN_ROOT`、
`CLAUDE_PLUGIN_DATA` [X2][X7]。

### 最小示例

以下为示意写法：

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "team-tools",
  "version": "0.1.0",
  "description": "团队常用技能",
  "extensions": {
    "com.openai": {
      "interface": { "displayName": "Team Tools", "developerName": "Example Team" }
    }
  }
}
```

## Hooks

hooks 写在插件 `hooks/hooks.json` 或 `config.toml` 的 `hooks.<Event>[]`，处理器类型为
`command` 与 `mcp_tool`（`prompt`、`agent` 只解析不执行）[X7]。

- 事件共 12 个：`PreToolUse`、`PermissionRequest`、`PostToolUse`、`PreCompact`、
  `PostCompact`、`UserPromptSubmit`、`SubagentStart`、`SubagentStop`、`Stop`、`Interrupt`、
  `SessionStart`、`SessionEnd` [X7]。
- 运行 hook 需要持久化的 hook 信任（trust）；`--dangerously-bypass-hook-trust` 可临时绕过 [X7]。
- 文档写明插件携带的生命周期 hooks 只对在 Codex 桌面端手动安装的插件生效，含 hooks 的插件不能
  进入公开目录 [X2]。0.162.1 中以 CLI 安装的插件，其 hooks 经信任后在 TUI 与 `codex exec` 中都
  运行（容器实测，见[实测记录](codex-local-tests.md#容器实测01621)）。
- 守卫不生效的情形：`allow_managed_hooks_only = true` 时忽略插件 hooks；`[features].hooks = false`
  关闭全部 hooks；IDE 扩展不支持插件；云端编排的 ChatGPT Work 不支持插件 hooks [X1][X7]。
- hook 进程环境中没有 `CODEX_*` 会话变量，会话信息通过 stdin JSON 传入 [X7]。
- 插件 hook 进程另有 `PLUGIN_ROOT`、`PLUGIN_DATA` 及兼容名 `CLAUDE_PLUGIN_ROOT`、
  `CLAUDE_PLUGIN_DATA`；数据目录为 `$CODEX_HOME/plugins/data/<plugin>-<marketplace>`，
  文档只称其为可写数据目录 [X7][X8]。
- 默认超时 600 秒；`SessionEnd` 与 `Interrupt` 默认 1 秒、上限 3 秒，写入更大的值时压到 3 秒并在
  每次会话开始时告警 [X8]。
- matcher 为正则：工具事件按工具名，`SessionStart` 按来源（`startup`、`resume`、`clear`、
  `compact`、`fork`），压缩事件按触发方式，子代理事件按代理类型；处理器另有 `statusMessage`、
  `async`、`commandWindows` [X7]。
- UAPA 未使用的 6 个事件 [X7][X8]：`PermissionRequest` 以 `decision.behavior`（`allow`、`deny`）
  自动批准或拒绝审批请求；`SubagentStart` 可返回 `additionalContext`；子代理结束时触发
  `SubagentStop` 而不是 `Stop`，返回 `decision: "block"` 让子代理继续；`PreCompact`、`PostCompact`
  在压缩前后触发；`Interrupt` 在中断时触发，超时同 `SessionEnd`。
- `additionalContext` 可用于 `SessionStart`、`SubagentStart`、`UserPromptSubmit`、`PreToolUse`、
  `PostToolUse`；`SessionStart` 以 0 退出的纯文本 stdout 也作为模型上下文 [X7][X8]。

### 扩展能力摘要

| 能力 | 支持情况 | 依据 |
|---|---|---|
| 执行前阻断 | 支持：退出码 2（stderr 为原因）或 `permissionDecision: "deny"` | [X7] |
| 失败时的默认行为 | 放行（fail-open）：退出码非 0 非 2、超时、进程启动失败、输出形似 JSON 但不合法时，该 hook 记为失败，工具照常执行；退出码 2 而 stderr 为空也记为失败，不阻断 | [X7][X8] |
| 执行前改写工具入参 | 支持：`permissionDecision: "allow"` 时返回 `updatedInput` | [X7] |
| 执行后替换工具输出 | 部分：`PostToolUse` 返回 `decision: "block"` 与非空 `reason` 时以 `reason` 替换工具结果，模型读到的是一次失败的调用，不撤销已执行的命令；`updatedMCPToolOutput` 只解析、尚未生效；只对执行成功的调用触发 | [X7]；源码核对 |
| 停机门禁 | `Stop` 返回 `decision: "block"` 时以 `reason` 作为续写提示继续本轮；任一 hook 返回 `continue: false` 时优先结束 | [X7] |
| 进程内扩展 | 不支持，只有子进程与 MCP 工具两类处理器 | [X7] |

## 源码核对（rust-v0.162.1）

完整记录见 [Codex hooks 源码核对记录](codex-source-review.md)。与 UAPA 生成产物相关的结论：

- 带 hooks 的插件须用兼容 manifest `.codex-plugin/plugin.json`；其 `hooks` 字段替换默认的
  `hooks/hooks.json`。根 `plugin.json` 只在 `$schema` 为 agent-plugins 地址时优先。
- 不读取默认 `hooks/hooks.json` 的写法是 `"hooks": {"hooks": {}}`；`"hooks": []` 等同未写。
- hooks 文件为 `{ "hooks": { <事件>: [{ "matcher"?, "hooks": [<处理器>] }] } }`，根对象出现其他键
  （如 `modules`）时整份文件不加载；处理器的超时字段为 `timeout`，单位秒。宿主把 `SessionEnd` 与
  `Interrupt` 超时上限设为 3 秒，写入更大值时告警；UAPA 产物自动将其超时压至至多 3 秒以消除告警。
- 省略 matcher 时匹配全部工具；命令经 shell 执行，`${PLUGIN_ROOT}` 由 Codex 在执行前替换。
- stdin 为 snake_case：`session_id`、`cwd`、`tool_name`、`tool_input`（`Bash` 为 `{ command }`）、
  `prompt`、`stop_hook_active`。
- 退出码 2 且 stderr 非空时阻断工具调用或提示；改写为 `hookSpecificOutput` 中的
  `hookEventName`、`permissionDecision: "allow"` 与 `updatedInput`；`Stop` 返回
  `decision: "block"` 与 `reason` 时继续本轮。其余失败一律放行。
- 未信任的插件 hooks 被静默跳过；安装插件不自动信任其 hooks。
- `PostToolUse` 的 `tool_response` 在执行命令与 `apply_patch` 上为交给模型的输出字符串，在
  MCP 工具上为 `CallToolResult` 对象；`decision: "block"` 与非空 `reason` 以 `reason` 替换输出，
  其余失败保留原输出。
- 兼容 manifest 的 `mcpServers` 可指向 `./mcp.json`；文件中的字段为 snake_case（远程服务器的
  请求头为 `http_headers`），未知字段被忽略，不展开 `${PLUGIN_ROOT}` 等占位符；相对的 `cwd`
  拼到插件目录下。本地服务器启动前清空环境，只保留 `HOME`、`PATH`、`SHELL`、`USER` 等少数系统
  变量，未在 `env` 或 `env_vars` 声明的变量不会透传；UAPA 将整值引用 `${user_config.<KEY>}` 的
  项从 `env` 剥离并并入 `env_vars`。兼容 manifest 未写 `mcpServers` 时默认读取根目录 `.mcp.json`；
  UAPA 在 Codex 无服务器但与 Claude Code 共用目录时显式写入 `"mcpServers": {}`，避免误读
  Claude Code 写出的 `.mcp.json`。
- 插件不承载 agents。
- 兼容格式的插件在安装时把 `commands/**/*.md` 转换为技能，正文含 `$ARGUMENTS` 等模板写法或转换结果
  超过 4000 字节的命令被跳过；插件不承载 rules 与指令文件，也没有传给 hook 的用户配置（2026-10-15
  核对，见源码核对记录「commands、rules 与用户配置」）。转换后的技能在会话中名为
  `<插件名>:source-command-<命令名>`（容器实测见[实测记录](codex-local-tests.md#容器实测01621)）。

## 实测记录

0.162.1 在测试容器中的安装、信任、守卫、MCP 服务器与命令转换实测见
[Codex 实测记录](codex-local-tests.md#容器实测01621)。

## marketplace.json

位置 [X2]：

- 仓库级：`$REPO_ROOT/.agents/plugins/marketplace.json`
- 个人级：`~/.agents/plugins/marketplace.json`
- 兼容：`$REPO_ROOT/.claude-plugin/marketplace.json`

0.162.1 在一个根目录中依次查找 `.agents/plugins/marketplace.json`、
`.agents/plugins/api_marketplace.json`、`.claude-plugin/marketplace.json`、
`.cursor-plugin/marketplace.json`，取第一个存在的文件（`core-plugins/src/marketplace.rs`，源码
核对）。只提供 `.claude-plugin/marketplace.json` 时，Codex 会按它安装其中的插件。

字段 [X2]：

| 层级 | 字段 | 说明 |
|---|---|---|
| 顶层 | `name` | marketplace 标识 |
| 顶层 | `interface.displayName` | 展示名 |
| 顶层 | `plugins[]` | 插件条目 |
| 条目 | `name` | 插件名；应与插件目录名及 `plugin.json` 的 `name` 一致 |
| 条目 | `source` | 类型为 `local`（可直接写路径字符串）、`url`、`git-subdir`、`npm`；本地路径须以 `./` 开头，`"./"` 指 marketplace 根目录，相对含 `.agents/plugins/` 的目录解析（源码核对） |
| 条目 | `policy.installation` | `AVAILABLE`、`INSTALLED_BY_DEFAULT`、`NOT_AVAILABLE`；文档写为必填，源码中可省略，默认 `AVAILABLE` |
| 条目 | `policy.authentication` | `ON_INSTALL`（源码中的默认值）或 `ON_USE` |
| 条目 | `policy.products` | 适用的产品，可省略（源码核对） |
| 条目 | `category` | 分类；文档写为必填，源码中可省略 |

## Skills 与 agents/openai.yaml

- 发现位置：从 `$CWD` 逐级向上到仓库根目录的 `.agents/skills`、`$HOME/.agents/skills`、
  `/etc/codex/skills`，以及随 Codex 内置的系统 skills [X3]。
- `SKILL.md` frontmatter 必填 `name`、`description` [X3]。
- 可选的 `agents/openai.yaml` 提供 Codex 专有元数据 [X3]：
  - `interface`：`display_name`、`short_description`、`icon_small`、`icon_large`、
    `brand_color`、`default_prompt`
  - `policy.allow_implicit_invocation`：默认 `true`；为 `false` 时不由模型隐式触发
  - `dependencies.tools[]`：`type`（如 `mcp`）、`value`、`description`、`transport`、`url`

## config.toml 相关键

配置文件：用户级 `~/.codex/config.toml`，项目级 `.codex/config.toml`（仅受信任项目加载），
profile 文件 `$CODEX_HOME/<name>.config.toml` [X4]。

| 键 | 含义 |
|---|---|
| `plugins.<plugin@marketplace>.enabled` | 启用或禁用已安装插件 |
| `plugins.<plugin@marketplace>.mcp_servers.<server>.*` | 按服务器设置 `enabled`、`enabled_tools`、`disabled_tools`、`default_tools_approval_mode`、`tools.<tool>.approval_mode`（取值 `auto`、`prompt`、`writes`、`approve`） |
| `marketplaces.<name>.source` / `source_type` / `ref` / `sparse_paths` | marketplace 来源；`source_type` 为 `git` 或 `local` |
| `skills.config[]` 的 `path`、`enabled` | 单个 skill 的启用开关 |
| `skills.max_context_tokens` | 可用 skills 目录的 token 预算 |
| `hooks.<Event>[]` | 内联 hooks，事件见上文 |
| `hooks.state.<key>.enabled` / `trusted_hash` | 单个 hook 的开关与信任记录，key 的格式见[源码核对记录](codex-source-review.md#信任与加载条件) |
| `allow_managed_hooks_only` | 为 `true` 时只运行托管的 hooks，插件 hooks 被忽略 |
| `mcp_servers.<id>.*` | 独立 MCP 服务器：`command`、`args`、`env`、`cwd`、`url`、`bearer_token_env_var`、`http_headers`、`env_vars`、`enabled`、`required`、`startup_timeout_sec`、`tool_timeout_sec` 等 |
| `features.hooks` / `features.remote_plugin` / `features.skill_mcp_dependency_install` | 相关特性开关；`hooks` 为 `false` 时关闭全部 hooks；`remote_plugin` 已稳定且默认开启 |

## CLI 命令

marketplace 与插件分两步安装，没有 `install` 子命令 [X5]：

```bash
codex plugin marketplace add owner/repo --ref main
```

```bash
codex plugin add my-plugin@my-marketplace
```

```bash
codex plugin list --json
```

```bash
codex plugin remove my-plugin@my-marketplace
```

- `marketplace add` 接受 GitHub 简写、HTTP(S) / SSH git URL 或本地 marketplace 根目录，
  可重复 `--sparse PATH` 稀疏检出；子命令另有 `list`、`upgrade`、`remove` [X5]。
- `plugin list --available --json` 列出可安装插件，`-m/--marketplace` 限定来源 [X5]。
- `marketplace add` 的来源只能是 git 仓库或本地目录，不接受单个 `marketplace.json` 的原始文件 URL
  （`core-plugins/src/marketplace_add/source.rs`，源码核对）。
- 会话内可用 `/plugins` 浏览与安装 [X1]。
- 版本差异：社区记录显示 `codex plugin add` 在部分早于 0.153.0 的版本中不可用，
  需改用 `/plugins`【社区】；以当次 `codex plugin --help` 为准。

## 发布

- 本地测试：复制插件目录到 marketplace 路径，更新 marketplace 文件后重启客户端 [X2]。
- 公开发布：通过 OpenAI 插件提交门户审核后进入插件目录；含 hooks 的插件不能公开发布；
  工作区管理员可导入并同步 GitHub marketplace 供团队使用 [X1][X2]。

## 来源

- [X1] Plugins：<https://learn.chatgpt.com/docs/plugins>
- [X2] Package your plugin：<https://developers.openai.com/plugins/build/plugins>
- [X3] Build skills：<https://learn.chatgpt.com/docs/build-skills>
- [X4] Config reference：<https://learn.chatgpt.com/docs/config-file/config-reference>
- [X5] Developer commands：<https://learn.chatgpt.com/docs/developer-commands?surface=cli>
- [X7] Hooks：<https://learn.chatgpt.com/docs/hooks>
- [X8] `openai/codex` tag `rust-v0.162.1`：`codex-rs/hooks/src/events/pre_tool_use.rs`、
  `codex-rs/hooks/src/engine/command_runner.rs`、`codex-rs/hooks/src/engine/discovery.rs`、
  `codex-rs/core-plugins/src/store.rs`、`codex-rs/core-plugins/src/marketplace.rs`、
  `codex-rs/hooks/src/events/session_start.rs`
- 【社区】Codex marketplace 安装实践：
  <https://github.com/max-sixty/worktrunk/issues/4017>、
  <https://github.com/kamp-us/phoenix/pull/10200>
