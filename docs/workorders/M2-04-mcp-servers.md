# 施工单 M2-04：MCP 服务器

> 读取源项目的 `mcp/servers.json`（规范形式），由三个宿主模块各自生成 MCP 配置：Claude Code
> 的 `.mcp.json`、Codex 的 `mcp.json`、agy 的 `mcp_config.json`；插件根无法换算为宿主变量的
> 服务器列为跳过。`components` 夹具加入 MCP 服务器。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M2-00](M2-00-v0-2-0-three-host-completion.md) |
| 覆盖功能点 | `F-01-08`、`F-05-12`、`F-06-06`、`F-11-08` |
| 依赖工单 | [M2-03](M2-03-agents-component.md) |
| 关联 issue | 无 |
| 验收文件 | [M2-04](../acceptance/M2-04-mcp-servers.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 已有且够用：
  - 配置与源项目读取的错误以 `InputIssue` 返回（`src/config/issues.ts`），字段路径写法同
    `commandHooks[1].event`。
  - 命令 hooks 声明中 `{pluginRoot}` 的换算（Claude Code 为 `${CLAUDE_PLUGIN_ROOT}`、Codex 为
    `${PLUGIN_ROOT}`、agy 为 `.`）在三个宿主模块中各有实现。
  - Codex manifest 的字段白名单（`src/targets/codex/fields.ts`）已含 `mcpServers`。
- 已有但不对：能力数据的 `components.mcp` 三个宿主都为 `package`，没有代码读取；agy 的 `.` 是
  hook 命令的工作目录写法，不能直接用于 MCP 配置。
- 完全没有：`SourceProject` 的 MCP 服务器字段、读取 `mcp/servers.json` 的代码、`TargetPlan`
  中的服务器、三种 MCP 配置文件的生成与字段检查。
- 宿主事实（文件位置、字段与变量展开以 M2-01 的结论为准）：
  - Claude Code 的 MCP 配置为插件根的 `.mcp.json`，manifest 的 `mcpServers` 与之合并，见
    [Claude Code](../research/coding-agent-plugin-manifests/claude-code-plugins.md)。
  - Codex 的 `mcp.json` 要求每个服务器写明传输 `type`，见
    [Codex](../research/coding-agent-plugin-manifests/codex-plugins.md)。
  - agy 的 `mcp_config.json` 顶层为 `mcpServers`，远程服务器写 `serverUrl` 与 `headers`，不支持
    `url`、`httpUrl`；插件中的服务器以 `<插件名>_<服务器名>` 命名；文档没有说明变量是否展开，
    见 [agy](../research/coding-agent-plugin-manifests/agy-plugins.md)。

## ⚠️ 关键落地约束（必须先验证）

- **源格式与跳过规则按 SD-30**：`mcp/servers.json` 的顶层结构、服务器名的字符规则、本地与远程
  服务器的判别，以及含 `{pluginRoot}` 的服务器在不展开变量的宿主上列为跳过（`component` 的
  写法），以 M2-01 定下的 SD-30 与模块接口 §3 为准。
- **Codex 的 MCP 文件位置与 `type` 取值**：以 M2-01 的 rust-v0.162.1 源码核对为准；manifest 是否
  需要写 `mcpServers` 字段指向该文件同样以源码为准。得不出结论时 `codex:subprocess` 的
  `components.mcp` 记为 `none`，服务器列为跳过。
- **不写入密钥**：`env` 与 `headers` 的值原样复制；夹具中只用占位值（如 `uapa-header-probe`），
  不出现令牌形态的字符串。
- **测试中不启动 MCP 服务器**：夹具与单元测试只比对生成的配置；服务器是否被宿主加载由 M2-05
  实测。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 否 | |
| 产物零依赖 | 否 | |
| 不在运行时推断宿主 | 否 | |
| 确定性输出 | 是 | `components` 夹具：MCP 配置的键序为固定插入顺序、两空格缩进、结尾换行，服务器按名称排序，逐字节比对 |
| 不越权写入 | 是 | `components` 夹具：MCP 配置只写入各插件目录；含 `{pluginRoot}` 的服务器在不展开变量的宿主上不写入并列为跳过 |
| 安装不运行脚本 | 否 | |
| 能力数据有出处 | 否 | |

## 任务

### 1. 源项目（`src/source/`）

- 读取 `mcp/servers.json`：文件不存在时没有服务器；本地服务器只含 `command`、`args`、`env`，
  远程服务器只含 `url`、`headers`；出现其他字段、类型不符或同时含两类字段时返回
  `InputIssue`，字段路径写到服务器名与字段（F-01-08）。

### 2. 能力检查（`src/build/plan.ts`、`src/targets/types.ts`）

- `TargetPlan` 加入服务器；目标不承载 MCP 时列为跳过（F-03-02）。

### 3. 宿主模块（`src/targets/claude-code/`、`src/targets/codex/`、`src/targets/agy/`）

- Claude Code：`.mcp.json`，`{pluginRoot}` 换为 `${CLAUDE_PLUGIN_ROOT}`（F-05-12）。
- Codex：`mcp.json`，每个服务器写明传输 `type`；manifest 字段与插件根的处理按 M2-01 的结论；
  字段白名单检查覆盖该文件（F-06-06、F-06-05）。
- agy：`mcp_config.json` 的 `mcpServers`，本地服务器写 `command`、`args`、`env`，远程服务器的
  `url` 写为 `serverUrl`；含 `{pluginRoot}` 的服务器列为跳过；字段白名单检查覆盖该文件
  （F-11-08、F-11-05）。
- 没有服务器的目标不生成 MCP 配置，manifest 中不写指向它的字段。

### 4. 夹具（`test/fixtures/components/`）

- 加入三个服务器：本地服务器 `args` 含 `{pluginRoot}`；本地服务器不含 `{pluginRoot}`；远程
  服务器带 `headers`。期望产物按各宿主的写法手写；agy 的报告中第一个服务器列为跳过。

### 不改的地方（红线）

- v0.1.0 的 16 个夹具与 M2-03 建立的 `components` agents 部分的期望不变：没有 `mcp/` 目录时
  不生成 MCP 配置，manifest 不变。
- 命令 hooks 声明中 `{pluginRoot}` 的换算不变。
- 覆盖目录中的同名 MCP 配置仍按 F-03-12 覆盖生成文件。

### 测试

- 单元：`mcp/servers.json` 不存在、不是合法 JSON、含未知字段、本地与远程字段混用、服务器名
  不合规则时的结果；三个宿主模块各自的生成与字段检查。
- 夹具：`components` 的整树比对（TA-20）。

## 验收

```bash
pnpm check
node --test test/fixtures/fixtures.test.ts test/source/mcp.test.ts test/targets/claude-code.test.ts test/targets/codex.test.ts test/targets/agy.test.ts
```

宿主实测见 M2-05。

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 最终实现方案、关键技术决策及其验证依据；
3. 主要改动点与涉及模块清单；
4. 测试覆盖、判断范围（夹具与单元测试）和已知限制；
5. `components` 夹具中三种 MCP 配置文件的内容与报告的跳过项。

## 边界

- 允许新增与修改：`src/source/`、`src/build/`、`src/targets/`、`test/`、与本单相关的接口文档与
  功能清单条目。
- 禁止修改：`src/runtime/`；v0.1.0 夹具的期望文件。

## 依赖

M2-01：MCP 配置的宿主结论与 SD-30；M2-03：`SourceProject` 与 `TargetPlan` 的组件字段与
`components` 夹具。
