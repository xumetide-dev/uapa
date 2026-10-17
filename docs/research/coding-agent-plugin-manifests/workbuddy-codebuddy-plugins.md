# 腾讯 WorkBuddy 与 CodeBuddy 插件：开发方式与 manifest

本文说明腾讯 CodeBuddy Code（CLI）的插件 manifest、命令与 hooks 控制语义，以及 WorkBuddy
（面向办公场景的桌面智能体）如何复用该插件体系。事实核对日期为 2026-10-13。
CodeBuddy 文档同时发布在 `codebuddy.cn`、`codebuddy.ai`，`copilot.tencent.com/docs` 会 302
跳转到 `codebuddy.cn`。这些文档站对不存在的路径也返回 HTTP 200，引用时以页面实际内容为准。
横向对比见 [跨平台对比](cross-platform-comparison.md)。

> **阶段标记**：仅调研（SD-01）。UAPA 当前版本（v0.4.0）未将 CodeBuddy / WorkBuddy 列为
> 正式构建目标，本文仅为宿主生态调研与跨平台对比参考，不代表当前版本已提供该目标产物。

## 概述

- CodeBuddy Code 的插件体系兼容 Claude Code 插件格式：manifest 可选、仅 `name` 必填、
  组件默认目录与 Claude Code 一致 [B1]。
- WorkBuddy 的插件类型包括 Skill、MCP、Hook、Agent，可在客户端插件页安装，也可输入地址添加
  第三方插件市场 [B2]。
- WorkBuddy 与 CodeBuddy 共用插件 manifest 目录约定（`.workbuddy-plugin/` 是 CodeBuddy
  认可的位置之一）[B1]。

## plugin.json 位置

按优先级 [B1]：

1. `.codebuddy-plugin/plugin.json`
2. `.workbuddy-plugin/plugin.json`
3. `.claude-plugin/plugin.json`

同一插件存在多个位置时以 `.codebuddy-plugin/` 为准。

## 字段与默认目录

- manifest 可选；缺省时按默认目录发现组件，插件名取目录名 [B1]。
- 常用字段：`name`（必填）、`version`、`description`、`author`、`license`；组件路径字段为
  顶层的 `commands`、`agents`、`skills`、`hooks`、`mcpServers`、`lspServers`，没有
  `components` 包装层；自定义路径替换默认目录 [B1]。
- 插件内的 agent 不支持 `hooks`、`mcpServers`、`permissionMode` 字段 [B1]。

| 组件 | 默认位置 |
|---|---|
| Commands | `commands/` |
| Agents | `agents/` |
| Skills | `skills/` |
| Hooks | `hooks/hooks.json` |
| MCP 服务器 | `.mcp.json` |
| LSP 服务器 | `.lsp.json` |

路径变量（`CODEBUDDY_*` 优先，`CLAUDE_*` 兼容）[B1]：

| CodeBuddy | 兼容变量 | 含义 |
|---|---|---|
| `${CODEBUDDY_PLUGIN_ROOT}` | `${CLAUDE_PLUGIN_ROOT}` | 插件安装目录 |
| `${CODEBUDDY_PLUGIN_DATA}` | `${CLAUDE_PLUGIN_DATA}` | 持久数据目录 `~/.codebuddy/plugins/data/{id}/`；id 中 `[A-Za-z0-9_-]` 以外的字符替换为 `-` |
| `${CODEBUDDY_PROJECT_DIR}` | `${CLAUDE_PROJECT_DIR}` | 工作区根目录 |

插件版本号决定是否更新：修改插件内容而不改 `version`，已安装用户因缓存看不到变化
（经搜索摘要核对）。

## marketplace

- 文件位置：仓库内 `.codebuddy-plugin/marketplace.json`，含 `name`、`owner`、`plugins[]`
  （条目含 `name`、`source`、`description`、`version`）[B4]。文档未列出
  `.claude-plugin/marketplace.json` 等备选路径。
- 条目 `strict` 默认 `true`；跨 marketplace 依赖需在根 marketplace 的
  `allowCrossMarketplaceDependenciesOn` 中显式授权，信任不传递 [B1][B4]。
