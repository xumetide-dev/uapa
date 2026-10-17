# 验收 M5-04：MCP 服务器的环境变量与插件根

> 本文记录 M5-04 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M5-04](../workorders/M5-04-mcp-server-environment.md) |
| 覆盖功能点 | `F-01-13`、`F-05-26`、`F-06-12`、`F-11-12`（取自总览「工单构成」表） |
| 验收日期 | 2026-10-15 |
| 验收结论 | 通过 |
| 判断范围 | 夹具与单元测试 |
| commit | `2a1f79a` |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | 本单未改 `src/runtime/`、`src/bundle/` 与 hooks 生成；守卫相关的夹具与入口用例全部通过（`run.sh check` 327 pass） |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | 入口与打包未改；`fixtures.test.ts` 的导入检查对 21 个夹具通过；`host-coverage` 的 `server.mjs` 只导入 `node:readline` |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | 本单只改 MCP 配置与报告的内容；`host-coverage` 比对运行后的整个源项目目录，新增文件只在三个插件目录中 |
| V4 | 能力数据含无出处的宿主行为 | 否 | 本单未改 `src/capabilities/`；三个 `mcp.ts` 的注释指向调研记录，见 §1 第 2 行 |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：确定性输出 | `components` 与 `host-coverage` 夹具逐字节比对；`env_vars` 按声明顺序写出 | 两个夹具通过；`mcp-environment.test.ts` 中 `envVars: ['UAPA_TOKEN', 'HTTPS_PROXY']` 原序写为 `env_vars`，读取时 `['UAPA_TOKEN', '_PROXY', 'a1']` 原序保留；残余风险中的服务器按名称、字段按服务器与字段顺序列出 | `test/fixtures/fixtures.test.ts`、`test/source/mcp.test.ts`、`test/targets/mcp-environment.test.ts` | ✅ |
| 2 | 硬约束：能力数据有出处 | agy 的 MCP 换算注释指向 TA-25 的小节；Codex 的 `env_vars` 注释指向源码核对记录 | `src/targets/agy/mcp.ts` 的注释指向 agy-local-tests.md「v0.4.0 覆盖审查（1.3.5，容器）」；`src/targets/codex/mcp.ts` 指向 codex-source-review.md「插件中的 MCP 服务器」（rust-v0.162.1）；`src/targets/claude-code/mcp.ts` 指向 claude-code-local-tests.md「v0.4.0 覆盖审查（2.1.296，容器）」 | 三个 `mcp.ts` 的文件头注释 | ✅ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-01-13` | 读取 MCP 服务器的环境变量声明 | 本地服务器可写 `envVars`：非空的字符串数组，元素匹配 `^[A-Za-z_][A-Za-z0-9_]*$` 且不重复；远程服务器写 `envVars`、元素不合规则或重复时失败，`field` 写到元素，如 `mcpServers.docs.envVars[1]`（SD-40） | ✅ | `mcp.test.ts`「本地服务器的 envVars 按声明顺序读取」与「envVars：远程服务器写该字段、为空、元素不合规则或重复时失败，字段写到元素」：远程服务器报 `mcpServers.a.envVars` 只用于本地服务器；空数组与字符串报非空的字符串数组；`1B`、`C-D`、`2` 依次报 `envVars[1]`～`[3]`；重复的 `A` 报 `envVars[2]` 与 `envVars[0]` 重复 |
| `F-05-26` | MCP 服务器的环境变量声明 | 本地服务器继承会话环境（TA-25，2.1.296）：`envVars` 不写入 `.mcp.json`，不写残余风险；`${…}` 由宿主展开（SD-40） | ✅ | `mcp-environment.test.ts`「Claude Code：envVars 不写入 .mcp.json，占位符原样写出，不写残余风险」；`host-coverage` 的 `.mcp.json` 逐字比对，`Bearer ${TOKEN}` 原样写出，报告中两个 Claude Code 目标的残余风险为 0 |
| `F-06-12` | MCP 服务器的环境变量与占位符 | 本地服务器的 `envVars` 写为 `env_vars`，字段白名单（F-06-05）允许该字段；有本地服务器未声明 `envVars` 时残余风险列出这些服务器，写明 Codex 只向本地服务器传递 `HOME`、`PATH` 等少数变量；服务器的字段含 `${` 时残余风险写明 Codex 按字面传递（SD-40） | ✅ | `mcp-environment.test.ts` 的 Codex 两个用例：`env_vars` 排在 `env` 之后、`cwd` 之前；未声明的 `plain` 与含 `${` 的四个字段各一条残余风险，逐字核对；全部声明且没有 `${` 时只有服务器名的风险；`codex.test.ts` 的字段白名单接受 `env_vars`；`components` 报告新增 `docs、plain` 未声明的风险；`host-coverage` 的 `mcp.json` 逐字比对 |
| `F-11-12` | MCP 服务器的插件根与环境变量 | agy 1.3.5 不展开 MCP `command` 中的 `${extensionPath}` 与 `${PLUGIN_ROOT}`（TA-25），`command` 含 `{pluginRoot}` 的服务器照常列为跳过（F-11-08）；本地服务器继承会话环境，`envVars` 不写入 `mcp_config.json`；服务器的字段含 `${` 时残余风险写明 agy 按字面传递（SD-40） | ✅ | `mcp-environment.test.ts`「agy：envVars 不写入 mcp_config.json；列出含 ${ 的字段」；`agy.test.ts` 中 `command` 含 `{pluginRoot}` 的服务器照常跳过，原因不变；`host-coverage` 的 `mcp_config.json` 逐字比对，报告写明 `mcpServers.remote.headers.Authorization` 按字面传递 |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
test/container/run.sh check
```

```bash
test/container/run.sh exec node --test test/fixtures/fixtures.test.ts
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `test/container/run.sh check` | ✅ tsc 与 biome 通过；327 pass / 0 fail；功能清单关系检查通过 | Docker 可用 |
| `test/container/run.sh exec node --test test/fixtures/fixtures.test.ts` | ✅ 21 pass / 0 fail，含 `夹具 components` 与 `夹具 host-coverage` | Docker 可用 |

## 4. 交付物

- 读取：`McpServer` 的本地服务器增加 `envVars`；`src/source/mcp.ts` 的 `isEnvVarList`
  （文件 199 行）。
- Codex：`mcp.ts` 写 `env_vars`，返回两类残余风险；`fields.ts` 的白名单加入 `env_vars`。
- agy：`mcp.ts` 返回含 `${` 字段的残余风险，注释写明 `command` 不展开与环境继承的出处。
- Claude Code：`mcp.ts` 的注释写明不写 `envVars` 的依据，生成逻辑不变。
- 测试：`test/targets/mcp-environment.test.ts`，`mcp.test.ts` 与 `codex.test.ts` 的新用例；
  `host-coverage` 夹具的 `mcp/servers.json` 与 `commands/review.md`，`components` 的报告。
- 文档：`docs/guide/source-project.md` 的 `envVars`、各宿主的环境与 `${…}`，`{pluginRoot}` 引用
  的文件改为放在共用文件中。

## 5. 与计划的偏差

- 施工单红线写“`components` 夹具只在 agy 的插件根换算成立时更新”：TA-25 的结论是不成立，生成的
  配置文件未变；但 F-06-12 要求列出未声明 `envVars` 的本地服务器，`components` 的报告与 stdout
  因此多出 Codex 的一条残余风险。
- `host-coverage` 另加入正文含 `$ARGUMENTS` 的命令：夹具表要求它（F-06-13），M5-03 未加，
  Codex 的报告据此列为跳过。
- 帮助文档中“`{pluginRoot}` 引用的文件须放在覆盖文件中”在 M5-02 之后已不准确，一并改为共用
  文件。

## 6. 技术决策

| 决策 | 依据 | 回填状态 |
|---|---|---|
| `envVars` 不参与本地与远程服务器的判断，远程服务器写它时单独报 `<服务器>.envVars` | 写在混用的错误里会把字段定位到服务器，F-01-13 要求写到字段 | 实现即文档 |
| 两类残余风险各一条，列出全部服务器或字段；跳过的服务器不列 | 跳过的服务器不进入宿主配置，不影响运行 | 实现即文档 |
| 含 `${` 的字段路径与读取错误相同（如 `mcpServers.docs.args[1]`） | 使用者按同一写法在 `mcp/servers.json` 中定位 | 实现即文档 |
| Codex 与 agy 各有一份 `literalFields`，不抽到共用文件 | 两处各约 12 行，施工单的边界不含新的共用文件；第三个宿主需要时再合并 | 实现即文档 |

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|
| 1 | agy 中 `args`、`env` 与请求头的 `${…}` 按字面传递为推断，1.3.5 只实测了 `command` | 若 agy 实际展开这些字段，残余风险多报 | [M5-07](../workorders/M5-07-v0-4-0-live-tests.md) 第 2 节 |
| 2 | 产物中的 `env_vars` 与会话环境的继承未在宿主中运行 | 依据为 Codex 源码与 M5-01 的容器审查 | [M5-07](../workorders/M5-07-v0-4-0-live-tests.md) 第 1、3 节（Codex 须维护者确认） |
| 3 | Codex 的 `bearer_token_env_var` 与 `env_http_headers` 不生成 | 需要从环境变量取请求头的远程服务器在 Codex 中按字面发送 | 帮助文档写明以 `overrides/codex/mcp.json` 提供（本单） |

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- Codex 本地服务器保留的变量表取自 rust-v0.162.1，残余风险只写“`HOME`、`PATH` 等少数变量”，
  不逐个列出，Codex 调整该表时不需要改动产物。
- 下一步：M5-05 守卫可靠性与残余风险。
