# 验收 M5-06：marketplace 文件

> 本文记录 M5-06 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M5-06](../workorders/M5-06-marketplace-files.md) |
| 覆盖功能点 | `F-03-18`、`F-05-24`、`F-06-15`（取自总览「工单构成」表） |
| 验收日期 | 2026-10-17 |
| 验收结论 | 通过 |
| 判断范围 | 夹具与单元测试 |
| commit | `ae73911` |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | 本单未改 `src/runtime/`、`src/bundle/` 与守卫协议；`test/fixtures/fixtures.test.ts` 21 个夹具及其入口用例全部通过 |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | 本单只生成 JSON 格式的 marketplace 文件，不改入口或打包；`test/fixtures/fixtures.test.ts` 的 `checkImports` 21 个夹具全部通过 |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | 未配置 `marketplace` 的 20 个夹具期望树不变；`host-coverage` 夹具配置 `marketplace` 后，整个源项目目录只多出 `dist/.claude-plugin/marketplace.json` 与 `dist/.agents/plugins/marketplace.json`（均在 `marketplace.dir` 内）；`test/build/marketplace.test.ts` 断言 `--check` 前后磁盘无写入 |
| V4 | 能力数据含无出处的宿主行为 | 否 | 本单未改 `src/capabilities/*.ts`；两个宿主 `marketplace.ts` 的注释分别写明 `claude-code-plugins.md`、`claude-code-local-tests.md` 与 rust-v0.162.1 `core-plugins/src/marketplace.rs` |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：确定性输出 | `host-coverage` 夹具逐字节比对；条目字段顺序固定 | `host-coverage` 夹具中 `dist/.claude-plugin/marketplace.json`（键序 `name`、`owner`、`metadata`、`plugins`）与 `dist/.agents/plugins/marketplace.json`（键序 `name`、`plugins`）两空格缩进、结尾换行，与期望树逐字节一致；`dist/uapa-report.json` 中 Claude Code 与 Codex 目标的 `units` 均追加对应 `{ kind: "marketplace", path }` | `test/fixtures/fixtures.test.ts`「夹具 host-coverage」；`src/targets/claude-code/marketplace.ts`、`src/targets/codex/marketplace.ts` | ✅ |
| 2 | 硬约束：不越权写入 | `host-coverage` 夹具比对运行后的整个源项目目录：只多出两个 marketplace 文件；`--check` 的单元测试断言不写文件；施工单说明与 TA-07 的写法同步 | `host-coverage` 运行后的整个源项目目录相对 M5-05 只新增 `dist/.claude-plugin/marketplace.json` 与 `dist/.agents/plugins/marketplace.json`；`marketplace.test.ts` 断言 `--check` 时未创建文件、修改后 `--check` 磁盘内容保持原状；`docs/workorders/README.md`（M5-01 已更新）与 `docs/feature-list/technical-acceptance.md` 的 TA-07 均已同步写明 `marketplace` 文件写入边界 | `test/build/marketplace.test.ts`；`test/fixtures/host-coverage/expected/tree/`；`docs/workorders/README.md` L62；`docs/feature-list/technical-acceptance.md` L22 | ✅ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-03-18` | 写出 marketplace 文件 | 配置 `marketplace` 时，宿主模块按模块接口 §5 返回本宿主的 marketplace 文件，路径相对 `marketplace.dir`；构建编排在写出插件目录之后，只为有成功目标的宿主写出，不清空所在目录；与写入的插件目录中的文件同路径时该宿主的目标失败；写出时该宿主每个成功目标的报告 `units` 追加 `{ kind: 'marketplace', path }`；`--check` 比对，差异路径的写法同模块接口 §2（SD-41） | ✅ | `src/build/marketplace.ts`、`src/build/generate.ts`、`src/build/compare.ts`、`src/build/run.ts`、`src/build/report.ts`；`test/build/marketplace.test.ts` 5 个单元测试覆盖子目录与同目录相对路径、保留所在目录已有文件、生成失败与宿主校验失败时不写、`--check` 的 `added`/`modified` 比对、与插件目录文件同路径冲突时该宿主失败且不写其插件目录 |
| `F-05-24` | 生成 `marketplace.json` | 配置 `marketplace` 时返回 `.claude-plugin/marketplace.json`：`name`、`owner`、`metadata.description`（取配置的 `description`），`plugins` 只含本插件一项（`name`、`source`、`description`），不写 `version`（版本以 `plugin.json` 为准）；`source` 为从 `marketplace.dir` 到插件目录、以 `./` 开头的相对路径，两者相同时为 `"./"`；产物通过 `claude plugin validate --strict`，按 TA-25（2.1.296）能添加并安装（SD-41） | ✅ | `src/targets/claude-code/marketplace.ts`；`test/build/marketplace.test.ts` 覆盖 `./claude-code` 与 `./` 两种 `source` 及 `owner.email` 可选字段；`host-coverage` 夹具产物在容器中运行 `claude plugin validate test/fixtures/host-coverage/expected/tree/dist/.claude-plugin/marketplace.json --strict` 输出 `✔ Validation passed` |
| `F-06-15` | 生成 `marketplace.json` | 配置 `marketplace` 时返回 `.agents/plugins/marketplace.json`：`name`，`plugins` 只含本插件一项（`name` 与 `source`），`source` 为从 `marketplace.dir` 到插件目录、以 `./` 开头的路径字符串，两者相同时为 `"./"`；不写 `policy` 与 `category`（可省略，默认 `AVAILABLE` 与 `ON_INSTALL`）；字段按 rust-v0.162.1 `core-plugins/src/marketplace.rs`，会话中的添加与安装待维护者确认后实测（SD-41） | ✅ | `src/targets/codex/marketplace.ts`；`test/build/marketplace.test.ts` 覆盖 `./codex` 与 `./` 两种 `source`；`test/fixtures/host-coverage/expected/tree/dist/.agents/plugins/marketplace.json` |

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
| `test/container/run.sh check` | ✅ `tsc`、`tsconfig.runtime-core.json`、`biome check`（229 files）全部通过；单元与夹具测试 340 pass / 0 fail；`check-feature-list.mjs` 129 个功能、27 条用户故事、27 项技术验收关系检查通过 | Docker 可用 |
| `test/container/run.sh exec node --test test/fixtures/fixtures.test.ts` | ✅ 21 pass / 0 fail（含 `夹具 host-coverage` 及其入口用例） | Docker 可用 |

## 4. 交付物

- 接口与配置：`src/targets/types.ts`（`HostInput.marketplaceSource`、`HostResult.marketplaceFiles`）、
  `src/config/marketplace.ts`（`marketplaceSourceOf`）。
- 宿主模块：`src/targets/claude-code/marketplace.ts`、`src/targets/claude-code/index.ts`、
  `src/targets/codex/marketplace.ts`、`src/targets/codex/index.ts`。
- 构建编排：`src/build/marketplace.ts`、`src/build/generate.ts`、`src/build/outputs.ts`（函数拆分）、
  `src/build/compare.ts`、`src/build/run.ts`、`src/build/state.ts`、`src/build/report.ts`。
- 测试与夹具：`test/build/marketplace.test.ts`（5 项单元测试）；`test/fixtures/host-coverage/`
  源配置与期望树（`dist/.claude-plugin/marketplace.json`、`dist/.agents/plugins/marketplace.json`、
  `dist/uapa-report.json`）。
- 文档：`docs/guide/install.md`、`docs/guide/build-and-check.md`、`docs/guide/configuration.md`、
  `docs/feature-list/technical-acceptance.md`（TA-07）。

## 5. 与计划的偏差

- 施工单未单列 `src/config/`：`marketplaceSourceOf` 与 `marketplaceDirOf` 同属 marketplace 路径换算，
  放在 `src/config/marketplace.ts` 中。
- 施工单任务 1 提及更新 `docs/workorders/README.md` 的“不越权写入”，该处已在 M5-01 中同步，本单同步
  了 `docs/feature-list/technical-acceptance.md` 的 TA-07。

## 6. 技术决策

| 决策 | 依据 | 回填状态 |
|---|---|---|
| `HostInput.marketplaceSource` 由构建编排按 `marketplaceDirOf` 与宿主插件目录计算后传入宿主模块，宿主模块不访问文件系统 | 保持宿主模块纯函数语义，与模块接口 §5 一致 | 已写入 `docs/architecture/host-module-interface.md`（M5-01） |
| marketplace 文件与插件目录文件同路径冲突时，标记该宿主全部目标失败并从 `hostFiles` 移除后重新规划 `outputs` | 保证冲突宿主的插件目录与 marketplace 文件均不写出，同时不影响其他宿主（F-03-18） | 实现即文档（`src/build/marketplace.ts`） |
| `writeMarketplaces` 在 `verifyHosts` 之后执行，再次检查宿主是否仍有成功目标 | 若 `verify` 失败，该宿主目标状态变为 `failed`，不应写出其 marketplace 文件或追加 `marketplace` 安装单位 | 已写入 `docs/architecture/build-output.md`（M5-01） |

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|
| 1 | `host-coverage` 产物的 marketplace 添加与安装在宿主会话中的端到端复测归入 M5-07 | 本单已在容器中验证 `claude plugin validate --strict` 通过，会话实测在 M5-07 集中执行 | [M5-07](../workorders/M5-07-v0-4-0-live-tests.md) |

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- 只配置 Claude Code 目标并生成 `.claude-plugin/marketplace.json` 时，Codex 也会回退读取该文件并把
  Claude Code 插件目录当作 Codex 插件安装；已在 `docs/guide/install.md` 写明风险。
- 下一步：在 M5-07 容器实测中验证生成的 marketplace 文件在宿主中的添加与安装。
