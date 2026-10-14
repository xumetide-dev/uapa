# Kimi Code CLI 插件：开发方式与 manifest

本文说明 Moonshot AI 的 Kimi Code CLI 插件 manifest、marketplace、安装命令及 skills、MCP、
hooks 的配置位置与控制语义。事实核对日期为 2026-10-13，以 `kimi.com/code/docs` 为准。

## 版本背景

- 现行产品为 TypeScript / Node.js 实现的 Kimi Code CLI（仓库 `MoonshotAI/kimi-code`，
  npm 包 `@moonshot-ai/kimi-code`），数据目录为 `~/.kimi-code/`（可由 `KIMI_CODE_HOME`
  改变）[K2]。
- 旧版 Python 实现 `MoonshotAI/kimi-cli` 使用 `~/.kimi/`，仓库已归档；更新日志记载配置文件
  迁移且格式不兼容 [K2]。旧文档站 `moonshotai.github.io/kimi-cli` 的插件页仍写
  `plugin.json` 与 `~/.kimi/plugins/` 且无弃用提示，引用资料时先确认版本。

## 插件 manifest

插件是目录或 zip，manifest 位置（两者都存在时前者优先）[K1]：

- `<plugin_root>/kimi.plugin.json`
- `<plugin_root>/.kimi-plugin/plugin.json`

官方文档未提及读取 `.claude-plugin/plugin.json`、`.codex-plugin/plugin.json` 或根目录
`plugin.json`。

| 字段 | 必填 | 含义 |
|---|---|---|
| `name` | 是 | 插件标识，须匹配 `[a-z0-9][a-z0-9_-]{0,63}` |
| `version`、`description` | 否 | 展示元数据 |
| `skills` | 否 | skill 目录路径；缺省为根目录 `SKILL.md` |
| `skillInstructions` | 否 | skill 使用说明 |
| `agents` | 否 | agent 文件路径；缺省自动发现 `agents/` |
| `sessionStart.skill` | 否 | 新建或恢复会话时把指定 skill 载入主 agent |
| `systemPrompt` / `systemPromptPath` | 否 | 系统提示词片段，各限 32 KB；所有插件每次注入合计上限 64 KB |
| `mcpServers` | 否 | 插件携带的 MCP 服务器 |
| `hooks` | 否 | 与 `config.toml` 中 `[[hooks]]` 同构；工作目录为插件根目录 |
| `commands` | 否 | 斜杠命令 |
| `interface` | 否 | `displayName`、`shortDescription` 等展示字段 |

`tools`、`apps`、`inject`、`configFile` 等字段会产生诊断信息并被忽略 [K1]。示例布局：

```text
my-plugin/
├── kimi.plugin.json
└── skills/
    ├── using-my-plugin/SKILL.md
    └── another-workflow/SKILL.md
```

## marketplace 与安装

自定义 marketplace 文件格式 [K1]：

```json
{
  "version": "2",
  "plugins": [{ "id": "my-plugin", "source": "./path-or-url" }]
}
```

- 会话内命令：`/plugins`（管理面板，含 Installed、Official、Curated、Custom 标签页）、
  `/plugins install <path-or-url>`、`/plugins list`、`/plugins info`、`/plugins enable`、
  `/plugins disable`、`/plugins remove`、`/plugins reload`、
  `/plugins mcp enable|disable <id> <server>` [K1]。
- `install` 接受本地目录、zip URL 或 GitHub 仓库 URL；安装到 `$KIMI_CODE_HOME/plugins/managed/<id>/`，
  安装记录在 `$KIMI_CODE_HOME/plugins/installed.json` [K1][K2]。
- 切换 marketplace：环境变量 `KIMI_CODE_PLUGIN_MARKETPLACE_URL` 或 `/plugins marketplace <url>` [K1]。
- 官方插件随 `MoonshotAI/kimi-code` 仓库维护，经 `code.kimi.com/kimi-code/plugins/official/` 发布
  （经搜索摘要核对）。

## Skills

- 项目级：`.kimi-code/skills/`、`.agents/skills/`；用户级：`$KIMI_CODE_HOME/skills/` 与
  `~/.agents/skills/`（跨工具共享，始终位于系统家目录）；另可由 `extra_skill_dirs` 追加 [K4]。
- 同名时优先级为 Project > User > Extra > Built-in [K4]。
- `config.toml` 相关键：`merge_all_available_skills`（默认 `true`，合并所有可用目录）、
  `extra_skill_dirs`、`builtin_product_skills` [K2]。

## MCP

- 服务器声明在 `~/.kimi-code/mcp.json` 与项目 `.kimi-code/mcp.json`，启动时合并；不写在 `config.toml` [K2]。
- `config.toml` 的 `[mcp]` 只设全局默认：`startup_timeout_ms`（默认 30000）、`tool_timeout_ms`
  （默认 60000）；`mcp.json` 中按服务器的 `startupTimeoutMs`、`toolTimeoutMs` 优先 [K2]。

## Hooks

`~/.kimi-code/config.toml` 的 `[[hooks]]` 数组，每条规则只允许四个字段 [K3]：

```toml
[[hooks]]
event = "PreToolUse"
matcher = "Bash"
command = "node ~/.kimi-code/hooks/check-bash.mjs"
timeout = 5
```

- `event`、`command` 必填；`matcher` 为正则；`timeout` 取 1～600 秒，默认 30。
- 插件携带的 hook 以插件根目录为工作目录，进程环境另有 `KIMI_CODE_HOME` 与
  `KIMI_PLUGIN_ROOT`；会话 id 只经 stdin JSON 的 `session_id` 传入。文档没有插件数据目录
  约定，`plugins/` 下只有 `installed.json` 与已安装插件的副本 [K1][K2][K3]。
- 出现第五个字段时，整个配置文件加载失败，不只是 hooks 失效 [K3]。
- 事件共 20 个，包括 `UserPromptSubmit`、`PreToolUse`、`PostToolUse`、`PostToolUseFailure`、
  `PermissionRequest`、`PermissionResult`、`Stop`、`StopFailure`、`Interrupt`、`SessionStart`、
  `SessionEnd`、`SubagentStart`、`SubagentStop`、`PreCompact`、`PostCompact`、`Notification`、
  `TurnStarted`、`UserPromptQueued`、`TaskStarted`、`SessionHeartbeat` [K3]。

### 扩展能力摘要

| 能力 | 支持情况 | 依据 |
|---|---|---|
| 阻断 | 退出码 2（stderr 为原因）或 stdout JSON `permissionDecision: "deny"`；只有 `PreToolUse`、`Stop`、`UserPromptSubmit` 可阻断 | [K3] |
| 失败时的默认行为 | 其他非零退出码、超时或崩溃默认放行（fail-open） | [K3] |
| 执行前改写工具入参 | 官方文档未提供 | [K3] |
| 执行后替换工具输出 | 官方文档未提供 | [K3] |
| 停机门禁 | `Stop` 可阻断 | [K3] |
| 进程内扩展 | 不支持 | [K1] |

## 来源

- [K1] Plugins：<https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html>
- [K2] Configuration files：
  <https://www.kimi.com/code/docs/en/kimi-code-cli/configuration/config-files.html>；
  Data locations：<https://www.kimi.com/code/docs/en/kimi-code-cli/configuration/data-locations.html>
- [K3] Hooks：<https://www.kimi.com/code/docs/en/kimi-code-cli/customization/hooks.html>
- [K4] Skills：<https://www.kimi.com/code/docs/en/kimi-code-cli/customization/skills.html>