- 团队配置：`settings.json` 的 `enabledPlugins`（`"plugin@marketplace": true`）与
  `extraKnownMarketplaces`（经搜索摘要核对）。

## CLI 命令

```bash
codebuddy plugin validate ./my-plugin
```

```bash
codebuddy plugin marketplace add ./my-marketplace
```

```bash
codebuddy plugin install my-plugin@my-marketplace
```

- `validate` 除 `plugin.json` 外，还检查 skill / agent / command 的 frontmatter 与
  `hooks/hooks.json` 的语法和 schema [B1]。
- `install` 默认 scope 为 user，可用 `--scope` 指定；`list --json` 输出机器可读结果 [B7]。
- 另有 `plugin uninstall`（可加 `--prune`）、`plugin enable`、`plugin disable`、
  `plugin update`、`plugin list` [B1]。会话内可用 `/plugin` 交互浏览。
- 插件技能不显示时，清除 `~/.codebuddy/plugins/cache` 后重启（经搜索摘要核对）。

## Hooks

事件名与 Claude Code 同名。事件数量在文档中前后不一：概述称 27 种以上，详表列 10 个，
插件参考列 26 个 [B1][B5]。

- 退出码 0 成功；退出码 2 阻断，阻断原因**先取 stdout**，stdout 为空才取 stderr（与 Claude
  Code 不同）；其他非零退出码为非阻断错误，stderr 显示给用户，流程继续 [B5]。
- 超时：命令 hook 默认 60 秒，超时后终止该脚本，不影响其他 hook；prompt 型 hook 与最佳实践
  一节写的是 30 秒 [B5]。
- `PreToolUse` 改写入参的字段为 `modifiedInput`（部分字段覆盖）；文档中没有 Claude Code 的
  `updatedInput`，按 Claude Code 写法输出不会改到入参 [B5]。
- `PostToolUse`：`hookSpecificOutput.updatedToolOutput` 替换输出，对内置工具与 MCP 工具均
  生效；`additionalContext` 追加上下文，两者可同时返回；`decision: "block"` 已废弃 [B5]。
- `Stop`：返回 `continue: false` 加 `reason`，或退出码 2，表示阻止停止、让 Agent 继续；
  文档未给次数上限，输入中的 `stop_hook_active` 供 hook 判断是否已在续跑；旧的
  `decision: "block"` 已标废弃，是否仍生效未说明 [B5]。
- `hooks.json` 缺少 `"hooks"` 键或含未知顶层键时如何处理，文档未说明，未实测；跨平台插件
  应显式写出 `"hooks"` 键 [B1][B5]。
- `codebuddy plugin validate` 的文档称检查 `hooks/hooks.json` 的语法与 schema；它对未知字段
  是否报告未实测 [B1]。

`continue: false` 在 Claude Code 中表示终止整个处理，在 CodeBuddy 的 `Stop` 决策中表示继续
工作，同一页的公共字段一节又把它描述为“hook 执行后是否继续”。跨平台复用 `Stop` hook 时
不要依赖该字段。

### Mods（Beta）

CodeBuddy 提供与 Claude Code hooks 模块对应的 Mods 通道 [B8]：

- `hooks/hooks.json` 含 `modules` 数组时该插件目录走 Mods 通道，否则走传统 hooks 通道；
  Mods 不替换传统 hooks，两者可同时启用。
- 目录须含 `.codebuddy-plugin/plugin.json` 或 `.claude-plugin/plugin.json`；Mod 加载失败时
  记入跳过列表，不阻塞宿主。
- 文档称 Claude Code 生态的 Mod 目录可经 `--plugin-dir` 原样加载；类型从 `'codebuddy-code'`
  导入，文档未逐项对照 Claude Code 的 `register` / `on` / `$`。`$.http.fetch` 与
  `$.process.run` 标为未开放，Desktop 与 VS Code 端仍在接入中。
