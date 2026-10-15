# 源项目结构

本文说明源项目中各组件放在哪里、怎样写，以及构建后它们在各宿主插件目录中的位置。配置字段见
[构建配置](configuration.md)，守卫文件的写法见[编写守卫](guards.md)。组件的读取规则与验收标准
以[功能清单「源项目与配置」](../feature-list/modules/01-source-config.md)与
[范围决策 SD-30、SD-32、SD-33](../feature-list/scope-decisions.md) 为准。

## 概述

源项目的根目录是 `uapa.config.ts` 所在的目录，配置中的相对路径都以它为基准：

```text
<源项目>/
├── uapa.config.ts          构建配置
├── guard.ts                守卫逻辑（文件名由配置的 guard 指定）
├── skills/<name>/SKILL.md  skills
├── agents/<name>.md        agents
├── rules/<name>.md         rules（规则与指令）
├── commands/<name>.md      commands（斜杠命令）
├── mcp/servers.json        MCP 服务器
└── overrides/<宿主>/       覆盖或新增到某个宿主插件目录中的文件
```

各目录都是可选的。构建只复制 skills、agents、commands 与覆盖文件，rules、MCP 配置与 hooks 配置
由 UAPA 按宿主格式生成；源项目中的其他文件（README、测试、脚本）不进入插件目录。

| 组件 | Claude Code | Codex | agy |
|---|---|---|---|
| skills | `skills/<name>/` | `skills/<name>/` | `skills/<name>/` |
| agents | `agents/<name>.md` | 不承载，记为跳过 | `agents/<name>.md` |
| rules | 不承载，记为跳过 | 不承载，记为跳过 | `rules/<name>.md`，frontmatter 换为 agy 的写法 |
| commands | `commands/<name>.md` | `commands/<name>.md`，安装时转换为技能 | 不承载，记为跳过 |
| MCP 服务器 | `.mcp.json` | `mcp.json`，manifest 的 `mcpServers` 指向它 | `mcp_config.json` |
| 守卫 hooks | `hooks/hooks.json` 与入口 | `hooks/hooks.json`（可由 `hooksFile` 改）与入口 | `hooks.json` 与入口 |

## skills

每个 skill 是 `skills/` 下的一个目录，含 `SKILL.md` 与它引用的其他文件；目录中的全部文件原样
复制。`skills/` 下不是目录的项（如说明文件）被忽略。

```markdown
---
name: commit-message
description: 按 Conventional Commits 写提交信息
---

提交信息第一行写作 `<type>: <说明>`。
```

- `name` 与目录名相同，`description` 为非空字符串；不符合时构建以退出码 2 结束。
- 三个宿主都从插件目录的 `skills/` 加载 skills。

## agents

每个 agent 是 `agents/` 下一层的 `<name>.md`，子目录与其他扩展名的文件被忽略：

```markdown
---
name: reviewer
description: 审查改动并按严重程度列出问题，不修改文件
---

你是代码审查者。只阅读改动，按严重程度列出问题，不修改文件。
```

- `name` 与文件名（不含 `.md`）相同，`description` 为非空字符串。
- Claude Code 与 agy 加载插件目录的 `agents/`。Codex 的插件不承载 agents：该目标的构建报告
  `skipped` 中写 `agents/<name>.md`，其余组件照常生成。

## rules

每条规则是 `rules/` 下一层的 `<name>.md`，`<name>` 只含字母、数字、`_`、`-`。frontmatter 用宿主
无关的写法描述规则何时进入上下文，正文原样保留：

```markdown
---
activation: glob
description: 编辑 TypeScript 文件时
globs: ["*.ts", "src/**/*.tsx"]
---

不使用 any；导出的函数写明返回类型。
```

- `activation` 必填：`always` 始终进入上下文；`model` 由模型按 `description` 决定是否读取，
  `description` 必填；`glob` 在读取匹配 `globs` 中任一模式的文件后进入上下文。
- `description` 可选（`model` 时必填），为非空单行字符串。
- `globs` 只在 `activation` 为 `glob` 时写，为非空的字符串列表；每个模式不含 `,` 与换行，因为
  agy 以逗号连接多个模式。
- frontmatter 中这三个键与 `targets` 以外的键一律拒绝：生成时 frontmatter 被重写，其他键会被
  丢弃。
- 只有 agy 承载 rules：`activation` 依次换为 `trigger: always_on`、`model_decision`、`glob`，
  `globs` 写为以 `,` 连接的一个字符串。Claude Code 与 Codex 的插件没有规则组件，未写 `targets`
  的规则在它们的构建报告 `skipped` 中写为 `rules/<name>.md`。

## commands

每个命令是 `commands/` 下一层的 `<name>.md`，`<name>` 只含字母、数字、`_`、`-`。整个文件原样
复制：

```markdown
---
description: 审查当前改动并列出问题
argument-hint: <文件>
---

审查当前工作区的改动，按严重程度列出问题。
```

