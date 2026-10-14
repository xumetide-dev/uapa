# 验收 M1-02：skills 端到端

> 本文记录 M1-02 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M1-02](../workorders/M1-02-skills-end-to-end.md) |
| 覆盖功能点 | `F-02-01`、`F-02-02`、`F-02-03`、`F-01-01`、`F-01-02`、`F-01-03`、`F-01-04`、`F-01-05`、`F-03-01`、`F-03-02`、`F-03-03`、`F-03-04`、`F-03-05`、`F-03-09`、`F-03-10`、`F-03-11`、`F-05-01`、`F-05-02`、`F-09-01`、`F-09-02`、`F-09-03`、`F-10-02`（取自总览「工单构成」表） |
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
| 1 | 硬约束：守卫不静默失效 | 读取守卫声明的单元测试：默认导出不符合 `GuardPlugin`、含 `afterTool`、`requires` 含 `replaceOutput` 时返回 `InputIssue`（F-02-03） | | | ⏳ |
| 2 | 硬约束：确定性输出 | 夹具在临时目录中构建并与期望产物逐字节比对；报告中没有绝对路径与时间 | | | ⏳ |
| 3 | 硬约束：不越权写入 | `resolvePluginDirs` 的单元测试覆盖插件目录等于或包含源项目根、`outDir`、另一宿主目录时校验失败；夹具比对整个源项目目录 | | | ⏳ |
| 4 | 硬约束：能力数据有出处 | `src/capabilities/claude-code-subprocess.ts` 写宿主版本 2.1.296、核对日期与出处文件名；TA-09 的单元测试检查每个已登记的数据模块 | | | ⏳ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-02-01` | 导出守卫公共类型 | 包入口导出 `GuardPlugin`、`ToolCall`、`BeforeTool`、`BeforeStop`、`Capability`；`GuardPlugin` 为 hooks 适配第 2 节去掉 `afterTool` 后的形式；`Capability` 含 `rewriteInput`、`replaceOutput`、`withholdOutput`、`stopGate`（`promptGate` 由 F-02-02 加入）；`src/runtime/core/types.ts` 另定义不由包入口导出的 `CanonicalTool`、`ToolNameMap`（模块接口 §4）与 `GuardCheck`（模块接口 §3）、`TargetRuntimeData`（入口与打包接口第 1 节） | ⏳ | |
| `F-02-02` | 提示提交前检查接口 | `GuardPlugin` 增加可选的 `beforePrompt(p: PromptSubmit)`，返回 `BeforePrompt`：`allow`，或带 `reason` 的 `block`；`Capability` 增加 `promptGate`；包入口另导出 `PromptSubmit` 与 `BeforePrompt` | ⏳ | |
| `F-02-03` | 构建时读取守卫声明 | `readGuard` 导入配置 `guard` 指定的守卫逻辑，按模块接口 §3 得出 `GuardDeclaration`（`name`、`requires` 与已实现的检查）；默认导出不符合 `GuardPlugin` 时返回 `InputIssue`；默认导出含 `afterTool` 方法，或 `requires` 含 `replaceOutput`、`withholdOutput` 时同样返回 `InputIssue`，原因写明 v0.1.0 不支持执行后检查（SD-20） | ⏳ | |
| `F-01-01` | 定义构建配置类型与 `defineConfig` | `UapaConfig` 与 `defineConfig` 按模块接口 §2 定义；目标名与宿主标识列表定义在 `src/config/targets.ts`，配置类型由它推导；类型不符时 `tsc` 报错；包入口导出 `defineConfig` 与 `UapaConfig` | ⏳ | |
| `F-01-02` | 加载 `uapa.config.ts` | 以 Node 类型剥离导入；`loadConfig` 按模块接口 §8 返回结果；使用不可擦除语法或相对导入缺 `.ts` 扩展名时返回 `InputIssue`，含文件与原因 | ⏳ | |
| `F-01-03` | 校验构建配置 | 未知目标名、重复目标、缺必填字段、未知字段、`hosts` 中出现未配置目标的宿主、`hosts.codex.hooksFile` 为绝对路径或含 `..`，或插件目录违反模块接口 §2 的路径规则（经 `src/config/layout.ts` 的 `resolvePluginDirs` 检查）时失败；错误给出字段路径 | ⏳ | |
| `F-01-04` | 读取 skills | `skills/` 不存在时 skills 为空列表；`skills/` 下不是目录的项忽略；每个子目录必须含 `SKILL.md`；frontmatter 须能由 yaml 解析，`name`、`description` 为非空字符串；目录名与 `name` 不一致时失败；`Skill.files` 递归列出该目录下的全部文件，按字典序 | ⏳ | |
| `F-01-05` | 读取组件的目标限定 | 组件 frontmatter 的 `targets` 记入组件模型；含未知目标名或为空数组时失败；是否适用于某目标由 F-03-02 判定 | ⏳ | |
| `F-03-01` | 定义目标能力数据模型 | `TargetCapabilities` 按模块接口 §4 定义：宿主名与版本、核对日期、出处、组件承载、守卫能力（`rewriteInput`、`replaceOutput`、`withholdOutput`、`stopGate`、`promptGate`）、失败默认行为、超时与工具名映射（`ToolNameMap`）；缺字段时 `tsc` 报错；`src/capabilities/index.ts` 定义登记处 `targetCapabilities: Readonly<Record<TargetName, TargetCapabilities>>`，各目标的条目由该目标的能力数据功能（F-05-01、F-05-14、F-06-01、F-11-01）加入 | ⏳ | |
| `F-03-02` | 构建时检查组件承载 | 目标不能承载的组件列为跳过；frontmatter 显式写了该目标时该目标失败 | ⏳ | |
| `F-03-03` | 按宿主逐个构建 | `src/build/index.ts` 按模块接口 §8 导出 `build`：先调用 `readSource` 与 `readGuard`，任一返回 `ok: false` 时返回 `input-error`，不写任何文件；未配置守卫时各目标的 `TargetPlan.checks` 为空。经注册表按宿主调用宿主模块，只传入通过能力检查的目标；同一宿主中失败的目标不进入该宿主的产物；宿主模块生成失败时该宿主的目标全部失败；一个宿主失败不影响其他宿主；结果按目标标明成功或失败及原因 | ⏳ | |
| `F-03-04` | 放置 skills | 写入该插件目录的成功目标所适用 skill 的并集，逐字节复制到 `skills/<name>/`，frontmatter 保留原样；同目录中不适用该 skill 的目标记为残余风险（模块接口 §5、SD-21） | ⏳ | |
| `F-03-05` | 按宿主分目录写出 | 默认每个宿主一个插件目录（`<outDir>/<宿主>`），同一宿主的多个目标写入同一目录；该宿主至少一个目标成功时先清空该目录再写入，全部失败时目录保持原状 | ⏳ | |
| `F-03-09` | 生成构建报告 | 按模块接口 §7 写出 `<outDir>/uapa-report.json`：每个目标的状态、错误、安装单位、跳过项、降级项、覆盖文件、宿主校验结果、残余风险与能力数据核对日期；不含时间与绝对路径 | ⏳ | |
| `F-03-10` | 生成终端摘要 | `formatSummary` 按目标列出成功或失败，以及跳过、降级、残余风险的数量和 `reportPath` 参数给出的报告文件路径；摘要由命令行打印 | ⏳ | |
| `F-03-11` | 定义宿主模块接口与注册表 | `src/targets/types.ts` 按模块接口 §5 定义 `HostModule`、`HostInput`、`HostResult`；`src/targets/index.ts` 定义登记处 `hostModules: Readonly<Record<HostName, HostModule>>`，各宿主的条目由该宿主的 manifest 功能（F-05-02、F-06-02、F-11-02）加入；构建编排只经注册表取得宿主模块，接口中不出现具体宿主名；`HostInput` 引用的 `BundleRequest` 按入口与打包接口第 1 节定义在 `src/bundle/types.ts`；F-04-06 完成前，构建编排传入的 `bundle` 函数抛出“未实现”错误 | ⏳ | |
| `F-05-01` | `claude-code:subprocess` 的能力数据 | 宿主版本 2.1.296，写明核对日期与出处；取值与 hooks 适配第 4、6、7、8 节一致，工具名见[跨平台对比「工具名差异」](../research/coding-agent-plugin-manifests/cross-platform-comparison.md#工具名差异)；`hookTimeoutSeconds` 为 `null`、`defaultTimeoutSeconds` 为 600；`promptGate` 在 TA-15 实测前为不支持；在登记处加入本目标（M2） | ⏳ | |
| `F-05-02` | 生成 `.claude-plugin/plugin.json` | 由配置生成名称、版本、描述、作者与关键词；宿主选项 `hosts['claude-code']` 可写 `displayName`、`userConfig`、`dependencies` 与 `$schema`；名称不是 kebab-case、以 `claude-`、`anthropic-`、`anthropics-`、`cc-plugin-` 开头或等于 `claude`、`anthropic`、`claude-code`、`claude-mods` 时生成失败，其余保留名由 F-05-09 的宿主校验发现；配置未写 `author` 时生成失败，原因写明 `claude plugin validate --strict` 把缺少 `author` 判为失败 | ⏳ | |
| `F-09-01` | `uapa build` 命令 | 读取当前目录的 `uapa.config.ts`，`--config` 可指定路径，配置中的相对路径以该文件所在目录为基准；按模块接口 §8 调用 `loadConfig` 与 `build`，构建后以 `formatSummary(report, reportPath)` 打印终端摘要 | ⏳ | |
| `F-09-02` | 退出码约定 | 按模块接口 §8 的退出码表；退出码只由 `BuildOutcome` 与捕获的异常决定；错误按 §8 的格式写到 stderr，每条一行；退出码的计算以构造的 `BuildOutcome` 与抛出的异常做单元测试，覆盖表中每一行；端到端用例由夹具 `invalid-config`、`usage-error`、`verify-failed`、`requires-missing`、`unknown-override` 承接 | ⏳ | |
| `F-09-03` | 帮助与版本 | `--help` 列出命令与选项；`--version` 输出包版本；两者输出到 stdout，以退出码 0 结束 | ⏳ | |
| `F-10-02` | 目标比对夹具 | 夹具按本文「夹具」一节的目录格式组织，测试按该节的方式运行并比对；本功能交付夹具运行器、更新命令（写在 `test/fixtures/README.md` 中）与 M2 的夹具；其余夹具按夹具表「加入比对」列在对应里程碑加入，M6 前全部比对通过 | ⏳ | |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
pnpm check
node --test test/fixtures/fixtures.test.ts
node src/cli/main.ts --help
node src/cli/main.ts --version
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `pnpm check` | ⏳ | 无 |
| `node --test test/fixtures/fixtures.test.ts` | ⏳ | 无 |
| `node src/cli/main.ts --help` | ⏳ | 无 |
| `node src/cli/main.ts --version` | ⏳ | 无 |

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
