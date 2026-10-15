# 验收 M2-04：MCP 服务器

> 本文记录 M2-04 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M2-04](../workorders/M2-04-mcp-servers.md) |
| 覆盖功能点 | `F-01-08`、`F-05-12`、`F-06-06`、`F-11-08`（取自总览「工单构成」表） |
| 验收日期 | 2026-10-15 |
| 验收结论 | 有条件通过（`components` 产物中 MCP 服务器的宿主加载与插件根的路径解析由 M2-05 实测） |
| 判断范围 | 夹具与单元测试 |
| commit | `0fc93f1` |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | 本单不改守卫与入口（`src/runtime/` 无改动）；`pnpm check` 中执行前检查的用例与全部夹具的入口用例通过（246 pass） |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | MCP 配置为 JSON 文件，不含入口；`components` 产物没有 `.mjs` 文件，其余夹具的导入检查通过 |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | `components` 整树比对：MCP 配置只出现在 `dist/claude-code/.mcp.json`、`dist/codex/mcp.json` 与 `dist/agy/mcp_config.json`，源项目的 `mcp/servers.json` 不变；MCP 配置与其他生成文件走同一写出与比对路径，`layout.test.ts` 的 `--check` 用例通过 |
| V4 | 能力数据含无出处的宿主行为 | 否 | 本单不改能力数据；`components.mcp` 的取值与注释为 M2-01 写入，TA-09 通过 |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：确定性输出 | `components` 夹具：MCP 配置的键序为固定插入顺序、两空格缩进、结尾换行，服务器按名称排序，逐字节比对 | 源文件中服务器按 `remote`、`plain`、`launcher`、`docs` 倒序书写，三种 MCP 配置均按 `docs`、`launcher`（仅 Claude Code）、`plain`、`remote` 写出；手写的期望文件与构建结果逐字节一致，整树 14 个文件、stdout 与 stderr 一致 | `fixtures.test.ts` 的 `夹具 components`；`build.test.ts`「MCP 服务器按名称排序交给宿主模块」；`mcp.test.ts`「本地与远程服务器按名称排序，未写的字段不出现」 | ✅ |
| 2 | 硬约束：不越权写入 | `components` 夹具：MCP 配置只写入各插件目录；`command` 含 `{pluginRoot}` 的服务器在 Codex 与 agy 上不写入并列为跳过 | `launcher` 不出现在 `dist/codex/mcp.json` 与 `dist/agy/mcp_config.json`，两目标的报告各列一条 `mcpServers.launcher` 跳过项；MCP 配置只写入三个插件目录 | `夹具 components` 的 `uapa-report.json` 与 stdout（Codex 跳过 2、agy 跳过 1）；`codex.test.ts` 与 `agy.test.ts` 的 MCP 生成用例 | ✅ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-01-08` | 读取 MCP 服务器 | 读取 `mcp/servers.json` 的 `mcpServers`：服务器名只含字母、数字、`_`、`-`；本地服务器只含 `command`、`args`、`env`，远程服务器只含 `url`、`headers`，插件根写作 `{pluginRoot}`，只用于本地服务器；其他字段、类型不符或两类字段混用时失败（SD-30） | ✅ | `mcp.test.ts` 4 个用例：文件不存在时为空；按 name 排序并保留字段；无效 JSON、顶层形状、`mcp` 不是目录与 `servers.json` 不是文件共 7 例；服务器名、未知字段、混用、类型与远程服务器含 `{pluginRoot}` 共 13 例，`field` 写到服务器名与字段（如 `mcpServers.a.args[1]`） |
| `F-05-12` | 生成 `.mcp.json` | 由规范形式生成 `.mcp.json`：`{pluginRoot}` 换为 `${CLAUDE_PLUGIN_ROOT}`，远程服务器写 `type: "http"`（SD-30） | ⚠️ 仅生成已验证，宿主加载由 M2-05 实测 | `claude-code.test.ts` 的 `.mcp.json` 用例：两个形态共写一份，四个服务器都写入，`command`、`args`、`env` 中的插件根都已换算；没有服务器时只有 manifest；`夹具 components` 的 `dist/claude-code/.mcp.json` |
| `F-06-06` | 生成 `mcp.json` | 由规范形式生成 `mcp.json`，manifest 的 `mcpServers` 指向它：每个服务器写明传输 `type`，请求头写为 `http_headers`；`{pluginRoot}` 在 `args` 与 `env` 中换为 `.` 并写 `"cwd": "."`，在 `command` 中出现时列为跳过；源项目有服务器而全部跳过、且共用插件目录时 manifest 写 `"mcpServers": {}`（SD-30） | ⚠️ 仅生成已验证，宿主加载与 `cwd` 的解析由 M2-05 实测 | `codex.test.ts` 3 个 MCP 用例：`mcp.json` 内容、`launcher` 跳过、manifest 的 `"./mcp.json"` 与服务器名风险；有无服务器与是否共用目录的 4 种组合中只有“全部跳过且共用”写 `{}`；字段白名单覆盖 `mcp.json`；`夹具 components`；`merged` 夹具的 manifest 不变 |
| `F-11-08` | 生成 `mcp_config.json` | 由规范形式生成 `mcpServers`：本地服务器写 `command`、`args`、`env`，`{pluginRoot}` 在 `args` 与 `env` 中换为 `.`（服务器以插件目录为工作目录），在 `command` 中出现时列为跳过；远程服务器的 `url` 写为 `serverUrl`（SD-30） | ⚠️ 仅生成已验证，宿主加载由 M2-05 实测 | `agy.test.ts` 2 个 MCP 用例：`mcp_config.json` 内容、`launcher` 跳过、`plugin.json` 不变、没有服务器时不生成；字段白名单覆盖 `mcp_config.json`；`夹具 components` 的 `dist/agy/mcp_config.json` |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
pnpm check
node --test test/fixtures/fixtures.test.ts test/source/mcp.test.ts test/targets/claude-code.test.ts test/targets/codex.test.ts test/targets/agy.test.ts
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `pnpm check` | 容器内 `test/container/run.sh check`：tsc 与 Biome 通过，246 pass / 0 fail；功能清单检查“✓ 93 个功能，18 条用户故事，20 项技术验收，关系检查通过” | 无 |
| `node --test test/fixtures/fixtures.test.ts test/source/mcp.test.ts test/targets/claude-code.test.ts test/targets/codex.test.ts test/targets/agy.test.ts` | 容器内 50 pass / 0 fail；18 个夹具全部一致，其中只有 `components` 的期望有变化 | 无 |

## 4. 交付物

- 源项目：新增 `src/source/mcp.ts`（`readMcpServers`）；`McpServer` 类型与
  `SourceProject.mcpServers`；`readSource` 汇总 MCP 的问题，排在 agents 之后、覆盖文件之前。
- 构建：`TargetPlan.mcpServers`；`plan.ts` 的 `planMcpServers`（不承载 MCP 时全部跳过）；
  `HostResult.skipped` 与 `TargetSkip`，`generate.ts` 把宿主模块的跳过项排在能力检查的跳过项之后。
- 宿主模块：`src/targets/claude-code/mcp.ts`、`src/targets/codex/mcp.ts`、`src/targets/agy/mcp.ts`；
  Codex manifest 增加 `mcpServers`，Codex 与 agy 的字段白名单检查覆盖 MCP 配置；Codex 的服务器名
  残余风险。
- 测试：`test/source/mcp.test.ts`、`test/helpers/mcp.ts`、三个宿主模块测试与 `build.test.ts` 的
  MCP 用例；`components` 夹具的 `mcp/servers.json` 与三种 MCP 配置的期望文件。
- 文档：SD-30、F-06-06 与模块接口 §5 中 `"mcpServers": {}` 的条件；构建报告 `residualRisks` 一行
  补列 Codex 的服务器名风险。

## 5. 与计划的偏差

- `"mcpServers": {}` 的条件收窄：SD-30 与 F-06-06 原写“没有服务器而共用插件目录时写 `{}`”，
  按字面实现后 v0.1.0 的 `merged` 夹具的 Codex manifest 多出 `"mcpServers": {}`，违反本单红线
  “没有 `mcp/` 目录时 manifest 不变”。`{}` 只为阻止 Codex 读取 Claude Code 写出的 `.mcp.json`，
  源项目没有服务器时任何宿主都不生成 MCP 配置，因此改为“源项目有服务器而全部跳过、且共用插件
  目录时写 `{}`”，同步了 SD-30、F-06-06、模块接口 §5 与本文 §2。
- 施工单的验收命令之外新增了 `build.test.ts` 的两个用例（排序与跳过项顺序、不承载 MCP 时全部
  跳过），覆盖施工单任务 2。

## 6. 技术决策

| 决策 | 依据 | 回填状态 |
|---|---|---|
| Codex manifest 只在源项目有服务器而全部跳过、且共用插件目录时写 `"mcpServers": {}` | 见 §5 第 1 条；源项目没有服务器时 v0.1.0 的产物逐字不变 | 已写入 SD-30、F-06-06 与模块接口 §5 |
| Codex 生成 `mcp.json` 时记一条残余风险：服务器名不加命名空间，与用户配置或其他插件重名时插件的服务器可能不生效 | rust-v0.162.1 源码核对：插件间重名时排序在前者生效，用户 `[mcp_servers]` 的同名项覆盖插件（`codex-source-review.md`「插件中的 MCP 服务器」）；能力数据表达不了 | 已写入构建报告 `residualRisks` 一行 |
| 宿主模块按宿主格式判定的跳过项经 `HostResult.skipped` 返回，排在能力检查的跳过项之后 | 模块接口 §5 的 `TargetSkip`（M2-01 定稿）与构建报告 `skipped` 一行 | 无需改文档 |
| `{pluginRoot}` 引用的文件（如 `mcp/server.mjs`）不由构建复制，由使用者经 `overrides/<宿主>/` 放入插件目录 | 构建只复制 skills、agents 与覆盖文件（F-03-04、F-03-12），v0.1.0 命令 hooks 引用的脚本同样如此 | 见 §7 第 3 行 |

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|
| 1 | `components` 产物未在宿主中加载：三个宿主是否列出生成的 MCP 服务器只以 M2-01 的宿主事实为据 | F-05-12、F-06-06、F-11-08 为 ⚠️ | [M2-05](../workorders/M2-05-three-host-live-tests.md) 任务 1～3 的 v0.2.0 一项 |
| 2 | 插件根换算后的路径未实测：Codex 的 `"cwd": "."` 拼到插件目录、agy 的服务器以插件目录为工作目录，均来自源码核对或 M2-01 的实测，未用 `components` 的 `docs` 服务器验证 | `args` 中的 `./mcp/server.mjs` 在宿主中解析到别处时服务器启动失败 | [M2-05](../workorders/M2-05-three-host-live-tests.md) 任务 2、3：容器内的副本经覆盖文件放入写标记文件后退出的桩脚本，确认路径按插件目录解析 |
| 3 | `{pluginRoot}` 引用的文件不由构建复制，用户文档未写明放置方式 | 使用者只写 `mcp/servers.json` 时，本地服务器引用的脚本不在插件目录中 | [M2-06](../workorders/M2-06-release-v0-2-0.md) 任务 2：README 写明经 `overrides/<宿主>/` 放置 |

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- `env` 与 `headers` 的值原样复制进产物：源项目中写入的密钥会进入插件目录。规范形式不支持
  Codex 的 `env_vars`、`bearer_token_env_var` 等引用环境变量的字段，需要时经覆盖文件提供。
- agy 以 `<插件名>_<服务器名>` 命名插件中的服务器，Codex 不加命名空间；同名服务器在两个宿主
  中的表现不同，Codex 一侧已记残余风险。
- 下一张：M2-05（三个宿主的实测）。
