# OpenCode 插件：开发方式与配置

本文说明 OpenCode 插件的代码形态、加载位置、hooks 与事件、相关扩展点及配置格式。
事实核对日期为 2026-10-13，以 `opencode.ai/docs` 与 `anomalyco/opencode` v1.19.0
（2026-10-11 发布）源码为准。其他平台见 [Claude Code](claude-code-plugins.md)、
[Codex](codex-plugins.md)，横向对比见 [跨平台对比](cross-platform-comparison.md)。

## 概述

- OpenCode 插件是 JavaScript / TypeScript 模块，导出一个或多个插件函数；
  每个函数接收上下文对象，返回 hooks 对象，运行在 OpenCode 进程内（Bun）[O1]。
- OpenCode **没有独立的插件 manifest 文件**。本地插件靠目录约定加载，
  npm 插件在 `opencode.json` 的 `plugin` 数组中声明（元素为包名字符串或 `[name, options]`）；
  npm 包的元数据即 `package.json`。
- 插件只承载运行时代码（hooks、自定义工具）；agents、commands、skills、MCP 各有独立的
  文件或配置入口，不经由插件打包。

## 插件形态

官方文档中的写法是普通 async 函数导出 [O1]：

```ts
import type { Plugin } from "@opencode-ai/plugin"

export const AuditPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  return {
    "tool.execute.before": async (input, output) => {
      // 在工具执行前检查或原地改写 output.args；抛出错误可阻止本次调用
    },
    "tool.execute.after": async (input, output) => {
      // 在工具执行后检查或原地改写 output.output（字符串）
    },
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        await client.app.log({ body: { service: "audit", level: "info", message: "idle" } })
      }
    },
  }
}
```

上下文字段 [O1][O4]：

| 字段 | 含义 |
|---|---|
| `project` | 当前项目信息 |
| `directory` | 当前工作目录 |
| `worktree` | git worktree 根目录 |
| `client` | OpenCode SDK 客户端，可调用会话、日志等接口 |
| `$` | Bun shell，用于执行命令 |
| `serverUrl`、`experimental_workspace` | 类型定义中另有的字段，文档未展开 |

类型包为 `@opencode-ai/plugin`；日志用 `client.app.log()`，`level` 取
`debug`、`info`、`warn`、`error` [O1]。

v1.19.0 的 `@opencode-ai/plugin` 已导出 `./v2/promise` 与 `./v2/effect`，dev 分支出现
`Plugin.define({ id, setup })` 形式的 V2 API；V2 尚未进入官方文档，上述函数形式仍是现行标准 [O4]。

## 加载位置与顺序

| 来源 | 位置 |
|---|---|
| 项目插件目录 | `.opencode/plugins/` |
| 全局插件目录 | `~/.config/opencode/plugins/` |
| npm 插件 | `opencode.json` 的 `"plugin": [...]`（键名为单数 `plugin`） |

加载顺序：全局配置 → 项目配置 → 全局插件目录 → 项目插件目录；同名同版本的 npm 包只加载一次 [O1]。

依赖处理 [O1]：

- npm 插件由 Bun 安装，缓存在 `~/.cache/opencode/node_modules/`。
- 本地插件需要第三方依赖时，在配置目录（如 `.opencode/`）放 `package.json`，
  OpenCode 启动时运行 `bun install`。

## Hooks 与事件

插件返回对象中的键分两类：直接拦截的 hook（如 `tool.execute.before`），以及通过
`event` 统一接收的事件。官方文档列出的名称如下 [O1]：

| 类别 | 名称 |
|---|---|
| Command | `command.executed` |
| File | `file.edited`、`file.watcher.updated` |
| Installation | `installation.updated` |
| LSP | `lsp.client.diagnostics`、`lsp.updated` |
| Message | `message.part.removed`、`message.part.updated`、`message.removed`、`message.updated` |
| Permission | `permission.asked`、`permission.replied` |
| Server | `server.connected` |
| Session | `session.created`、`session.compacted`、`session.deleted`、`session.diff`、`session.error`、`session.idle`、`session.status`、`session.updated` |
| Todo | `todo.updated` |
| Shell | `shell.env` |
| Tool | `tool.execute.before`、`tool.execute.after` |
| TUI | `tui.prompt.append`、`tui.command.execute`、`tui.toast.show` |
| 实验性 | `experimental.session.compacting` |

