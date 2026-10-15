# 验收 M4-04：守卫选项

> 本文记录 M4-04 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M4-04](../workorders/M4-04-guard-options.md) |
| 覆盖功能点 | `F-02-05`、`F-04-09`、`F-05-17`、`F-05-18`、`F-06-10`、`F-11-10`（取自总览「工单构成」表） |
| 验收日期 | 2026-10-15 |
| 验收结论 | 通过 |
| 判断范围 | 夹具与单元测试 + 宿主实测 |
| commit | `2491715` |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | 选项取值无效时两种入口都不调用守卫，按守卫出错收口：`guard-options` 的 `invalid-number.json`、`invalid-boolean.json` 以退出码 2 拒绝；`options-entries.test.ts` 覆盖四种检查 |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | `fixtures.test.ts` 对全部夹具（含 `guard-options`）的 `.mjs` 与 `hooks/register.ts` 做导入检查（TA-01），通过 |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | 写出逻辑未改；`guard-options` 夹具比对整个项目目录，没有多出的文件 |
| V4 | 能力数据含无出处的宿主行为 | 否 | 能力数据未改。`CLAUDE_PLUGIN_OPTION_*` 与 `register` 的 `options` 依据本地实测「commands 与 userConfig」；Codex 没有插件用户配置依据 `codex-source-review.md`「commands、rules 与用户配置」；agy 写为未核实的残余风险 |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：守卫不静默失效 | `guard-options` 的入口用例：`CLAUDE_PLUGIN_OPTION_*` 为无效值时执行前检查以退出码 2 拒绝；hooks 模块以桩传入类型不符的 `options` 时返回 `{ deny }` | `CLAUDE_PLUGIN_OPTION_MAXLENGTH=abc`：退出码 2，stderr `uapa: 守卫选项无效: maxLength`；`CLAUDE_PLUGIN_OPTION_STRICT_MODE=TRUE` 且命令为 `git status`：退出码 2，stderr `uapa: 守卫选项无效: strict_mode`；`register` 收到 `{ maxLength: '64' }`：`tool.call` 返回 `{ deny: 'uapa: 守卫选项无效: maxLength' }`，`next` 未调用 | `test/fixtures/guard-options/expected/stdin/claude-code-subprocess/invalid-*.json`；`test/fixtures/hooks-module.test.ts` | ✅ |
| 2 | 硬约束：产物零依赖 | TA-01 的导入检查覆盖 `guard-options` 的入口与守卫文件 | 「夹具 guard-options」通过：三个 `.mjs` 入口只导入 `node:` 内置模块，`uapa-guard.mjs` 不导入，`register.ts` 只导入 `./uapa-guard.mjs` | `test/fixtures/fixtures.test.ts` | ✅ |
| 3 | 硬约束：不在运行时推断宿主 | 入口只按打包时注入的 `options` 与本目标协议读取；`codex:subprocess`、`agy:subprocess` 的入口用例设置 `CLAUDE_PLUGIN_OPTION_*` 时仍取默认值 | 只有 `claude-code-subprocess.ts` 实现 `optionValue`；Codex 与 agy 的 `claude-option-env-ignored.json` 设置三个 `CLAUDE_PLUGIN_OPTION_*`，拒绝原因仍为 `uapa-guard: 拒绝标记命令 uapa-deny-probe（maxLength=200，strict_mode=true）` | `test/fixtures/guard-options/expected/stdin/{codex,agy}-subprocess/` | ✅ |
| 4 | 硬约束：确定性输出 | `guard-options` 夹具逐字节比对；`userConfig` 与 `options` 按选项名排序 | 夹具比对通过；`userConfig` 的键为 `label`、`maxLength`、`strict_mode`，与源文件中的声明顺序（`maxLength`、`strict_mode`、`label`）无关；打包数据的 `options` 同序 | `test/fixtures/guard-options/expected/tree/dist/claude-code/.claude-plugin/plugin.json`；`test/source/guard.test.ts`「守卫选项按名称排序得出」 | ✅ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-02-05` | 守卫选项 | `GuardPlugin` 增加可选的 `options`（选项名 → `GuardOption`：`type` 为 `'string'`、`'number'` 或 `'boolean'`，`title`、`description` 为非空字符串，`default` 的类型与 `type` 一致），各检查方法增加最后一个参数 `GuardContext`（`options` 为选项名 → 取值）；包入口导出 `GuardOption`、`GuardContext`；`readGuard` 校验选项：选项名匹配 `^[A-Za-z][A-Za-z0-9_]*$`，全大写后不重复，`title` 与 `description` 为非空单行字符串，`default` 与 `type` 一致且 number 为有限数；违反时返回 `InputIssue`，`field` 如 `options.maxRetries.default`；`GuardDeclaration.options` 按选项名排序（SD-35） | ✅ | `src/runtime/core/types.ts`、`src/index.ts` 导出 `GuardOption`、`GuardContext`；`src/source/guard.ts` 的 `checkOptions`。`test/source/guard.test.ts` 两个新测试：排序结果，以及 12 种不合规声明的 `field`（如 `options.limit.default`、`options.LIMIT`）；`test/runtime/types.test.ts` 用 `@ts-expect-error` 核对 `default` 与 `type` 不一致、缺 `default` |
| `F-04-09` | 向守卫传入选项 | `TargetRuntimeData` 增加 `options`（`GuardDeclaration.options` 中各选项的 `type` 与 `default`）；子进程入口在调用守卫前经宿主实现的 `optionValue` 取得各选项的文本：协议未实现该方法或返回 `undefined` 时取 `default`，否则按 `type` 解析（number 为有限数，boolean 只接受 `true`、`false`）；解析失败时按守卫出错处理（F-04-04、F-04-08），原因为 `uapa: 守卫选项无效: <选项名>`；取值以 `GuardContext` 传给本次调用的检查（入口与打包接口第 3 节，SD-35） | ✅ | `src/runtime/core/options.ts`（`optionsFromText`、`optionsFromValues`、`guardContext`）；`subprocess.ts` 在 `skip` 之后取值，经 `callGuard` 传入。`test/runtime/options.test.ts` 5 个测试；`test/runtime/options-entries.test.ts` 的 4 个子进程入口测试：默认值、文本解析（`' 7 '` → 7）、未声明选项时为 `{}`、无效时四种检查的收口 |
| `F-05-17` | 生成守卫选项的 `userConfig` | 守卫声明有选项且至少一个 Claude Code 目标的 `TargetPlan.checks` 非空时，`plugin.json` 的 `userConfig` 在 `hosts['claude-code'].userConfig` 的选项之后按选项名写入各选项的 `type`、`title`、`description`、`default`；宿主选项 `userConfig` 不是对象，或其中某个键与某个守卫选项名全大写后相同时生成失败（SD-35） | ✅ | `src/targets/claude-code/manifest.ts` 的 `userConfig`；`guard-options` 的 `plugin.json`。`test/targets/guard-options.test.ts`：宿主选项 `token` 在前、守卫选项按名称在后；没有要检查的事件时原样写出宿主选项；宿主选项为数组或含 `LIMIT` 时两个目标各一条错误且不打包 |
| `F-05-18` | 读取守卫选项 | `claude-code-subprocess.ts` 的 `optionValue` 返回环境变量 `CLAUDE_PLUGIN_OPTION_<选项名的全大写>`（宿主只导出用户设置过的选项，未设置时取 `default`）；hooks 模块入口以 `register` 的 `options` 取值，值的类型与声明不一致时按 F-04-09 的无效取值处理；依据[本地实测「commands 与 userConfig」](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#commands-与-userconfig) | ✅ | `claude-code-subprocess.ts` 的 `optionValue`；`claude-code-in-process.ts` 的 `register(on, options)`，生成的 `register.ts` 为 `(on, options) => guard(on, options)`。`configured.json`：`MAXLENGTH=64`、`STRICT_MODE=false`、`LABEL=x y=z` 时原因为 `x y=z: 拒绝标记命令 uapa-deny-probe（maxLength=64，strict_mode=false）`；`hooks-module.test.ts` 与 `options-entries.test.ts` 的 3 个 hooks 模块测试覆盖默认值、带类型的取值与类型不符 |
| `F-06-10` | 守卫选项取默认值 | 入口协议不实现 `optionValue`，守卫选项取 `default`；守卫声明有选项且 `TargetPlan.checks` 非空时，残余风险写明“Codex 没有插件用户配置，守卫选项取构建时默认值”（SD-35） | ✅ | `src/targets/codex/index.ts`；`guard-options` 的 Codex 报告含该风险（共 4 条残余风险）；`guard-options.test.ts` 核对 `checks` 为空时不写 |
| `F-11-10` | 守卫选项取默认值 | 入口协议不实现 `optionValue`，守卫选项取 `default`；守卫声明有选项且 `TargetPlan.checks` 非空时，残余风险写明“agy 没有已核实的插件用户配置，守卫选项取构建时默认值”（SD-35） | ✅ | `src/targets/agy/index.ts`；`guard-options` 的 agy 报告含该风险（共 1 条残余风险）；`guard-options.test.ts` 核对 `checks` 为空时不写 |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
test/container/run.sh check
```

