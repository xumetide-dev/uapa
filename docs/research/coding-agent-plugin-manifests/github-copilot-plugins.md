# GitHub Copilot 插件：开发方式与 manifest

本文说明 GitHub Copilot 在 VS Code 与 Copilot CLI 中的 agent 插件（agent plugins）格式、
marketplace、安装方式与 hooks 配置和控制语义。事实核对日期为 2026-10-13。
横向对比见 [跨平台对比](cross-platform-comparison.md)。

## 概述

- agent 插件是预打包的 agent 定制集合，可从插件 marketplace 发现并安装 [G1]。
- 推荐 manifest 为带 `$schema` 的根目录 `plugin.json`（下称 `$schema` 格式）[G1][G2]。
- VS Code 按标记识别四种格式 [G1]：

| 格式 | 判定依据 |
|---|---|
| `$schema` 格式 | 根 `plugin.json` 的 `$schema` 为 `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json` |
| Copilot 格式 | 根 `plugin.json`，无 `$schema` |
| Claude 格式 | `.claude-plugin/plugin.json` |
| 旧版 OpenPlugin | `.plugin/plugin.json` |

- Copilot CLI 另接受 1.1.0 版本的 `$schema` URL。`$schema` 格式优先级最高；其余旧格式依次
  查找 `.plugin/plugin.json`、`plugin.json`、`.github/plugin/plugin.json`、
  `.claude-plugin/plugin.json` [G5]。

## plugin.json 字段

`$schema` 格式的顶层字段是封闭集合，共 10 个；未知字段会被报告并忽略 [G1][G2]：

| 字段 | 必填 | 说明 |
|---|---|---|
| `$schema` | 是 | 取值见上表 |
| `name` | 是 | 插件标识 |
| `version`、`description`、`author`、`homepage`、`repository`、`license`、`keywords` | 否 | 元数据 |
| `extensions` | 否 | 客户端专有数据，按反向域名命名空间组织；VS Code 只读 `com.github.copilot` |

`$schema` 格式的组件路径固定，不能在 `plugin.json` 中覆盖。旧版 Copilot 格式才支持
用 `agents`、`skills`、`hooks`、`mcpServers` 等字段指定组件路径 [G1][G2]。

## 组件

| 组件 | `$schema` 格式中的位置 |
|---|---|
| MCP 服务器 | `mcp.json` |
| Skills | `skills/<name>/SKILL.md` |
| 自定义 agents | `com.github.copilot/agents/*.agent.md` |
| Hooks | `com.github.copilot/hooks/hooks.json` |
| 斜杠命令 | `com.github.copilot/commands/` |

- 声明 `$schema` 后，Copilot 专有组件必须放在 `com.github.copilot/` 下 [G1]。
- 根目录 `hooks.json` 只属于旧版 Copilot 格式；Claude 格式使用 `.mcp.json` 与
  `hooks/hooks.json` [G1][G5]。
- 另有 rules、LSP（`lsp.json`）等组件，位置见 [G5]。

### 路径变量

| 变量 | 适用格式 |
|---|---|
| `${PLUGIN_ROOT}` | `$schema` 格式、Copilot 旧格式、OpenPlugin |
| `${CLAUDE_PLUGIN_ROOT}` | Claude、Copilot 旧格式 |
| `${PLUGIN_DATA}` | 只用于 `$schema` 格式 |

- Copilot CLI 另接受别名 `CLAUDE_PLUGIN_DATA`、`COPILOT_PLUGIN_ROOT`、`COPILOT_PLUGIN_DATA` [G5]。
- 插件 hook 进程的环境变量：1.0.12 起有 `CLAUDE_PROJECT_DIR`、`CLAUDE_PLUGIN_DATA`，1.0.26 起
  有 `PLUGIN_ROOT`、`COPILOT_PLUGIN_ROOT`、`CLAUDE_PLUGIN_ROOT`；hooks 参考在沙箱一节写明插件
  hook 可写入 `$COPILOT_PLUGIN_DATA`。数据目录位于 `~/.copilot/plugin-data/` 下，按
  marketplace 与插件名分目录，可经 `COPILOT_HOME` 改变位置 [G4][G5][G6]。
- 远程 MCP 的配置值不做变量展开 [G1]。
- Cursor 不展开 `${PLUGIN_ROOT}`、`${PLUGIN_DATA}`，见 [Cursor](cursor-plugins.md)。

## marketplace

- 文件位置：`.github/plugin/marketplace.json`；Copilot CLI 也读取
  `.claude-plugin/marketplace.json` [G3][G5]。
- 顶层字段：`name`、`owner`（`name` 必填，`email` 可选）、`plugins[]` 必填；`metadata`
  （`description`、`version`、`pluginRoot`）可选 [G3][G5]。
- 条目字段：`name`、`source` 必填（插件目录相对路径，`./` 前缀可省略），另有 `description`、
  `version`、`strict`（默认 `true`）、`lspServers` [G3][G5]。
- VS Code 默认从 `copilot-plugins` 与 `awesome-copilot` 两个仓库发现插件 [G1]。

## 安装与配置

VS Code [G1]：

- 设置键：`chat.plugins.enabled`、`chat.plugins.marketplaces`、`chat.pluginLocations`
  （值为路径到 `true` / `false` 的映射）、`chat.useHooks`、`extensions.autoUpdate`。
- 设置 `allowManagedHooksOnly: true` 时，只有被托管配置 `enabledPlugins` 强制启用的插件，
  其 hooks 才会运行。