- `description` 必填，为非空字符串；除 `targets` 外的其他键不校验，留给宿主解释。
- Claude Code 以 `/<插件名>:<name>` 调用命令。
- Codex 在安装插件时把命令转换为技能；正文含 `$ARGUMENTS`、`$1` 等模板写法或转换结果超过
  4000 字节的命令被 Codex 跳过，UAPA 不检查这些条件，在构建报告的残余风险中提示。
- agy 的插件没有斜杠命令组件，未写 `targets` 的命令在其构建报告 `skipped` 中写为
  `commands/<name>.md`。

## 限定目标的 frontmatter

skill、agent、rule 与 command 的 frontmatter 可写 `targets`，只放进列出的目标：

```markdown
---
name: agy-helper
description: 只在 agy 中使用的辅助 agent
targets: [agy:subprocess]
---
```

- 未写 `targets` 时适用于全部已配置目标；写了就必须是非空的已登记目标名列表。
- 列出的目标不能承载该组件时（如 agent 写 `targets: [codex:subprocess]`、rule 写
  `targets: [claude-code:subprocess]`），该目标构建失败。
- 宿主按目录加载组件。两个目标共用一个插件目录时（Claude Code 的两个目标，或合并布局），只适用
  于其中一个目标的组件仍会被另一个目标的宿主加载，构建报告把这种情况写为残余风险。

## MCP 服务器

`mcp/servers.json` 的顶层只有 `mcpServers`，键为服务器名（字母、数字、`_`、`-`）：

```json
{
  "mcpServers": {
    "team-docs": {
      "command": "node",
      "args": ["{pluginRoot}/mcp/server.mjs"],
      "env": { "TEAM_DOCS_DIR": "{pluginRoot}/docs" }
    },
    "issues": {
      "url": "https://mcp.example.com/mcp"
    }
  }
}
```

- 本地服务器写 `command`（必填）、`args`、`env`；远程服务器写 `url`（必填）、`headers`。两类
  字段不能混用，其他字段为输入错误。
- `{pluginRoot}` 表示安装后的插件目录，只能用在本地服务器的这三个字段中。它引用的文件
  （上例的 `mcp/server.mjs`）不由 UAPA 复制，须放在[覆盖文件](#覆盖文件)中。

各宿主对 `{pluginRoot}` 的换算：

| 宿主 | `command` 中 | `args`、`env` 中 |
|---|---|---|
| Claude Code | `${CLAUDE_PLUGIN_ROOT}` | `${CLAUDE_PLUGIN_ROOT}` |
| Codex | 不能换算，该服务器记为跳过 | `.`，并为该服务器写 `"cwd": "."` |
| agy | 不能换算，该服务器记为跳过 | `.`；服务器以插件目录为工作目录 |

- 需要在三个宿主中都可用的本地服务器，`command` 写 PATH 中的程序（如 `node`），把脚本路径写在
  `args` 中。
- Codex 与 agy 把 `env` 的值原样传给服务器（上例为 `./docs`），服务器应按工作目录解析相对路径。
- 远程服务器：Claude Code 与 Codex 写 `"type": "http"`，Codex 的请求头写为 `http_headers`；agy
  的 `url` 写为 `serverUrl`。
- Codex 不为插件的服务器名加命名空间，与用户配置或其他插件重名时插件的服务器可能不生效（构建
  报告的残余风险）；agy 以 `<插件名>_<服务器名>` 命名。

宿主事实的出处（codex-cli 0.162.1、agy 1.3.5）：
[Codex「容器实测」](../research/coding-agent-plugin-manifests/codex-plugins.md#容器实测01621)、
[agy「组件」](../research/coding-agent-plugin-manifests/agy-plugins.md#组件)。

## 覆盖文件

`overrides/<宿主>/` 中的文件在生成之后、写出之前复制到该宿主插件目录中的同一相对路径：与生成的
文件同名时覆盖它，否则新增。

```text
overrides/
├── claude-code/mcp/server.mjs
├── codex/mcp/server.mjs
└── agy/mcp/server.mjs
```

- 目录名只能是已配置目标的宿主：`claude-code`、`codex`、`agy`；其他目录名为输入错误。
- 每个用到某文件的宿主各放一份，UAPA 不在宿主之间共享覆盖文件。
- 覆盖文件不做字段检查。覆盖 manifest 或 hooks 配置会整体替换生成的文件，守卫可能因此失效；
  优先用配置中的[宿主选项](configuration.md#宿主选项)。
- 每个被覆盖或新增的文件写入该宿主各目标构建报告的 `overridden`。

## 守卫文件

配置的 `guard` 指向一个 TypeScript 文件，默认导出 `GuardPlugin`。它与配置一样以 Node 的类型剥离
导入：相对导入写 `.ts` 扩展名，不用 `enum`、`namespace` 与参数属性等需要编译的语法。写法见
[编写守卫](guards.md)。
