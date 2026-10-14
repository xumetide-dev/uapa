# Cursor 插件：开发方式与 manifest

本文说明 Cursor 的两种插件格式、manifest 字段、自动发现规则、marketplace、发布要求，以及
rules 与 hooks 的文件格式和控制语义。事实核对日期为 2026-10-13，以 `cursor.com/docs` 为准。
Cursor 的 VS Code 扩展（`.vsix`，Open VSX）是另一套机制，不在本文范围。
横向对比见 [跨平台对比](cross-platform-comparison.md)。

## 两种插件格式

| 格式 | manifest | 可承载的组件 |
|---|---|---|
| 根目录格式 | 根目录 `plugin.json` | 只有 skills 与 MCP |
| Cursor Plugins | `.cursor-plugin/plugin.json` | 另加 rules、agents、commands、hooks、variables |

- Cursor 同时加载两种格式 [U1][U4]。
- 根目录只有一个 `SKILL.md` 时，按单 skill 插件处理 [U1]。

## .cursor-plugin/plugin.json 字段

`name` 为唯一必填字段，须为小写 kebab-case [U1]。

| 字段 | 类型 |
|---|---|
| `name` | string，必填 |
| `description`、`version`、`homepage`、`repository`、`license`、`logo` | string |
| `author` | object |
| `keywords` | array |
| `rules`、`agents`、`skills`、`commands` | string \| array |
| `hooks` | string \| object |
| `mcpServers` | string \| object \| array |
| `variables` | object（插件使用的 `${VAR}` 占位符的 schema 声明） |

### 自动发现

manifest 未声明某类组件时，按默认位置发现；一旦在 manifest 中写了该组件的路径，
就不再对它做目录自动发现 [U1]。

| 组件 | 默认位置 | 识别方式 |
|---|---|---|
| Skills | `skills/` | 含 `SKILL.md` 的子目录 |
| Rules | `rules/` | `.md`、`.mdc`、`.markdown` |
| Agents | `agents/` | `.md`、`.mdc`、`.markdown` |
| Commands | `commands/` | `.md`、`.mdc`、`.markdown`、`.txt` |
| Hooks | `hooks/hooks.json` | 解析事件名 |
| MCP | `mcp.json` | 解析服务器条目 |

插件内 `rules/` 接受三种扩展名；项目目录 `.cursor/rules/` 只认 `.mdc`（见下文 Rules）。

### 路径变量

- `${CURSOR_PLUGIN_ROOT}` 与 `${CLAUDE_PLUGIN_ROOT}` 在 MCP 配置的 `command`、`args`、`env`、
  `cwd` 中展开为插件安装路径 [U1][U4]。
- `${PLUGIN_ROOT}`、`${PLUGIN_DATA}` 在 Cursor 的 `mcp.json` 中 **不展开** [U1][U4]。
  VS Code / Copilot 对带 `$schema` 的根 `plugin.json` 展开这两个变量，见
  [GitHub Copilot](github-copilot-plugins.md)；跨平台插件不应依赖它们。

## marketplace

多插件仓库在根目录放 `.cursor-plugin/marketplace.json` [U1]：

- 必填：`name`（kebab-case）、`owner`（`name` 必填，`email` 可选）、`plugins[]`；
  每个条目必填 `name`。
- 可选：`metadata`（`description`、`version`、`pluginRoot`）。
- 条目可写 `name`、`source`、`description`、`version`、`author`、`homepage`、`repository`、
  `license`、`keywords`、`logo`、`category`、`tags`、组件路径、`hooks`、`mcpServers`、`variables`。
- 条目的 `source` 指向插件目录时，读取该插件自己的 manifest 并合并，manifest 中的值优先。
- 文件大小上限 10 MB。

## 发布

在 `cursor.com/marketplace/publish` 提交，要求 [U1]：

- 公开 git 仓库中有有效 manifest；
- 名称唯一，小写 kebab-case；描述清楚；
- logo 提交在仓库内并以相对路径引用；
- 已在本地测试；
- 所有 `${VAR}` 占位符都在 `variables` 中声明。

## Rules

- 项目规则位于 `.cursor/rules/`，必须使用 `.mdc` 扩展名；目录中的普通 `.md` 文件被规则系统
  忽略 [U2]。
