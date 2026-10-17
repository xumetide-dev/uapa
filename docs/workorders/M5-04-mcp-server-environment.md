# 施工单 M5-04：MCP 服务器的环境变量与插件根

> 本地 MCP 服务器可以用 `envVars` 声明需要从会话环境取得的变量，各宿主按以下方式处理：
> - Codex：写为 `env_vars`。
> - Claude Code 与 agy：按 TA-25 的结论处理。
>
> 宿主不展开的 `${…}`、Codex 中没有声明变量的本地服务器，都写为残余风险。agy 展开
> `${extensionPath}` 时，`command` 中的插件根不再列为跳过。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M5-00](M5-00-v0-4-0-host-coverage.md) |
| 覆盖功能点 | `F-01-13`、`F-05-26`、`F-06-12`、`F-11-12` |
| 依赖工单 | [M5-01](M5-01-v0-4-0-host-facts-and-interfaces.md) |
| 关联 issue | 无 |
| 验收文件 | [M5-04](../acceptance/M5-04-mcp-server-environment.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 已有且够用：
  - `readMcpServers`（`src/source/mcp.ts`，173 行）校验 `mcp/servers.json`，`field` 写到服务器与
    字段。
  - 三个宿主的 `mcp.ts`（`src/targets/<宿主>/mcp.ts`）由规范形式生成配置，并返回 `TargetSkip`。
- 已有但不对：
  - Codex 字段白名单（`src/targets/codex/fields.ts`）的 MCP 服务器字段不含 `env_vars`。
  - agy 的 `mcp.ts` 对 `command` 中的 `{pluginRoot}` 一律列为跳过，原因写“agy 不展开”。按
    CHANGELOG 1.0.7，这一结论待 TA-25 核实。
- 完全没有：`envVars` 的读取与写出；`${` 的残余风险。
- 宿主事实：
  - Codex rust-v0.162.1：`rmcp-client/src/utils.rs` 的默认变量表，`config/src/mcp_types.rs` 的
    `env_vars`（字符串或 `{ name, source }`）。
  - Claude Code 与 agy：以 M5-01 写入调研文档的 TA-25 第 2、7 项为准。

## ⚠️ 关键落地约束（必须先验证）

- **Codex 只写变量名**：`env_vars` 写字符串数组，不写 `source`（默认 `local`）。
- **不复制变量值**：UAPA 只写变量名，构建与产物中不出现任何环境变量的值；夹具不读取运行环境。
- **TA-25 的结论**：
  - Claude Code 的本地服务器继承会话环境时，不写入；不继承时按 F-05-26 写 `env`。
  - agy 的 `${extensionPath}` 不展开时，`command` 中的插件根保持跳过。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 否 | 不改守卫与入口 |
| 产物零依赖 | 否 | 不改入口与打包 |
| 不在运行时推断宿主 | 否 | 不改入口 |
| 确定性输出 | 是 | `components` 与 `host-coverage` 夹具逐字节比对；`env_vars` 按声明顺序写出 |
| 不越权写入 | 否 | 只改 MCP 配置的内容 |
| 安装不运行脚本 | 否 | 不改 `package.json` |
| 能力数据有出处 | 是 | agy 的 MCP 换算注释指向 TA-25 的小节；Codex 的 `env_vars` 注释指向源码核对记录 |

## 任务

### 1. 读取（`src/source/mcp.ts`、`src/source/types.ts`）

- 按 F-01-13 读取 `envVars`；先把服务器字段的校验拆成按字段的函数，文件不超过 200 行。

### 2. 生成（`src/targets/<宿主>/mcp.ts`）

- Codex：按 F-06-12 写 `env_vars`，放宽字段白名单，写残余风险。
- Claude Code：按 F-05-26 与 TA-25 的结论处理。
- agy：按 F-11-12 与 TA-25 的结论换算 `command` 中的插件根，写残余风险。

### 3. 帮助文档（`docs/guide/`）

- `source-project.md`：写 `envVars`，以及各宿主是否展开 `${…}`。

### 不改的地方（红线）

- 没有 `envVars` 与 `${` 的服务器，生成结果不变：`components` 夹具只在 agy 的插件根换算成立时
  更新，并在验收 §5 写明。
- 远程服务器的写法不变。

### 测试

- 单元：
  - `envVars` 的读取：远程服务器写该字段、元素不合规则、元素重复。
  - 三个宿主的生成与残余风险：有无 `envVars`、字段含 `${`。
- 夹具：`host-coverage` 加入声明 `envVars` 的本地服务器，以及请求头含 `${TOKEN}` 的远程服务器。

## 验收

```bash
test/container/run.sh check
```

```bash
test/container/run.sh exec node --test test/fixtures/fixtures.test.ts
```

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 最终实现方案、关键技术决策及其验证依据；
3. 主要改动点与涉及模块清单；
4. 测试覆盖、宿主实测结果、判断范围和已知限制；
5. 如适用，附生成的产物或入口的输入输出示例。

## 边界

- 允许新增与修改：`src/source/mcp.ts`、`src/source/types.ts`、`src/targets/*/mcp.ts`、
  `src/targets/codex/fields.ts`、三个宿主模块中 MCP 的残余风险、`test/`、`docs/guide/`、
  夹具表中本单涉及的段落。
- 禁止修改：`src/runtime/`、`src/bundle/`、构建编排。

## 依赖

M5-01 的 TA-25 第 2、7 项与接口定稿（模块接口 §3）。