- 版本：按 npm 包 CHANGELOG，2.163.0（2026-10-09）起默认开启，设
  `CBC_ENABLE_FUNCTION_HOOKS=0` 关闭；2.164.0 起可原样运行 Claude Code 示例 mod [B9]。
  运行 TypeScript 模块需要 Node 22.15+，Node 20 或含 JSX 时需要可选依赖 esbuild [B8]。
- 同一 `hooks.json` 同时含 `hooks` 与 `modules` 时，命令 hooks 与 Mod 是否在同一事件上都
  执行，文档未说明，未实测。

### 扩展能力摘要

| 能力 | 支持情况 | 依据 |
|---|---|---|
| 执行前阻断 | 退出码 2，原因先取 stdout | [B5] |
| 失败时的默认行为 | 其他非零退出码与超时均放行（fail-open） | [B5] |
| 执行前改写工具入参 | 支持：`modifiedInput`（部分覆盖） | [B5] |
| 执行后替换工具输出 | 支持：`updatedToolOutput`，适用于全部工具 | [B5] |
| 停机门禁 | 支持：`continue: false` + `reason` 或退出码 2；无文档化的次数上限 | [B5] |
| 进程内扩展 | Mods（Beta），以 `hooks.json` 的 `modules` 键区分通道 | [B8][B9] |

## WorkBuddy 的扩展

| 扩展 | 位置与形式 | 依据 |
|---|---|---|
| 插件 | 客户端插件页安装；支持添加第三方插件市场地址 | [B2] |
| Skills | 用户级 `~/.workbuddy/skills/`，项目级 `.workbuddy/skills/`，每个技能一个 `SKILL.md` 目录 | 只有社区资料佐证【社区】 |
| 技能市场 | SkillHub；兼容 OpenClaw 技能包与 ClawHub | 社区文章【社区】 |
| MCP | 客户端内编辑 `mcp.json` | 社区文章【社区】 |
| 专家（开放平台） | 专家包 `plugin.json` 含 `displayName`、`profession`、`displayDescription`、`avatar`、`categoryId`、`defaultInitPrompt` 等 | 开放平台文档，经搜索摘要核对 |

- 官方文档记载的配置目录变量是 `CODEBUDDY_CONFIG_DIR` [B6]。社区记录称设置
  `WORKBUDDY_CONFIG_DIR=~/.workbuddy` 后，`codebuddy plugin` 命令直接写入 WorkBuddy 桌面端的
  插件注册表；该变量只出现在第三方代码中，官方文档未记载【社区】。
- 社区文章中 `SKILL.md` 的 `version`、`tags`、`trigger phrases` 等扩展字段未在官方文档中核实。
- WorkBuddy 插件页只有概览，不含路径与 manifest 信息 [B2]。

## 来源

- [B1] CodeBuddy 插件参考：<https://www.codebuddy.cn/docs/cli/plugins-reference>
- [B2] WorkBuddy 插件系统：<https://www.workbuddy.cn/docs/workbuddy/Plugins>
- [B3] WorkBuddy 技能：
  <https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Skills-Market>
- [B4] CodeBuddy 插件市场：<https://www.codebuddy.cn/docs/cli/plugin-marketplaces>
- [B5] CodeBuddy hooks：<https://www.codebuddy.cn/docs/cli/hooks>
- [B6] CodeBuddy 环境变量：<https://www.codebuddy.cn/docs/cli/env-vars>
- [B7] CodeBuddy 插件：<https://www.codebuddy.cn/docs/cli/plugins>
- [B8] CodeBuddy Mods：<https://www.codebuddy.cn/docs/cli/mods>
- [B9] npm 包 `@tencent-ai/codebuddy-code@2.164.0` 的 `CHANGELOG.md`：
  <https://unpkg.com/@tencent-ai/codebuddy-code@2.164.0/CHANGELOG.md>
- WorkBuddy 开放平台：<https://open.workbuddy.cn/docs/expert>（经搜索摘要核对）
- 【社区】WorkBuddy 宿主集成实测：<https://github.com/lorelum/lorelum/issues/205>
- 【社区】WorkBuddy 技能系统指南：<https://cloud.tencent.com/developer/article/2693324>