- frontmatter 字段：`description`、`globs`、`alwaysApply` [U2]。
- 四种应用方式：始终应用、由 Agent 判断、按文件 glob 附加、`@` 手动引用 [U2]。
- 也支持项目根目录或子目录中的 `AGENTS.md`；用户规则在 Customize → Rules 中设置 [U2]。

## Hooks

加载来源（优先级从高到低）[U3]：

1. 企业级：macOS `/Library/Application Support/Cursor/hooks.json`，Linux `/etc/cursor/hooks.json`，
   Windows `C:\ProgramData\Cursor\hooks.json`
2. 团队级：控制台下发（企业版）
3. 项目级：`<project-root>/.cursor/hooks.json`
4. 用户级：`~/.cursor/hooks.json`

所有来源的 hooks 都会运行，优先级只用于合并冲突的决定：deny 优先于 ask，ask 优先于 allow。
文档未说明插件 `hooks/hooks.json` 在这一顺序中的位置 [U3]。

```json
{
  "version": 1,
  "hooks": {
    "beforeShellExecution": [{ "command": "./scripts/guard.sh", "timeout": 10 }]
  }
}
```

- 事件共 21 个 [U3]：
  - Agent 事件：`sessionStart`、`sessionEnd`、`preToolUse`、`postToolUse`、
    `postToolUseFailure`、`subagentStart`、`subagentStop`、`beforeShellExecution`、
    `afterShellExecution`、`beforeMCPExecution`、`afterMCPExecution`、`beforeReadFile`、
    `afterFileEdit`、`beforeSubmitPrompt`、`preCompact`、`stop`、`afterAgentResponse`、
    `afterAgentThought`
  - Tab 事件：`beforeTabFileRead`、`afterTabFileEdit`
  - 应用事件：`workspaceOpen`
- 处理器字段：`command`（必填）、`type`（`command` 或 `prompt`）、`timeout`、`loop_limit`、
  `failClosed`（默认 `false`）、`matcher` [U3]。
- 输入输出均为 JSON。退出码 0 时读取 stdout JSON；退出码 2 阻断 [U3]。
- hook 进程的环境变量：`CURSOR_PROJECT_DIR`、`CURSOR_VERSION`、`CURSOR_USER_EMAIL`、
  `CURSOR_TRANSCRIPT_PATH`、`CURSOR_CODE_REMOTE`、`CLAUDE_PROJECT_DIR`，以及 `sessionStart`
  返回的 `env`；文档没有插件根目录或插件数据目录变量，也没有插件持久数据目录约定 [U1][U3]。

### 扩展能力摘要

| 能力 | 支持情况 | 依据 |
|---|---|---|
| 执行前阻断 | 退出码 2；权限类 hook 可返回 deny / ask / allow | [U3] |
| 失败时的默认行为 | 其他非零退出码默认放行（fail-open）；设 `failClosed: true` 后，崩溃、超时、无输出均阻断；权限类 hook 输出非法 JSON 时一律阻断 | [U3] |
| 执行前改写工具入参 | 支持：`preToolUse` 返回 `updated_input` | [U3] |
| 执行后替换工具输出 | 部分：`updated_mcp_tool_output` 只对 MCP 工具生效；其他工具只能用 `additional_context` 追加上下文 | [U3] |
| 停机门禁 | 不支持阻止结束；`stop` 只能用 `followup_message` 让 Cursor 自动续发一条消息，续发轮数受 `loop_limit` 限制（默认 5） | [U3] |
| 进程内扩展 | 不支持 | [U1][U3] |

## 未核实项

以下来自早期调研报告，未在官方原文中核实：MCP 配置 `.cursor/mcp.json`（根键 `mcpServers`）；
Cursor 读取 `.claude/skills`、`.codex/skills`；本地测试目录 `~/.cursor/plugins/local`；
终端安装插件的 CLI 命令。

## 来源

- [U1] Plugins reference：<https://cursor.com/docs/reference/plugins>
- [U2] Rules：<https://cursor.com/docs/context/rules>
- [U3] Hooks：<https://cursor.com/docs/agent/hooks>
- [U4] Plugins：<https://cursor.com/docs/plugins>
