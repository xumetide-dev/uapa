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
`~/.codex/plugins/cache/<marketplace>/<plugin>/<version>/`，本地插件版本记为 `local` [X2]。

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
- 插件携带的生命周期 hooks 只对在 Codex 桌面端手动安装的插件生效，含 hooks 的插件不能
  进入公开目录 [X2]。0.162.1 源码中 TUI、`codex exec` 与 app-server 走同一加载路径，未见按
  客户端区分的条件（源码核对，推断）。
- hook 进程环境中没有 `CODEX_*` 会话变量，会话信息通过 stdin JSON 传入 [X7]。
- 插件 hook 进程另有 `PLUGIN_ROOT`、`PLUGIN_DATA` 及兼容名 `CLAUDE_PLUGIN_ROOT`、
  `CLAUDE_PLUGIN_DATA`；数据目录为 `$CODEX_HOME/plugins/data/<plugin>-<marketplace>`，
  文档只称其为可写数据目录 [X7][X8]。
- 默认超时 600 秒；`SessionEnd` 与 `Interrupt` 默认 1 秒、上限 3 秒 [X8]。

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
  （如 `modules`）时整份文件不加载；处理器的超时字段为 `timeout`，单位秒。
- 省略 matcher 时匹配全部工具；命令经 shell 执行，`${PLUGIN_ROOT}` 由 Codex 在执行前替换。
- stdin 为 snake_case：`session_id`、`tool_name`、`tool_input`（`Bash` 为 `{ command }`）、
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
  拼到插件目录下。
- 插件不承载 agents。

## 容器实测（0.162.1）

2026-10-15，Linux 测试容器中的 codex-cli 0.162.1，模型服务为本机配置的 provider。产物为夹具
期望树中插件目录的副本，写入本地 marketplace 后安装；提示只要求运行标记命令。

```bash
codex plugin marketplace add <marketplace 根目录>
```

```bash
codex plugin add <插件名>@<marketplace 名>
```

- 安装后插件位于 `~/.codex/plugins/cache/<marketplace>/<插件>/<版本>/`。
- 信任：安装后首次启动 TUI 时出现 “Hooks need review” 对话框，列出新增或改动的 hooks 数量；
  选 “Trust all and continue” 后用户层 `config.toml` 中每个 hook 记一条 `trusted_hash`，之后的
  `codex exec` 运行这些 hooks。信任之前 `codex exec` 静默跳过插件的 hooks，拒绝的标记命令照常
  执行。
- 探测插件只在 TUI 中信任一次，之后在同一容器中改模式文件，四个 hook 照常运行：信任不受脚本
  文件内容影响。
- 容器中运行 TUI：镜像没有 `ps`，需加 `--no-daemon`；provider 配置写了 `requires_openai_auth`
  时 TUI 先显示登录界面，写入信任时以 `-c model_providers.<provider>.requires_openai_auth=false`
  跳过。

