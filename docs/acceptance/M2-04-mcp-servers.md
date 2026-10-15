# 验收 M2-04：MCP 服务器

> 本文记录 M2-04 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M2-04](../workorders/M2-04-mcp-servers.md) |
| 覆盖功能点 | `F-01-08`、`F-05-12`、`F-06-06`、`F-11-08`（取自总览「工单构成」表） |
| 验收日期 | 待定 |
| 验收结论 | 待定 |
| 判断范围 | 待定 |
| commit | 待回填 |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 待核对 | |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 待核对 | |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 待核对 | |
| V4 | 能力数据含无出处的宿主行为 | 待核对 | |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：确定性输出 | `components` 夹具：MCP 配置的键序为固定插入顺序、两空格缩进、结尾换行，服务器按名称排序，逐字节比对 | | | ⏳ |
| 2 | 硬约束：不越权写入 | `components` 夹具：MCP 配置只写入各插件目录；`command` 含 `{pluginRoot}` 的服务器在 Codex 与 agy 上不写入并列为跳过 | | | ⏳ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-01-08` | 读取 MCP 服务器 | 读取 `mcp/servers.json` 的 `mcpServers`：服务器名只含字母、数字、`_`、`-`；本地服务器只含 `command`、`args`、`env`，远程服务器只含 `url`、`headers`，插件根写作 `{pluginRoot}`，只用于本地服务器；其他字段、类型不符或两类字段混用时失败（SD-30） | ⏳ | |
| `F-05-12` | 生成 `.mcp.json` | 由规范形式生成 `.mcp.json`：`{pluginRoot}` 换为 `${CLAUDE_PLUGIN_ROOT}`，远程服务器写 `type: "http"`（SD-30） | ⏳ | |
| `F-06-06` | 生成 `mcp.json` | 由规范形式生成 `mcp.json`，manifest 的 `mcpServers` 指向它：每个服务器写明传输 `type`，请求头写为 `http_headers`；`{pluginRoot}` 在 `args` 与 `env` 中换为 `.` 并写 `"cwd": "."`，在 `command` 中出现时列为跳过；没有服务器而共用插件目录时 manifest 写 `"mcpServers": {}`（SD-30） | ⏳ | |
| `F-11-08` | 生成 `mcp_config.json` | 由规范形式生成 `mcpServers`：本地服务器写 `command`、`args`、`env`，`{pluginRoot}` 在 `args` 与 `env` 中换为 `.`（服务器以插件目录为工作目录），在 `command` 中出现时列为跳过；远程服务器的 `url` 写为 `serverUrl`（SD-30） | ⏳ | |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
pnpm check
node --test test/fixtures/fixtures.test.ts test/source/mcp.test.ts test/targets/claude-code.test.ts test/targets/codex.test.ts test/targets/agy.test.ts
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `pnpm check` | ⏳ | 无 |
| `node --test test/fixtures/fixtures.test.ts test/source/mcp.test.ts test/targets/claude-code.test.ts test/targets/codex.test.ts test/targets/agy.test.ts` | ⏳ | 无 |

## 4. 交付物

待验收时填写。

## 5. 与计划的偏差

待验收时填写；没有偏差写“无”。

## 6. 技术决策

待验收时填写。架构文档或接口文档中还写着“待定”“未核实”而本单定下的，登记回填状态。

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

待验收时填写。