文档的事件列表混入了 hook 名：`shell.env`、`tool.execute.*`、
`experimental.session.compacting` 是 hook，不能通过 `event` 订阅 [O4]。
`chat.message`、`chat.params`、`chat.headers`、`auth`、`config`、`permission.ask`、
`command.execute.before`、`tool.definition` 等 hook 存在于 v1.19.0 的 `Hooks` 类型中，
但官方文档未记载，接口稳定性未知 [O4]。

## 扩展能力摘要

| 能力 | 支持情况 | 依据 |
|---|---|---|
| 执行前改写工具入参 | 支持：原地修改 `output.args` | [O1][O4] |
| 执行前阻断 | 支持：在 `tool.execute.before` 中抛出错误 | [O1] |
| 执行后替换工具输出 | 支持：原地修改 `output.output`（字符串；类型定义可见，文档无示例） | [O4] |
| 阻止 agent 结束（停机门禁） | 不支持：`session.idle` 只是事件通知 | [O4] |
| 插件持久数据目录 | v1 无文档约定；dev 分支 V2 API 提供 `ctx.storage` | [O4] |
| 运行方式 | 进程内模块，不经子进程 | [O1] |

## 插件内自定义工具

插件返回对象的 `tool` 键注册工具；工具用 `tool()` 构造，含 `description`、
`args`（基于 Zod 的 `tool.schema`）与 `execute()`。插件工具与内置工具同名时，
插件工具优先 [O1]。不经插件时，也可把单个工具文件放进 `.opencode/tools/` 或
`~/.config/opencode/tools/`，文件名即工具名（来源为
<https://opencode.ai/docs/custom-tools/>，未逐字核实）。

## 其他扩展点

| 扩展点 | 位置与格式 | 来源 |
|---|---|---|
| Skills | `SKILL.md`，见下文 | [O2] |
| MCP | `opencode.json` 的 `mcp` 键 | [O3] |
| Agents | Markdown + YAML frontmatter，`.opencode/agents/` 或配置内联 | 未逐字核实 |
| Commands | Markdown + YAML frontmatter，`.opencode/commands/` 或 `command` 配置 | 未逐字核实 |
| Formatter / LSP | `opencode.json` 的 `formatter`、`lsp` 键 | 未逐字核实 |

### Skills

发现位置（项目级从工作目录向上查找到 git worktree 根目录）[O2]：

- `.opencode/skills/<name>/SKILL.md`、`~/.config/opencode/skills/<name>/SKILL.md`
- `.claude/skills/<name>/SKILL.md`、`~/.claude/skills/<name>/SKILL.md`
- `.agents/skills/<name>/SKILL.md`、`~/.agents/skills/<name>/SKILL.md`

frontmatter 识别 `name`、`description`（必填）与 `license`、`compatibility`、`metadata`；
`name` 须匹配 `^[a-z0-9]+(-[a-z0-9]+)*$` 且与目录名一致，`description` 1～1024 字符 [O2]。
访问控制写在 `opencode.json` 的 `permission.skill`，值为 `allow`、`deny`、`ask`，支持通配；
对某个 agent 关闭 skill 工具用 `"tools": { "skill": false }` [O2]。

### MCP

顶层键为 `mcp`，每个服务器按 `type` 区分 [O3]：

- `local`：`command`（数组，含程序与参数）、`environment`、`enabled`、`timeout`
- `remote`：`url`、`headers`、`oauth`（对象，或 `false` 关闭自动探测）、`enabled`

## 配置文件

- `opencode.json` / `opencode.jsonc`，`$schema` 为 `https://opencode.ai/config.json`
  （与官方配置页一致性未逐字核实）。
- 全局配置位于 `~/.config/opencode/opencode.json` [O1]。

## npm 发布约定

官方文档未规定插件包的 `package.json` 字段。社区做法是：入口指向构建产物，
`@opencode-ai/plugin` 作为类型依赖，并在 `keywords` 中加入 `opencode-plugin` 便于检索【社区】。

## 来源

- [O1] Plugins：<https://opencode.ai/docs/plugins/>
- [O2] Agent Skills：<https://opencode.ai/docs/skills/>
- [O3] MCP servers：<https://opencode.ai/docs/mcp-servers/>
- [O4] 插件类型定义（v1.19.0）：
  <https://github.com/anomalyco/opencode/blob/v1.19.0/packages/plugin/src/index.ts>
  （源码仓库已由 `sst/opencode` 迁至 `anomalyco/opencode`）
