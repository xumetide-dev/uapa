# 验收 M5-08：合并布局 manifest、命令超时、MCP 目标过滤与守卫工作目录

> 本文记录 M5-08 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M5-08](../workorders/M5-08-merged-manifest-timeout-mcp-cwd.md) |
| 覆盖功能点 | `F-01-15`、`F-02-06`、`F-03-20`、`F-04-10`、`F-05-27`、`F-06-17`、`F-11-15`（取自总览「工单构成」表） |
| 验收日期 | 2026-10-17 |
| 验收结论 | 通过 |
| 判断范围 | 夹具与单元测试 + 宿主实测 |
| commit | `c116268` |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | `test/runtime/subprocess.test.ts`、`test/runtime/claude-code-subprocess.test.ts`、`test/runtime/codex-subprocess.test.ts`、`test/runtime/agy-subprocess.test.ts` 验证 `cwd` 缺失、空串或非字符串时静默退化为 `null`，必选字段缺失与守卫抛错仍拒绝执行前检查；`host-coverage` 夹具的 `expected/stdin/codex-subprocess/cwd-deny.json` 与 `expected/stdin/agy-subprocess/workspace-deny.json` 验证带 `cwd` 的拒绝输出 |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | `test/bundle/bundle.test.ts`（`子进程守卫导入 node:fs 与 node:path 打包通过，in-process 守卫导入 node:fs 打包失败`）与 `test/fixtures/fixtures.test.ts`（`checkImports`）验证子进程入口只导入 `node:` 内置模块、`claude-code:in-process` 只导入 `'claude-code'` |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | `test/build/components.test.ts`（`合并布局写回源项目根目录（dir: '.'）时，源项目 rules/<name>.md 与 agy 生成的同路径文件冲突报错`）验证原位 `rules/style.md` 不被覆盖；`merged`、`command-hooks`、`host-coverage` 夹具逐字节比对通过 |
| V4 | 能力数据含无出处的宿主行为 | 否 | 本单未修改 `src/capabilities/` 能力布尔值；agy `.antigravity-plugin/plugin.json`、`stdin.workspacePaths[0]` 与 Claude Code `in-process` 事件对象的实测出处已记入 `agy-local-tests.md`、`claude-code-local-tests.md` 与 `uapa-hook-adapters.md` |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：守卫不静默失效 | 子进程入口 `parse` 在 `cwd` 缺失、非字符串或空串时静默退化为 `null`，不改变必选字段校验；守卫在子进程入口读取 `ctx.cwd` 与 `node:fs` 抛错时仍按异常收口拒绝执行前检查（单元测试与 `host-coverage` 入口用例） | 4 个入口测试文件共 36 个子进程入口用例全绿；`cwd` 为 `undefined`、`""`、`42`、`[]` 时 `ctx.cwd` 为 `null`，有效字符串时传入守卫；`host-coverage` 的 `cwd-deny.json`（退出码 `2`，stderr `拒绝标记命令 uapa-deny-probe（/work/project）\n`）与 `workspace-deny.json`（stdout `{"decision":"deny","reason":"拒绝标记命令 uapa-deny-probe（/work/agy-project）"}\n`）通过 | `test/runtime/subprocess.test.ts`、`test/runtime/claude-code-subprocess.test.ts`、`test/runtime/codex-subprocess.test.ts`、`test/runtime/agy-subprocess.test.ts`、`test/fixtures/host-coverage/expected/stdin/` | ✅ |
| 2 | 硬约束：产物零依赖 | TA-01 与 `bundle` 单元测试验证子进程入口打包守卫中的 `node:fs`、`node:path` 时只保留 `node:` 内置模块，不引入 npm 包；`claude-code:in-process` 导入 `node:` 时打包失败 | `test/bundle/bundle.test.ts` 6 个用例全绿（打包 `fs-guard.ts` 子进程产物只含 `node:fs`、`node:path` 等 `node:` 导入，`claude-code:in-process` 打包拒绝 `node:fs`）；`test/fixtures/fixtures.test.ts` TA-01 全绿 | `test/bundle/bundle.test.ts`、`test/fixtures/fixtures.test.ts` | ✅ |
| 3 | 硬约束：不在运行时推断宿主 | 各子进程入口分别在自身 `parse` 中按固定字段（Claude Code 与 Codex 取 `cwd`，agy 取 `workspacePaths[0]`）提取工作目录，不读取其他宿主的字段或环境变量（TA-05 与入口单元测试） | `claude-code-subprocess.ts` 与 `codex-subprocess.ts` 只读 `stdin.cwd`，`agy-subprocess.ts` 只读 `stdin.workspacePaths[0]`；TA-05 与三个宿主子进程入口测试全绿 | `src/runtime/entries/`、`test/fixtures/ta-extra.test.ts` | ✅ |
| 4 | 硬约束：确定性输出 | `merged`、`command-hooks`、`host-coverage` 夹具在临时目录中构建并逐字节比对（TA-06、TA-26） | 21 个夹具在 `test/fixtures/fixtures.test.ts` 中逐字节比对与入口用例全部通过；TA-06、TA-26 全绿 | `test/fixtures/fixtures.test.ts`、`test/fixtures/ta-extra.test.ts` | ✅ |
| 5 | 硬约束：不越权写入 | `dir: '.'` 且源项目含 `rules/` 时，`agy:subprocess` 生成 `rules/<name>.md` 按同路径冲突失败，不覆盖源项目文件（`test/build/components.test.ts` 单元测试） | `agy:subprocess` 报 `同路径冲突：rules/style.md 既由 agy 生成，又是源项目中的组件文件`，源项目 `rules/style.md` 保持原内容不变 | `src/build/components.ts`、`test/build/components.test.ts` | ✅ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-01-15` | 命令超时、agy 清单位置与 MCP 服务器目标限定 | `CommandHookDecl` 可写可选的 `timeout`（正整数，单位秒；小于等于 0、非整数或非数字时返回 `InputIssue`，`field` 如 `commandHooks[0].timeout`），代替 F-01-09 中拒绝 `timeout` 字段的规则；`hosts.agy` 可写可选的 `manifest`（只取 `'plugin.json'` 或 `'.antigravity-plugin/plugin.json'`，其他值返回 `InputIssue`，`field` 为 `hosts.agy.manifest`）；`mcp/servers.json` 的本地与远程服务器可写可选的 `targets`（规则同 F-01-05，非空、不重复、只含已登记的目标名，违反时返回 `InputIssue`，`field` 如 `mcpServers.docs.targets[0]`）（SD-47～SD-49） | ✅ | `src/config/types.ts`、`src/config/validate.ts`、`src/source/types.ts`、`src/source/mcp.ts`、`test/config/command-hooks.test.ts`、`test/config/validate.test.ts`、`test/source/mcp.test.ts` |
| `F-02-06` | 守卫上下文的工作目录字段 | `GuardContext` 增加只读字段 `cwd`（类型为 `string` 或 `null`）：子进程目标提供宿主当前会话工作目录，宿主未提供或为进程内目标（`claude-code:in-process`）时为 `null`（SD-50） | ✅ | `src/runtime/core/types.ts`、`src/runtime/core/options.ts`、`test/runtime/types.test.ts`、`test/runtime/options.test.ts` |
| `F-03-20` | MCP 服务器按目标筛选与源码根目录规则文件保护 | `TargetPlan.mcpServers` 按服务器的 `targets` 与目标的 `components.mcp` 筛选（同 F-03-02：目标不承载 MCP 时，未写 `targets` 的服务器写入 `skipped`，显式列出该目标时该目标失败，`component` 为 `mcpServers.<名称>`）；插件目录是源项目根目录（`dir: '.'`）时，源项目的 `rules/<name>.md` 与 `skills/`、`agents/`、`commands/` 一并计入原位组件文件，宿主模块生成同路径文件（如 agy 生成 `rules/<name>.md`，或换算生成的技能与源项目 `skills/<name>/SKILL.md` 同路径）时按同路径冲突失败，不覆盖源码文件（SD-47、SD-49） | ✅ | `src/build/plan.ts`、`src/build/components.ts`、`test/build/components.test.ts` |
| `F-04-10` | 向守卫传入工作目录 | `HostEvent` 增加可选的 `cwd`（类型为 `string` 或 `null`），由各子进程入口的 `parse` 从宿主 stdin 提取（缺失、非字符串或空串时静默退化为 `null`，不按输入无法解析抛错）；`guardContext(result, cwd)` 把 `cwd`（默认 `null`）写入 `GuardContext.cwd` 传给守卫各检查方法（SD-50） | ✅ | `src/runtime/entries/subprocess.ts`、`src/runtime/core/options.ts`、`test/runtime/subprocess.test.ts`；agy 1.3.5 容器会话实测（宿主实测，见 M5-07） |
| `F-05-27` | 单条命令超时与守卫工作目录 | 声明的命令 hook 指定 `timeout` 时，生成的处理器写该值，省略时写能力数据的 `hookTimeoutSeconds`（30）；`claude-code-subprocess.ts` 从 stdin 的 `cwd` 提取工作目录传入 `GuardContext.cwd`（缺失或空串为 `null`），`claude-code-in-process.ts` 传入 `null`（宿主模块事件不含工作目录，2.1.296 实测）（SD-48、SD-50） | ✅ | `src/targets/claude-code/hooks.ts`、`src/runtime/entries/claude-code-subprocess.ts`、`src/runtime/entries/claude-code-in-process.ts`、`test/targets/command-hooks.test.ts`、`test/runtime/claude-code-subprocess.test.ts`；Claude Code 2.1.296 `validate --strict` 与入口测试（宿主实测，见 M5-07） |
| `F-06-17` | 单条命令超时、MCP 用户配置变量剥离与守卫工作目录 | 声明的命令 hook 指定 `timeout` 时，非 `SessionEnd` 事件写该值，`SessionEnd` 写 `Math.min(hook.timeout ?? 30, 3)`（`hook.timeout <= 3` 时按原值写出且不报超时截断风险，省略或 `> 3` 时写 `3` 并写 F-06-14 的残余风险）；本地 MCP 服务器的 `env` 含 `${user_config.<KEY>}` 时从 `mcp.json` 的 `env` 中剥离该键（剥离后为空对象时省略 `env`，`{pluginRoot}` 换算与 `${` 字面传递残余风险只按保留的键计算），整值匹配 `${user_config.<KEY>}` 且 `<KEY>` 为合法环境变量名时自动并入 `env_vars`（去重），并写残余风险列出已剥离的键；共用插件目录中其他宿主有 MCP 服务器而本宿主无适用服务器时，manifest 仍写 `"mcpServers": {}` 以遮蔽 `.mcp.json`；`codex-subprocess.ts` 从 stdin 的 `cwd` 提取工作目录传入 `GuardContext.cwd`（SD-48～SD-50） | ✅ | `src/targets/codex/hooks.ts`、`src/targets/codex/risks.ts`、`src/targets/codex/mcp.ts`、`src/targets/codex/index.ts`、`src/runtime/entries/codex-subprocess.ts`、`test/targets/command-hooks.test.ts`、`test/targets/mcp-environment.test.ts`、`test/runtime/codex-subprocess.test.ts` |
| `F-11-15` | 合并布局 manifest 位置、单条命令超时、MCP 用户配置变量剥离与守卫工作目录 | manifest 路径取 `hosts.agy.manifest`，未设置时默认布局写 `plugin.json`、合并布局（`sharedWith` 非空）写 `.antigravity-plugin/plugin.json`（1.3.5 容器实测：该位置与含 `.claude-plugin/`、`.codex-plugin/` 的合并目录均按 `antigravity` 插件安装并加载全部组件，不再写 F-11-03 的安装转换未实测风险；与 Codex 共用目录且显式设 `hosts.agy.manifest: 'plugin.json'` 时写残余风险说明 Codex 优先读取根 `plugin.json` 而不加载任何 hooks）；声明的命令 hook 指定 `timeout` 时写该值；本地 MCP 服务器的 `env` 含 `${user_config.<KEY>}` 时从 `mcp_config.json` 的 `env` 中剥离该键（剥离后为空对象时省略 `env`，`{pluginRoot}` 换算与 `${` 字面传递残余风险只按保留的键计算，并写残余风险列出已剥离的键）；`agy-subprocess.ts` 从 stdin 的 `workspacePaths[0]` 提取工作目录传入 `GuardContext.cwd`（1.3.5 容器实测）（SD-47～SD-50） | ✅ | `src/targets/agy/index.ts`、`src/targets/agy/manifest.ts`、`src/targets/agy/fields.ts`、`src/targets/agy/hooks.ts`、`src/targets/agy/mcp.ts`、`src/runtime/entries/agy-subprocess.ts`、`test/targets/command-hooks.test.ts`、`test/targets/mcp-environment.test.ts`、`test/runtime/agy-subprocess.test.ts`、`test/fixtures/merged/`（宿主实测见 `agy-local-tests.md`「替代 manifest 位置与合并目录（1.3.5，容器）」） |

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
| `test/container/run.sh check` | ✅ `biome check` 通过、`tsc` 与 `tsc -p tsconfig.runtime-core.json` 0 错误、`node --test` 352 pass / 0 fail、`check-feature-list.mjs` 136 个功能 / 28 条用户故事 / 27 项技术验收关系检查通过 | Docker 可用 |
| `test/container/run.sh exec node --test test/fixtures/fixtures.test.ts` | ✅ 21 个夹具（含 `merged`、`command-hooks`、`host-coverage`）逐字节比对、导入检查与入口用例全部通过（21 pass / 0 fail） | Docker 可用 |
| 容器内 `merged` 与 `host-coverage` 宿主校验（`test/container/run.sh shell`） | ✅ `claude plugin validate --strict` 对 `merged` 与 `host-coverage/dist/claude-code` 均输出 `✔ Validation passed`；`agy plugin validate` 对 `merged` 与 `host-coverage/dist/agy` 均输出 `[ok]` | Docker 可用 |

## 4. 交付物

- 配置与源项目读取：`src/config/types.ts`、`src/config/validate.ts`、`src/config/command-hooks.ts`、`src/source/types.ts`、`src/source/mcp.ts`、`src/source/mcp-fields.ts`。
- 守卫公共类型与运行入口：`src/runtime/core/types.ts`、`src/runtime/core/options.ts`、`src/runtime/entries/subprocess.ts`、`src/runtime/entries/claude-code-subprocess.ts`、`src/runtime/entries/codex-subprocess.ts`、`src/runtime/entries/agy-subprocess.ts`、`src/runtime/entries/claude-code-in-process.ts`。
- 构建编排与三个宿主模块：`src/build/plan.ts`、`src/build/components.ts`、`src/build/generate.ts`、`src/targets/types.ts`、`src/targets/claude-code/hooks.ts`、`src/targets/codex/{hooks,risks,mcp,index}.ts`、`src/targets/agy/{hooks,manifest,fields,mcp,risks,index}.ts`。
- 夹具、测试与使用说明：`test/fixtures/merged/`、`test/fixtures/command-hooks/`、`test/fixtures/host-coverage/`、单元测试（`test/config/`、`test/source/`、`test/build/`、`test/targets/`、`test/targets/merged-manifest-and-guard-cwd.test.ts`、`test/runtime/`、`test/bundle/`）与 `docs/guide/{configuration,guards,command-hooks,source-project,targets}.md`。

## 5. 与计划的偏差

- 在容器内对 `host-coverage` 夹具运行 `claude plugin validate --strict` 时，发现 `.mcp.json` 引用 `${user_config.UAPA_API_KEY}` 需要 `plugin.json` 的 `userConfig` 声明同名键才能通过严格校验；已在 `test/fixtures/host-coverage/source/uapa.config.ts` 的 `hosts['claude-code'].userConfig` 中补充 `UAPA_API_KEY` 声明并同步期望产物。
- 单条命令自定义 `timeout` 集中由 `command-hooks` 夹具（`SessionStart` `timeout: 10`）与 `test/targets/command-hooks.test.ts` 覆盖，`host-coverage` 夹具不重复配置 `commandHooks`。其余无偏差。

## 6. 技术决策

- SD-47～SD-50 已在 M5-08 排单提交（`fa4660e`）中回填至 `docs/feature-list/scope-decisions.md`、`docs/architecture/architecture.md`、`docs/architecture/module-interfaces.md`、`docs/architecture/command-hooks.md` 与 `docs/research/coding-agent-plugin-manifests/uapa-hook-adapters.md`。

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|

无新增技术债。

## 8. 风险与下一步

- 进入 [M5-07](../workorders/M5-07-v0-4-0-live-tests.md) 执行容器宿主实测收口与 [M5-00](../workorders/M5-00-v0-4-0-host-coverage.md) Sprint 收口。