```bash
test/container/run.sh exec node --test test/fixtures/fixtures.test.ts test/fixtures/hooks-module.test.ts
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `test/container/run.sh check` | 两套 `tsc` 通过，Biome 检查 205 个文件无问题，`node --test` 294 pass / 0 fail，功能清单检查通过 | Docker |
| `test/container/run.sh exec node --test test/fixtures/fixtures.test.ts test/fixtures/hooks-module.test.ts` | 23 pass / 0 fail（含「夹具 guard-options」与 guard-options 的 hooks 模块测试） | Docker |
| 宿主实测：`claude plugin validate --strict <插件目录>` | Claude Code 2.1.296：`guard-options` 与 `claude-both` 的 Claude Code 插件目录均为 `✔ Validation passed`；模块分析列出 `tool.call` 带 `.catch`、写入 `UAPA_MODULE_SESSION_GUARD_OPTIONS`（宿主实测） | Docker；容器中的 Claude 令牌 |

## 4. 交付物

- `src/runtime/core/types.ts`：`GuardOption`、`GuardOptionValue`、`GuardContext`、
  `GuardPlugin.options` 与各检查方法的 `ctx`、`TargetRuntimeData.options`、`RuntimeOption`。
- `src/runtime/core/options.ts`（新增）：取值的解析、检查与 `guardContext`。
- `src/runtime/entries/subprocess.ts`：`optionValue`、取值与 `callGuard`；停机计数移入
  `src/runtime/entries/stop-counter.ts`（新增）。`claude-code-subprocess.ts` 实现 `optionValue`。
- `src/runtime/entries/claude-code-in-process.ts`：`register(on, options)`。
- `src/source/guard.ts`：选项校验、`GuardDeclaration.options`、`runtimeOptions`。
- `src/targets/`：三个宿主模块的打包数据；Claude Code 的 `userConfig` 与 `register.ts`；
  Codex 与 agy 的残余风险。`src/index.ts`、`src/config/types.ts`。
- 测试：`test/runtime/options.test.ts`、`test/runtime/options-entries.test.ts`、
  `test/targets/guard-options.test.ts`（新增）；`test/runtime/guards/optioned.ts`（新增）；
  hooks 模块的测试工具移入 `test/helpers/hooks-module.ts`，`in-process.test.ts` 改为引用；
  `test/source/guard.test.ts`、`test/runtime/types.test.ts`、`test/fixtures/hooks-module.test.ts`
  增加用例；测试用子进程入口实现 `optionValue`（`TEST_OPTION_<选项名>`）。
- 夹具：`guard-options`（新增，9 个入口用例）。
- 文档：`docs/guide/guards.md`「守卫选项」、`configuration.md` 宿主选项表、`targets.md` 组件
  与能力表；`docs/architecture/runtime-interfaces.md` 第 1～3 节。

## 5. 与计划的偏差

- 施工单红线要求现有夹具“除常量外不变”。实际 11 个夹具的打包入口与守卫文件有变化，
  `register.ts` 有变化，构建报告与 manifest 不变：
  - 各入口的 `.mjs`（`after-tool`、`claude-both`、`command-hooks`、`full`、`in-process-only`、
    `merged`、`merged-conflict`、`requires-missing`、`single-claude`、`throwing-guard`、
    `verify-failed`）：取值代码由入口无条件调用，打包时不能按空的 `options` 移除；停机计数
    函数移入 `stop-counter.ts` 后在打包结果中的位置改变；数据常量多出 `"options": []`。
  - `hooks/register.ts`（`after-tool`、`claude-both`、`command-hooks`、`full`、`in-process-only`、
    `merged`）：按入口与打包接口第 2 节统一写作 `(on, options) => guard(on, options)`，不随守卫
    是否声明选项变化。`claude-both` 的产物经 `validate --strict` 通过（§3）。
- 接口文档第 1 节的 `RuntimeOption` 原为按类型区分的联合，改为单一接口（类型为
  `GuardOption['type']`，默认值为 `GuardOptionValue`），`GuardOptionValue` 移至 `types.ts`；
  第 3 节增加 `guardContext`；第 2 节的 hooks 模块改为在 `register` 中取值一次，各处理函数共用。
  文档随本单修改。
- 施工单未列的整理：停机计数拆出 `subprocess.ts`（施工单现状记其已有 350 行，改后 284 行）；
  hooks 模块测试工具移入 `test/helpers/`，供 `options-entries.test.ts` 与夹具测试共用。

## 6. 技术决策

| 决策 | 依据 | 回填状态 |
|---|---|---|
| 取值无效时由 `callGuard` 直接返回失败，沿用守卫出错的全部收口路径 | F-04-09 写明按守卫出错处理；执行后检查因此与守卫抛错一样交出原因（能替换时替换，否则扣留），停机计数不变 | 接口文档第 3 节 |
| 选项只接受 `type`、`title`、`description`、`default` 四个键，其他键（如 `sensitive`、`multiple`）为输入错误 | SD-35 只定义这四个键；静默丢弃未知键会让使用者误以为宿主支持该设置 | 使用指南「守卫选项」；实现注释 |
| `ctx` 在类型上为必填参数 | 守卫读取 `ctx.options` 时不必判断 `undefined`；只声明前几个参数的守卫仍可赋给 `GuardPlugin`，已有守卫逻辑不用改。直接调用检查方法的测试须传入 `{ options: {} }`，使用指南的测试示例已改 | 使用指南「测试守卫」 |
| hooks 模块的取值在 `register` 时得出一次 | 宿主每次加载模块时以当时的设置调用 `register`（本地实测「commands 与 userConfig」）；各处理函数共用同一取值 | 接口文档第 2 节 |
| `userConfig` 的检查在打包之前进行 | 生成失败时不浪费打包；测试核对失败时没有打包请求 | 实现注释 |

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|
| 1 | 以 marketplace 安装并以 `claude plugin configure` 设置取值后，会话中两种形态的拒绝原因尚未实测；本单只有入口用例与 `validate --strict` | 设置后的取值在会话中是否到达守卫，目前依据调研探测插件的实测 | M4-05（TA-24）在测试容器中安装 `guard-options` 产物，设置选项前后各运行一次会话 |

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- 以 `--plugin-dir` 加载时宿主不使用已保存的设置，守卫取 `default`（调研实测）；使用指南的
  取值来源表已写明。
- 下一步：M4-05（v0.3.0 产物的宿主实测）。