| 项目 | 做法 | 结果 |
|---|---|---|
| 拒绝 | `full` 产物，要求运行 `echo uapa-deny-probe > deny.txt` | 命令不执行，`deny.txt` 不存在；日志为 `Command blocked by PreToolUse hook: 拒绝标记命令 uapa-deny-probe`，模型报告该命令被 hook 拦下 |
| 改写 | 要求运行 `echo uapa-rewrite-probe x > rewrite.txt` | 执行的是 `echo uapa-rewritten x > rewrite.txt` |
| 停机继续 | 同一会话 | 模型按停机原因继续两轮后结束，计数文件归零 |
| 提示阻断 | `full` 产物，`codex exec --json` 提交含 `API_KEY=uapa-prompt-probe` 的提示 | 只有 `turn.started` 与 `turn.completed` 两个事件，`usage` 的输入与输出 token 都为 0，没有模型回复：提示被拦下，未调用模型。exec 的文本输出只有 `hook: UserPromptSubmit Blocked`，不含原因；TUI 中显示 `Blocked by hook` 与原因 `提示中含疑似密钥`。不含标记的对照提示得到模型回复 |
| hook 以 1 退出 | 探测插件在 `PreToolUse`、`UserPromptSubmit`、`PostToolUse`、`Stop` 上运行同一个脚本（`timeout` 为 3），提示要求运行 `date +uapa-%s \| tee probe.txt` 并回复其输出 | 四个 hook 都运行并以 1 退出：命令执行，`probe.txt` 写入，提示送达模型，模型回复与 `probe.txt` 相同（工具输出保留），本轮照常结束 |
| hook 超时 | 同上，脚本等待 10 秒 | 四个 hook 都启动，都没有写出结束记录（超时时被终止）；命令执行、提示送达、工具输出保留、本轮结束，同上 |
| stdout 不是 JSON | 同上，`PreToolUse` 与 `PostToolUse` 输出 `uapa-not-json` | 命令执行，工具输出保留，本轮照常结束 |
| `UserPromptSubmit` 输出纯文本 | 同上，`UserPromptSubmit` 以 0 退出并输出 `uapa-not-json` | 两次运行都在 300 秒内没有调用模型，事件只有 `turn.started`；按源码该文本作为附加上下文。UAPA 的入口放行时以 0 退出、不输出文本 |
| 扣留 | `after-tool` 产物，运行 `echo uapa-withhold-probe` | 工具结果为扣留原因（日志 `error=扣留标记输出 uapa-withhold-probe`）；模型回复 `uapa-withhold-probe`，与原因中的标记相同，单看回复不能区分 |
| 替换降级为扣留 | 运行 `echo uapa-replace-probe` | 工具结果为替换文本，模型回复 `uapa-replaced`，读不到原输出 |
| MCP 服务器 | `components` 产物，`mcp/` 中另放桩服务器 | `codex mcp list` 列出 `docs`、`plain`、`remote`（`launcher` 已由 UAPA 跳过）；`docs` 的工作目录为插件目录（`"cwd": "."`），`./mcp/server.mjs` 按它解析，`UAPA_DATA` 原样为 `./data`；远程服务器连接失败只记错误日志 |
| `"mcpServers": {}` | 两个只含 `.mcp.json` 的插件，manifest 分别写 `{}` 与不写 `mcpServers` | 写 `{}` 的插件不加载 `.mcp.json` 中的服务器；不写的插件加载 |

## marketplace.json

位置 [X2]：

- 仓库级：`$REPO_ROOT/.agents/plugins/marketplace.json`
- 个人级：`~/.agents/plugins/marketplace.json`
- 兼容：`$REPO_ROOT/.claude-plugin/marketplace.json`

字段 [X2]：

| 层级 | 字段 | 说明 |
|---|---|---|
| 顶层 | `name` | marketplace 标识 |
| 顶层 | `interface.displayName` | 展示名 |
| 顶层 | `plugins[]` | 插件条目 |
| 条目 | `name` | 插件名；应与插件目录名及 `plugin.json` 的 `name` 一致 |
| 条目 | `source` | 类型为 `local`（可直接写路径字符串）、`url`、`git-subdir`、`npm` |
| 条目 | `policy.installation` | 必填；`AVAILABLE`、`INSTALLED_BY_DEFAULT`、`NOT_AVAILABLE` |
| 条目 | `policy.authentication` | 如 `ON_INSTALL` |
| 条目 | `category` | 必填；分类 |

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
| `mcp_servers.<id>.*` | 独立 MCP 服务器：`command`、`args`、`env`、`cwd`、`url`、`bearer_token_env_var`、`http_headers`、`enabled`、`required`、`startup_timeout_sec`、`tool_timeout_sec` 等 |
| `features.hooks` / `features.remote_plugin` / `features.skill_mcp_dependency_install` | 相关特性开关；`remote_plugin` 已稳定且默认开启 |

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
- `marketplace add` 克隆 git 仓库，不接受单个 `marketplace.json` 的原始文件 URL【社区】。
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
  `codex-rs/core-plugins/src/store.rs`
- 【社区】Codex marketplace 安装实践：
  <https://github.com/max-sixty/worktrunk/issues/4017>、
  <https://github.com/kamp-us/phoenix/pull/10200>
