# Kiro Powers：开发方式与 manifest

本文说明 Kiro（AWS）的插件单位 Power 的 manifest 与目录结构、安装方式，以及 steering、hooks
等扩展文件的格式和控制语义。事实核对日期为 2026-10-13，以 `kiro.dev/docs` 为准；
官方文档各页之间存在矛盾的地方，文中逐项注明。横向对比见 [跨平台对比](cross-platform-comparison.md)。

## 概述

- Power 是 Kiro 的插件，把工具、工作流与专业知识打包成可安装单元，按对话中的关键词
  激活 [R1][R2]。
- Power 以根目录 `plugin.json` 为 manifest；旧版以 `POWER.md`
  为入口的 Power 仍可使用 [R2]。
- 已安装的 Power 在 Kiro IDE 1.0.437 及以上版本显示，并通过云端配置同步 [R1]。
- Power 目前不能携带 hooks，见下文 [Hooks](#hooks)。

## 目录结构

```text
power-name/
├── plugin.json          # 必需
├── mcp.json             # 可选，MCP 服务器
└── skills/              # 可选，Agent Skills
    └── setup/
        ├── SKILL.md
        └── scripts/
```

官方 Powers 文档只列出 `plugin.json`、`skills/`、`mcp.json` 三项 [R1][R2]。`dev.kiro/` 目录
（如 `dev.kiro/steering`）只在用户 issue 中出现，官方文档未记载；Power 中的
`dev.kiro/hooks/` 不会被加载 [R8]。

## plugin.json 字段

两份官方资料对必填字段的要求不同：

- kiro.dev 的创建页要求六个字段：`$schema`、`name`、`version`、`description`、`author`、
  `keywords` [R2]。
- Kiro 维护的 power-builder 参考只要求 `$schema` 与 `name` [R9]。

按较严格的六项填写可同时满足两者。

| 字段 | kiro.dev 要求 | 说明 |
|---|---|---|
| `$schema` | 必填 | `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json` |
| `name` | 必填 | kebab-case；安装后修改可能需要用户重装 |
| `version` | 必填 | semver |
| `description` | 必填 | 用途说明 |
| `author` | 必填 | 至少含 `name` |
| `keywords` | 必填 | 字符串数组，对话中命中时激活该 Power |
| `homepage`、`repository`、`license` | 可选 | 元数据 |

schema 根节点不允许额外字段（`additionalProperties: false`）。Kiro 专有的键应放在
`extensions."dev.kiro"` 下；在根节点写 `displayName` 之类的键会使 schema 校验失败 [R9]。

`mcp.json` 使用 `"type": "stdio"` 与 `command`、`args`、`env`；密钥通过 `"${SUPABASE_URL}"`
这类环境变量引用 [R2]。

示意写法：

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "team-db",
  "version": "0.1.0",
  "description": "团队数据库规范与查询工具",
  "author": { "name": "Example Team" },
  "keywords": ["database", "schema"]
}
```

## 安装与测试

- 安装来源：kiro.dev/powers 目录一键安装、GitHub URL、本地路径 [R1]。
- 本地测试：Powers 面板 → **Add Custom Power** → 从文件夹导入 [R2]。
- 发布：推送到公开 GitHub 仓库，他人在同一面板通过 URL 安装 [R2]。
- 早期调研报告提到的 `/powers install`、`kiro-cli powers install` 等命令未核实。

## Steering

- 位置：工作区 `.kiro/steering/`，全局 `~/.kiro/steering/` [R3]。
- frontmatter `inclusion` 取值；没有 frontmatter 的文件按 `always` 处理 [R3]：

| 取值 | 行为 | 附加字段 |
|---|---|---|
| `always` | 每次交互加载（默认） | — |
| `fileMatch` | 按文件模式条件加载 | `fileMatchPattern` |
| `manual` | 在对话中引用时加载 | — |
| `auto` | 描述与请求匹配时加载 | `name`、`description`（必填） |

- 工作区根目录及子目录中的 `AGENTS.md` 自动发现并始终加载，不支持 inclusion 模式 [R3]。
- 引用工作区文件：`#[[file:api/openapi.yaml]]` [R3]。

## Hooks

- 位置：项目 `.kiro/hooks/*.json`，文件名任意；kiro-cli V3 另读取 `~/.kiro/hooks/` [R4][R5]。
- 顶层：`version`（当前 `"v1"`）与 `hooks` 数组；每条含 `name`、`trigger`、`matcher`（可选）、
  `action`、`timeout`（秒，默认 60，`0` 表示不限时）、`enabled`、`confirm`、`description` [R4]。
- `action` 两种类型：`command`（执行 shell 命令，经 stdin 接收会话上下文）与 `agent`
  （向对话注入提示词）[R5]。