- 安装入口：扩展视图的 `@agentPlugins` 筛选、Agent Customizations 编辑器的 Browse Marketplace、
  命令 **Chat: Install Plugin From Source**（输入 git 仓库 URL）；也会自动发现 Copilot CLI
  安装目录中的插件。

Copilot CLI [G2][G3][G5]：

```bash
copilot plugin marketplace add octo-org/octo-repo
```

```bash
copilot plugin install ./my-plugin
```

```bash
copilot plugin list
```

```bash
copilot plugin uninstall my-plugin
```

- 从 marketplace 安装写作 `plugin@marketplace`；`uninstall` 的参数是 `plugin.json` 中的
  `name`，不是目录路径。
- 另有 `update`、`enable`、`disable` 与 `marketplace list|browse|update|remove`。
- 会话内用 `/plugin list`、`/agent`、`/skills list` 检查加载结果。

## Hooks

Copilot CLI 按以下来源加载 hooks [G4]：

| 层级 | 位置 |
|---|---|
| 策略 | `/etc/github-copilot/policy.d/*.json`；Windows 为 `C:\ProgramData\GitHub\Copilot\policy.d\*.json` 或 HKLM 注册表 |
| 仓库 | `.github/hooks/*.json`；`.github/copilot/settings.json` 与 `.claude/settings*.json` 的 `hooks` 字段 |
| 用户 | `~/.copilot/hooks/*.json`、`~/.copilot/settings.json` |
| 插件 | 插件目录内的 `hooks.json` 或 `hooks/hooks.json` |

Copilot 云端 agent 只读取 `.github/hooks/*.json`，不读取策略目录 [G4]。

```json
{
  "version": 1,
  "disableAllHooks": false,
  "hooks": {
    "preToolUse": [{ "type": "command", "bash": "./scripts/guard.sh", "timeoutSec": 30 }]
  }
}
```

- CLI 事件共 14 个：`sessionStart`、`sessionEnd`、`userPromptSubmitted`、
  `userPromptTransformed`、`preToolUse`、`postToolUse`、`postToolUseFailure`、
  `permissionRequest`、`preCompact`、`subagentStart`、`subagentStop`、`agentStop`、
  `notification`、`errorOccurred` [G4]。使用 PascalCase 事件名时，输入采用 VS Code
  兼容的 payload 格式。
- VS Code 本地运行的 hooks 只支持 8 个 PascalCase 事件：`SessionStart`、`UserPromptSubmit`、
  `PreToolUse`、`PostToolUse`、`PreCompact`、`SubagentStart`、`SubagentStop`、`Stop`；
  接受 `matcher` 写法但忽略其值 [G1]。CLI 的 14 个事件不能直接视为 VS Code 也支持。
- 处理器 `type` 取 `command`、`http`、`prompt`（`prompt` 只用于 `sessionStart`）[G4]。
- 命令处理器字段：`bash`、`powershell`、`command`、`exec` 与 `args`（仅 CLI；`exec` 不能与
  前三者同时使用）、`cwd`、`env`、`timeoutSec`（默认 30；别名 `timeout` 只在未写
  `timeoutSec` 时生效）[G4]。

### 扩展能力摘要

以下为 Copilot CLI hooks 的语义；VS Code 只覆盖上述 8 个事件 [G1][G4]。

| 能力 | 支持情况 | 依据 |
|---|---|---|
| 执行前阻断 | 退出码 2；或返回 `permissionDecision: "deny"` 并必须附 `permissionDecisionReason`；云端 agent 把 `"ask"` 按 `"deny"` 处理 | [G4] |
| 失败时的默认行为 | `preToolUse` 遇到其他非零退出码时拒绝（fail-closed）；超时对所有事件放行（fail-open），包括 `preToolUse` 与管理员下发的策略 hook | [G4] |
| 执行前改写工具入参 | 支持：返回 `modifiedArgs` | [G4] |
| 执行后替换工具输出 | 支持：`postToolUse` 返回 `modifiedResult`（含 `resultType`、`textResultForLlm`），可另加 `additionalContext`；文档未说明如何完全隐藏输出 | [G4] |
| 停机门禁 | `agentStop` 返回 `decision: "block"` 与 `reason` 时再运行一轮；连续 8 次后 CLI 仍会结束 | [G4] |
| 进程内扩展 | 不支持 | [G1][G4] |

## 其他定制文件

以下内容来自早期调研报告，未逐字核实：

- 指令：`.github/copilot-instructions.md`；路径级指令 `.github/instructions/*.instructions.md`
  （frontmatter `applyTo`）。
- 提示词文件：`.github/prompts/*.prompt.md`（frontmatter 含 `description`、`agent`、`model`、`tools`）。
- 自定义 agent：`.github/agents/*.agent.md`；skills：`.github/skills/<name>/SKILL.md`。
- MCP：VS Code `.vscode/mcp.json` 的根键为 `servers`；Copilot CLI 使用 `mcpServers`。
- 基于 GitHub App 的 Copilot Extensions 已于 2025-11-10 停用，官方转向 MCP。

## 来源

- [G1] VS Code Agent plugins：<https://code.visualstudio.com/docs/copilot/customization/agent-plugins>
- [G2] Creating a plugin for Copilot CLI：
  <https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-creating>
- [G3] Creating a plugin marketplace：
  <https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-marketplace>
- [G4] Hooks configuration：<https://docs.github.com/en/copilot/reference/hooks-configuration>
- [G5] Copilot CLI plugin reference：
  <https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference>
- [G6] Copilot CLI changelog（1.0.12、1.0.26）：
  <https://github.com/github/copilot-cli/blob/main/changelog.md>