- 触发器名写法不统一：类型页用展示名（Prompt Submit、Agent Stop 等），JSON 示例用 PascalCase
  （`PreToolUse`、`PostToolUse`、`PostFileSave`、`Stop`），CLI 另有 `PreTaskExec`、
  `AgentSpawn`、`SessionEnd`、`Manual`；官方没有完整的 JSON 枚举表 [R4][R5][R7]。
- 早期 CLI 2.x 把 hooks 写在 agent 配置内，事件名为 camelCase（如 `agentSpawn`）[R7]。
- Power 不能携带 hooks：issue #11442（2026-09-17 仍开放）确认 Power 中的 `dev.kiro/hooks/`
  不会自动注册；#9007“Powers should be able to deliver hooks”已于 2026-09-15 以 stale 关闭 [R8]。
  需要 hooks 时，另行把 `.kiro/hooks/*.json` 安装到工作区。

### 扩展能力摘要

| 能力 | 支持情况 | 依据 |
|---|---|---|
| 执行前阻断 | `PreToolUse` 命令 hook 以退出码 2 阻断，stderr 回传给 agent | [R5] |
| 提示词阻断 | IDE 文档称可阻断 Prompt Submit，但 #11050 中维护者确认 IDE 在退出码 2 下未阻断，属文档错误与代码缺陷，仍未修复；CLI 不能，V3 的 `UserPromptSubmit` 非零退出时输出只作为上下文，提示照常发送 | [R5][R7][R8] |
| 其他非零退出码 | CLI：只有退出码 2 阻断 `PreToolUse` 与 `PreTaskExec`，其他退出码告警后继续，各页一致。IDE：actions 页称任何非零退出都阻断 Pre Tool Use 与 Prompt Submit，IDE 1.0 页称只有退出码 2 阻断、其他视为错误 | [R5][R6] |
| 超时后的行为 | 文档未说明放行还是阻断。IDE：60 秒后终止进程并按错误记录（#7915），hook 的 `timeout` 字段被忽略，实际取设置 `kiro.executeBashTimeoutMs`；CLI：actions 页写默认 30 秒（`timeout_ms`），hooks 总页写 60 秒（`timeout`） | [R4][R5][R8] |
| 执行前改写工具入参 | 官方文档未提供 | [R5] |
| 执行后替换工具输出 | 官方文档未提供；`PostToolUse` 不能阻断，只能追加指示 | [R5][R7] |
| 停机门禁 | CLI V3：`Stop` 以退出码 1 或返回 `{"decision":"block","reason":"..."}` 再运行一轮（退出码 2 不适用）；IDE 1.0：`Stop` 不能阻断 | [R6][R7] |
| 进程内扩展 | 不支持 | [R4] |

hook 进程没有文档化的插件数据目录：IDE 只记载 `USER_PROMPT` 变量，CLI 经 stdin 传 JSON
（含 `session_id`、`cwd`）并在项目根目录执行命令 [R4][R5]。

已知问题：kiro-cli V3 在 `kiro-cli chat --no-interactive` 下不加载 `.kiro/hooks`（#11598，
作为 #11281 的重复关闭）；IDE 的 `PreToolUse` / `PostToolUse` 命令 hook 收不到 `tool_name`、
`tool_input`（#7375、#7500）。在这些场景中，依赖 `PreToolUse` 的拦截不会生效 [R8]。

## 未核实项

以下来自早期调研报告，未在官方原文中核实：工作区 MCP 配置 `.kiro/settings/mcp.json` 与
用户级 `~/.kiro/settings/mcp.json`；自定义 agent 配置 `.kiro/agents/<name>.json`。

## 来源

- [R1] Powers：<https://kiro.dev/docs/powers/>
- [R2] Create powers：<https://kiro.dev/docs/powers/create/>
- [R3] Steering：<https://kiro.dev/docs/steering/>
- [R4] Hooks：<https://kiro.dev/docs/hooks/>
- [R5] Hook types 与 actions：<https://kiro.dev/docs/hooks/types/>、
  <https://kiro.dev/docs/hooks/actions/>
- [R6] IDE 1.0 hooks 变更：<https://kiro.dev/docs/ide/whats-new-v1/hooks/>
- [R7] CLI V3 hooks 迁移：<https://kiro.dev/docs/cli/v3/hooks-migration/>
- [R8] Issues：<https://github.com/kirodotdev/Kiro/issues/11442>、
  <https://github.com/kirodotdev/Kiro/issues/9007>、
  <https://github.com/kirodotdev/Kiro/issues/11598>、
  <https://github.com/kirodotdev/Kiro/issues/7375>、
  <https://github.com/kirodotdev/Kiro/issues/7915>、
  <https://github.com/kirodotdev/Kiro/issues/11050>
- [R9] power-builder 的 manifest 参考：
  <https://github.com/kirodotdev/powers>（`power-builder/skills/agent-plugins-reference/SKILL.md`）
