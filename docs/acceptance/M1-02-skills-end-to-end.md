# 验收 M1-02：skills 端到端

> 本文记录 M1-02 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M1-02](../workorders/M1-02-skills-end-to-end.md) |
| 覆盖功能点 | `F-02-01`、`F-02-02`、`F-02-03`、`F-01-01`、`F-01-02`、`F-01-03`、`F-01-04`、`F-01-05`、`F-03-01`、`F-03-02`、`F-03-03`、`F-03-04`、`F-03-05`、`F-03-09`、`F-03-10`、`F-03-11`、`F-05-01`、`F-05-02`、`F-09-01`、`F-09-02`、`F-09-03`、`F-10-02`（取自总览「工单构成」表） |
| 验收日期 | 2026-10-14 |
| 验收结论 | 有条件通过（需要第二个宿主、同一宿主的第二个目标或后续夹具才能构造用例的分支，由 M1-03～M1-07 接手，见 §7） |
| 判断范围 | 夹具与单元测试 |
| commit | 8b9fdd0 |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | 本单不生成 hooks 配置与入口；`readGuard` 对不支持的声明返回输入错误而不是忽略（`test/source/guard.test.ts` 的 5 个用例）；`bundle` 在 F-04-06 前抛出“打包尚未实现”，不会生成缺少检查的入口 |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | 夹具 `no-guard` 的插件目录只有 `.claude-plugin/plugin.json` 与 `skills/review/SKILL.md`，不含脚本 |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | 四个夹具比对整个源项目目录：`no-guard`、`empty` 只多出 `dist/claude-code/` 与 `dist/uapa-report.json`，`invalid-config`、`usage-error` 只有源文件；`--check` 尚未开放（命令行把它当作未知选项，`runBuild` 收到 `check: true` 时抛出“比对模式尚未实现”） |
| V4 | 能力数据含无出处的宿主行为 | 否 | `test/capabilities/capabilities.test.ts`（TA-09）检查每个已登记目标的宿主版本、核对日期与出处文件存在 |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：守卫不静默失效 | 读取守卫声明的单元测试：默认导出不符合 `GuardPlugin`、含 `afterTool`、`requires` 含 `replaceOutput` 时返回 `InputIssue`（F-02-03） | 5 pass / 0 fail：未配置守卫为 `null`；得出 `name`、`requires` 与 `checks`；默认导出不是对象、`name` 为空、缺 `requires`、`requires[0]` 为未知能力、`beforeTool` 不是函数时返回 `InputIssue` 并给出对应字段；含 `afterTool`、`requires` 含 `replaceOutput` 或 `withholdOutput` 时返回 `InputIssue`，原因含“v0.1.0 不支持执行后检查（SD-20）”；守卫文件不存在时返回“文件不存在” | `test/source/guard.test.ts` | ✅ |
| 2 | 硬约束：确定性输出 | 夹具在临时目录中构建并与期望产物逐字节比对；报告中没有绝对路径与时间 | 4 pass / 0 fail；每次在新建的临时目录中运行，比对退出码、stdout、stderr、文件集合与逐字节内容；`uapa-report.json` 中的路径为 `dist/claude-code`，没有时间字段 | `node --test test/fixtures/fixtures.test.ts`；`test/fixtures/no-guard/expected/tree/dist/uapa-report.json` | ✅ |
| 3 | 硬约束：不越权写入 | `resolvePluginDirs` 的单元测试覆盖插件目录等于或包含源项目根、`outDir`、另一宿主目录时校验失败；夹具比对整个源项目目录 | `hosts.claude-code.dir` 取 `.`、`..`（同时等于或包含源项目根与 `outDir`，各报两条）、`dist`（等于 `outDir`）、`out`（`outDir` 为 `out/reports` 时包含它）时报该字段；`outDir: '../..'` 使默认插件目录包含源项目根时报 `outDir`；`plugins/claude` 通过；“另一宿主目录”分支已实现，只登记一个宿主时无法构造用例；夹具比对整个源项目目录 | `test/config/validate.test.ts` 的“默认布局的插件目录不得等于或包含源项目根目录、outDir”；夹具运行器 `readTree` | ⚠️ 仅源项目根与 `outDir` 两种冲突有用例 |
| 4 | 硬约束：能力数据有出处 | `src/capabilities/claude-code-subprocess.ts` 写宿主版本 2.1.296、核对日期与出处文件名；TA-09 的单元测试检查每个已登记的数据模块 | 数据模块写 `version: '2.1.296'`、`checked: '2026-10-13'`、`source: 'claude-code-plugins.md'`；TA-09 两个用例通过，第二个检查出处文件在调研目录中存在 | `test/capabilities/capabilities.test.ts` | ✅ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-02-01` | 导出守卫公共类型 | 包入口导出 `GuardPlugin`、`ToolCall`、`BeforeTool`、`BeforeStop`、`Capability`；`GuardPlugin` 为 hooks 适配第 2 节去掉 `afterTool` 后的形式；`Capability` 含 `rewriteInput`、`replaceOutput`、`withholdOutput`、`stopGate`（`promptGate` 由 F-02-02 加入）；`src/runtime/core/types.ts` 另定义不由包入口导出的 `CanonicalTool`、`ToolNameMap`（模块接口 §4）与 `GuardCheck`（模块接口 §3）、`TargetRuntimeData`（入口与打包接口第 1 节） | ✅ | `src/index.ts` 导出所列类型；`test/runtime/types.test.ts` 从包入口导入并编译，3 pass；`@ts-expect-error` 断言 `GuardPlugin` 字面量含 `afterTool` 时 `tsc` 报 TS2353；`src/runtime/core/types.ts` 定义 `CanonicalTool`、`ToolNameMap`、`GuardCheck`、`TargetRuntimeData`，由 `tsconfig.runtime-core.json` 检查 |
| `F-02-02` | 提示提交前检查接口 | `GuardPlugin` 增加可选的 `beforePrompt(p: PromptSubmit)`，返回 `BeforePrompt`：`allow`，或带 `reason` 的 `block`；`Capability` 增加 `promptGate`；包入口另导出 `PromptSubmit` 与 `BeforePrompt` | ✅ | `test/runtime/types.test.ts`：守卫的 `beforePrompt` 返回 `{ kind: 'block', reason }`；`BeforePrompt` 写 `rewrite` 时 `tsc` 报错；`CAPABILITIES` 含 `promptGate` |
| `F-02-03` | 构建时读取守卫声明 | `readGuard` 导入配置 `guard` 指定的守卫逻辑，按模块接口 §3 得出 `GuardDeclaration`（`name`、`requires` 与已实现的检查）；默认导出不符合 `GuardPlugin` 时返回 `InputIssue`；默认导出含 `afterTool` 方法，或 `requires` 含 `replaceOutput`、`withholdOutput` 时同样返回 `InputIssue`，原因写明 v0.1.0 不支持执行后检查（SD-20） | ✅ | §1 第 1 行；`test/source/guard.test.ts` 5 pass |
| `F-01-01` | 定义构建配置类型与 `defineConfig` | `UapaConfig` 与 `defineConfig` 按模块接口 §2 定义；目标名与宿主标识列表定义在 `src/config/targets.ts`，配置类型由它推导；类型不符时 `tsc` 报错；包入口导出 `defineConfig` 与 `UapaConfig` | ✅ | `test/config/types.test.ts` 2 pass：从包入口导入 `defineConfig`；未登记的目标名、未登记的宿主、缺少 `version` 三处 `@ts-expect-error` 均被 `tsc` 消费；`HostName`、`TargetName` 由 `HOSTS`、`TARGETS` 推导 |
| `F-01-02` | 加载 `uapa.config.ts` | 以 Node 类型剥离导入；`loadConfig` 按模块接口 §8 返回结果；使用不可擦除语法或相对导入缺 `.ts` 扩展名时返回 `InputIssue`，含文件与原因 | ✅ | `test/config/load.test.ts` 4 pass：配置以 `import type { UapaConfig } from 'uapa'` 与 `satisfies` 写法导入并通过校验；配置自身或被导入的 `helper.ts` 含 `enum` 时 `file` 为出错的文件、原因以“使用了 Node 类型剥离不支持的语法”开头；相对导入缺扩展名时原因为“相对导入缺少 .ts 扩展名：<模块>”；默认导出缺失、不是对象、文件不存在各返回 `InputIssue`；Node 24.20.0 与 22.19.0 结果相同 |
| `F-01-03` | 校验构建配置 | 未知目标名、重复目标、缺必填字段、未知字段、`hosts` 中出现未配置目标的宿主、`hosts.codex.hooksFile` 为绝对路径或含 `..`，或插件目录违反模块接口 §2 的路径规则（经 `src/config/layout.ts` 的 `resolvePluginDirs` 检查）时失败；错误给出字段路径 | ⚠️ 未知目标名、重复目标、空目标列表、缺必填字段、未知字段与插件目录等于或包含源项目根、`outDir` 已有用例；`hosts` 中未配置的宿主、另一宿主目录、`hosts.codex.hooksFile` 待第二个宿主与 `codex` 登记 | `test/config/validate.test.ts` 4 pass，字段路径如 `targets[1]`、`name`、`extra`、`hosts.codex`（未登记的宿主）、`hosts.claude-code.foo`、`version`、`author.name`、`hosts.claude-code.dir`、`outDir`；夹具 `invalid-config` 的 stderr 为 `uapa: uapa.config.ts: targets[1]: 未知目标名 "cursor:subprocess"`；缺口见 §7 第 1、2 行 |
| `F-01-04` | 读取 skills | `skills/` 不存在时 skills 为空列表；`skills/` 下不是目录的项忽略；每个子目录必须含 `SKILL.md`；frontmatter 须能由 yaml 解析，`name`、`description` 为非空字符串；目录名与 `name` 不一致时失败；`Skill.files` 递归列出该目录下的全部文件，按字典序 | ✅ | `test/source/skills.test.ts` 前 3 个用例 pass：`skills/` 不存在与其下只有普通文件时为空列表；递归列出 `README.md`、`SKILL.md`、`scripts/run.sh` 并按字典序；缺 `SKILL.md`、没有 frontmatter、YAML 无法解析、`name` 与目录名不一致、`description` 为空时失败 |
| `F-01-05` | 读取组件的目标限定 | 组件 frontmatter 的 `targets` 记入组件模型；含未知目标名或为空数组时失败；是否适用于某目标由 F-03-02 判定 | ✅ | `test/source/skills.test.ts` 的“frontmatter 的 targets 含未知目标名或为空数组时失败”：字段路径为 `targets[0]` 与 `targets`；合法时记入 `Skill.targets` |
| `F-03-01` | 定义目标能力数据模型 | `TargetCapabilities` 按模块接口 §4 定义：宿主名与版本、核对日期、出处、组件承载、守卫能力（`rewriteInput`、`replaceOutput`、`withholdOutput`、`stopGate`、`promptGate`）、失败默认行为、超时与工具名映射（`ToolNameMap`）；缺字段时 `tsc` 报错；`src/capabilities/index.ts` 定义登记处 `targetCapabilities: Readonly<Record<TargetName, TargetCapabilities>>`，各目标的条目由该目标的能力数据功能（F-05-01、F-05-14、F-06-01、F-11-01）加入 | ✅ | `src/capabilities/types.ts`；`test/capabilities/capabilities.test.ts` 的“能力数据缺字段时 tsc 报错（F-03-01）”以 `@ts-expect-error` 断言缺 `toolNames` 时报 TS2741；登记处只含 `claude-code:subprocess`，TA-09 用例断言登记处的键与 `TARGETS` 一致 |
| `F-03-02` | 构建时检查组件承载 | 目标不能承载的组件列为跳过；frontmatter 显式写了该目标时该目标失败 | ✅ | `test/build/build.test.ts` 的 TA-04 用例：以合成的能力数据（`components.skills` 为 `'none'`）构建，未写 `targets` 的 skill 记入 `skipped`，显式写了本目标的 skill 使目标失败并给出原因 |
| `F-03-03` | 按宿主逐个构建 | `src/build/index.ts` 按模块接口 §8 导出 `build`：先调用 `readSource` 与 `readGuard`，任一返回 `ok: false` 时返回 `input-error`，不写任何文件；未配置守卫时各目标的 `TargetPlan.checks` 为空。经注册表按宿主调用宿主模块，只传入通过能力检查的目标；同一宿主中失败的目标不进入该宿主的产物；宿主模块生成失败时该宿主的目标全部失败；一个宿主失败不影响其他宿主；结果按目标标明成功或失败及原因 | ⚠️ 单宿主、单目标的分支已有用例；“同一宿主中失败的目标不进入该宿主的产物”与“一个宿主失败不影响其他宿主”待第二个目标与第二个宿主登记 | `test/build/build.test.ts` 5 pass：`input-error` 时不写文件；`checks` 为空；宿主模块返回错误或抛出时目标失败、原因为“同一宿主的生成失败…”、插件目录保持原状；测试用宿主模块经注入的注册表调用；缺口见 §7 第 1、3 行 |
| `F-03-04` | 放置 skills | 写入该插件目录的成功目标所适用 skill 的并集，逐字节复制到 `skills/<name>/`，frontmatter 保留原样；同目录中不适用该 skill 的目标记为残余风险（模块接口 §5、SD-21） | ⚠️ 并集复制与逐字节保留已有用例；残余风险分支待同一插件目录有第二个目标 | 夹具 `no-guard`：`dist/claude-code/skills/review/` 下的 `SKILL.md` 与子目录文件 `references/checklist.md` 与源文件逐字节一致；缺口见 §7 第 3 行 |
| `F-03-05` | 按宿主分目录写出 | 默认每个宿主一个插件目录（`<outDir>/<宿主>`），同一宿主的多个目标写入同一目录；该宿主至少一个目标成功时先清空该目录再写入，全部失败时目录保持原状 | ✅ | `test/config/layout.test.ts`：默认为 `<outDir>/<宿主>`、`dir` 相对配置文件所在目录；`test/build/build.test.ts`：成功时旧文件被清除，宿主模块失败时预置的旧文件保留 |
| `F-03-09` | 生成构建报告 | 按模块接口 §7 写出 `<outDir>/uapa-report.json`：每个目标的状态、错误、安装单位、跳过项、降级项、覆盖文件、宿主校验结果、残余风险与能力数据核对日期；不含时间与绝对路径 | ✅ | 夹具 `no-guard`、`empty` 的 `uapa-report.json` 逐字节比对：含 `status`、`errors`、`host`（含 `checked`）、`units`、`skipped`、`degraded`、`overridden`、`hostValidation`、`residualRisks`；宿主校验在 F-05-09（M1-03）前为 `"none"` |
| `F-03-10` | 生成终端摘要 | `formatSummary` 按目标列出成功或失败，以及跳过、降级、残余风险的数量和 `reportPath` 参数给出的报告文件路径；摘要由命令行打印 | ✅ | `test/report/summary.test.ts` 1 pass；夹具 `no-guard` 的 stdout 为“成功 claude-code:subprocess：跳过 0，降级 0，残余风险 0”与“构建报告：dist/uapa-report.json” |
| `F-03-11` | 定义宿主模块接口与注册表 | `src/targets/types.ts` 按模块接口 §5 定义 `HostModule`、`HostInput`、`HostResult`；`src/targets/index.ts` 定义登记处 `hostModules: Readonly<Record<HostName, HostModule>>`，各宿主的条目由该宿主的 manifest 功能（F-05-02、F-06-02、F-11-02）加入；构建编排只经注册表取得宿主模块，接口中不出现具体宿主名；`HostInput` 引用的 `BundleRequest` 按入口与打包接口第 1 节定义在 `src/bundle/types.ts`；F-04-06 完成前，构建编排传入的 `bundle` 函数抛出“未实现”错误 | ✅ | `grep` 核对：`src/build/` 不导入 `src/targets/claude-code/` 与具体能力数据模块，`src/targets/` 不导入 `src/build/`，`src/targets/types.ts` 不含宿主名；`test/build/build.test.ts` 以注入的注册表运行编排；`src/build/index.ts` 的 `bundle` 抛出“打包尚未实现（F-04-06）”（代码核对，M1-03 替换） |
| `F-05-01` | `claude-code:subprocess` 的能力数据 | 宿主版本 2.1.296，写明核对日期与出处；取值与 hooks 适配第 4、6、7、8 节一致，工具名见[跨平台对比「工具名差异」](../research/coding-agent-plugin-manifests/cross-platform-comparison.md#工具名差异)；`hookTimeoutSeconds` 为 `null`、`defaultTimeoutSeconds` 为 600；`promptGate` 在 TA-15 实测前为不支持；在登记处加入本目标（M2） | ✅ | `src/capabilities/claude-code-subprocess.ts`：组件均为 `package`；`rewriteInput`、`replaceOutput`、`withholdOutput`、`stopGate` 为 `true`，`promptGate` 为 `false`；失败默认行为均为 `allow`；`hookTimeoutSeconds: null`、`defaultTimeoutSeconds: 600`；工具名 15 项（如 `Bash`、`PowerShell` → `shell`，`Agent` → `subagent`）；TA-09 用例通过 |
| `F-05-02` | 生成 `.claude-plugin/plugin.json` | 由配置生成名称、版本、描述、作者与关键词；宿主选项 `hosts['claude-code']` 可写 `displayName`、`userConfig`、`dependencies` 与 `$schema`；名称不是 kebab-case、以 `claude-`、`anthropic-`、`anthropics-`、`cc-plugin-` 开头或等于 `claude`、`anthropic`、`claude-code`、`claude-mods` 时生成失败，其余保留名由 F-05-09 的宿主校验发现；配置未写 `author` 时生成失败，原因写明 `claude plugin validate --strict` 把缺少 `author` 判为失败 | ✅ | `test/targets/claude-code.test.ts` 3 pass：最小配置的输出逐字比对；宿主选项与可选字段按固定键序写入；`My_Plugin`、以 4 个保留前缀开头的名称、4 个保留名与缺少 `author` 各使目标失败，错误归属 `claude-code:subprocess`；夹具 `no-guard`、`empty` 的手写 `plugin.json` 与生成结果逐字节一致 |
| `F-09-01` | `uapa build` 命令 | 读取当前目录的 `uapa.config.ts`，`--config` 可指定路径，配置中的相对路径以该文件所在目录为基准；按模块接口 §8 调用 `loadConfig` 与 `build`，构建后以 `formatSummary(report, reportPath)` 打印终端摘要 | ✅ | `test/cli/run.test.ts` 的“--config 指定配置文件，相对路径以当前目录为基准”；`test/config/layout.test.ts` 的 `dir` 相对配置文件所在目录；夹具 `no-guard` 以 `process.execPath` 运行 `src/cli/main.ts build` |
| `F-09-02` | 退出码约定 | 按模块接口 §8 的退出码表；退出码只由 `BuildOutcome` 与捕获的异常决定；错误按 §8 的格式写到 stderr，每条一行；退出码的计算以构造的 `BuildOutcome` 与抛出的异常做单元测试，覆盖表中每一行；端到端用例由夹具 `invalid-config`、`usage-error`、`verify-failed`、`requires-missing`、`unknown-override` 承接 | ⚠️ 单元测试覆盖退出码表每一行，端到端只有 `invalid-config`、`usage-error`；`verify-failed`（M1-03）、`requires-missing` 与 `unknown-override`（M1-06）未加入 | `test/cli/run.test.ts` 7 pass：0（全部成功）、1（有目标失败或比对有差异）、2（输入错误、用法错误、`build` 抛出异常）；夹具 `invalid-config`、`usage-error` 以 2 结束，stderr 各一行；缺口见 §7 第 4 行 |
| `F-09-03` | 帮助与版本 | `--help` 列出命令与选项；`--version` 输出包版本；两者输出到 stdout，以退出码 0 结束 | ✅ | §3 第 3、4 行；`test/cli/run.test.ts` 的“--help、--version 输出到 stdout 并以 0 结束” |
| `F-10-02` | 目标比对夹具 | 夹具按本文「夹具」一节的目录格式组织，测试按该节的方式运行并比对；本功能交付夹具运行器、更新命令（写在 `test/fixtures/README.md` 中）与 M2 的夹具；其余夹具按夹具表「加入比对」列在对应里程碑加入，M6 前全部比对通过 | ✅ | `test/fixtures/run.ts`（复制 `source/` 到临时目录，`PATH` 只含空目录，以 `process.execPath` 运行入口）、`test/fixtures/fixtures.test.ts`、`test/fixtures/update.ts`、`test/fixtures/README.md`；M2 的 4 个夹具 4 pass |

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
| `pnpm check` | ✅ 两套 `tsc` 无输出；Biome “Checked 61 files”；`node --test` 49 pass / 0 fail；“✓ 93 个功能，18 条用户故事，18 项技术验收，关系检查通过”；退出码 0 | 无 |
| `node --test test/fixtures/fixtures.test.ts` | ✅ `empty`、`invalid-config`、`no-guard`、`usage-error` 4 pass / 0 fail | 无 |
| `node src/cli/main.ts --help` | ✅ 输出用法、`build` 命令与 `--config`、`--help`、`--version` 三个选项；退出码 0 | 无 |
| `node src/cli/main.ts --version` | ✅ 输出 `0.1.0`；退出码 0 | 无 |
| `node --test "test/**/*.test.ts"`（Node 22） | ✅ Node 22.19.0 与 22.23.2 均为 49 pass / 0 fail | 本机安装对应版本的 Node |

## 4. 交付物

- 构建器源码：`src/config/`（名称、配置类型、导入、校验、插件目录）、`src/source/`（skills 与
  守卫声明）、`src/capabilities/`（能力数据模型、`claude-code:subprocess`、登记处）、
  `src/targets/`（宿主模块接口、登记处、`claude-code` 的 manifest）、`src/bundle/types.ts`、
  `src/build/`（能力检查、生成、写出、报告、编排）、`src/report/`、`src/cli/`；
  `src/runtime/core/types.ts` 补全守卫公共类型；`src/index.ts` 导出配置与守卫类型。
- 测试：`test/config/`、`test/source/`、`test/capabilities/`、`test/targets/`、`test/build/`、
  `test/report/`、`test/cli/`、`test/runtime/` 的单元测试，`test/helpers/project.ts`。
- 夹具：`test/fixtures/` 的运行器、比对测试、更新命令、README 与 `no-guard`、`empty`、
  `invalid-config`、`usage-error`。
- 配置：`tsconfig.json`、`biome.json`、`.gitignore`（见 §5）。

## 5. 与计划的偏差

- 施工单把校验写在 `load.ts`；实现拆为 `import.ts`（导入与错误识别，配置与守卫共用）、
  `validate.ts`（校验）与 `load.ts`（组合二者）。`readSource` 的 skills 读取在 `skills.ts`。
- 硬约束核对第 3 行写 `resolvePluginDirs` 的单元测试；路径规则由 `layout.ts` 的
  `checkPluginDirs` 检查，它基于 `resolvePluginDirs` 的结果，测试经 `validateConfig` 覆盖。
- `.gitignore` 的 `dist/` 改为 `/dist/`：夹具的期望输出树含 `dist/`，需要纳入版本库。
- `tsconfig.json` 增加 `paths: { "uapa": ["./src/index.ts"] }`：夹具配置按插件作者的写法
  `import type { UapaConfig } from 'uapa'`；运行时由类型剥离去掉，`tsc` 解析到源码入口。
- `biome.json` 排除 `test/fixtures/*/expected`：期望输出逐字节比对，不由 Biome 重排。
- 接口文档无改动：模块接口 §1 已规定目标名与宿主标识随能力数据逐步登记，本单只登记
  `claude-code:subprocess` 与 `claude-code`。

## 6. 技术决策

- 导入错误识别（Node 24.20.0 与 22.19.0 实测相同）：不可擦除语法抛出
  `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`，出错文件取 `stack` 第一行的 `<路径>:<行>`；缺 `.ts`
  扩展名抛出 `ERR_MODULE_NOT_FOUND`，`url` 为缺失的模块，补上 `.ts` 后存在时判为缺扩展名，
  导入方取消息中的 “imported from” 之后的路径。
- 源项目根取真实路径：macOS 的临时目录经符号链接解析为 `/private/var/...`，Node 报告的模块
  路径是真实路径；不取真实路径时错误中的相对路径会带 `../`。
- zod 4 以单次解析的 `error` 选项给出中文消息：输入为 `undefined` 时为“缺少必填字段”，
  未知字段逐个键报“未知字段”，其余取 zod 的 `zh-CN` 语言包；路径经 `fieldPath` 转为
  `targets[2]`、`hosts.claude-code.dir` 写法。“`hosts` 中出现未配置目标的宿主”与插件目录规则
  在 zod 解析通过后检查。
- 夹具运行器只给子进程 `PATH`（指向空目录）这一个环境变量，构建结果不依赖本机安装的宿主
  命令行与环境变量。
- 夹具中的 manifest 按验收标准手写，`update.ts` 只核对不覆盖，生成结果与手写文件不一致时
  列出差异并以 1 结束。
- 架构文档回填：无需回填。

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|
| 1 | 只登记了一个宿主：“`hosts` 中出现未配置目标的宿主”“插件目录等于或包含另一宿主的插件目录”“一个宿主失败不影响其他宿主”三个分支已实现，无法构造用例 | `F-01-03`、`F-03-03` 与 §1 第 3 行为部分交付 | M1-04 登记 `agy` 后补单元测试（已写入 M1-04 施工单「测试」节） |
| 2 | `hosts.codex` 的选项未定义：`hooksFile` 为绝对路径或含 `..` 时的校验未实现 | `F-01-03` 部分交付 | M1-05 随 `hosts.codex` 实现并测试（已写入 M1-05 施工单「测试」节） |
| 3 | 每个宿主只有一个目标：“同一插件目录中不适用某 skill 的目标记为残余风险”“同一宿主中失败的目标不进入产物”两个分支已实现，无法构造用例 | `F-03-03`、`F-03-04` 部分交付 | M1-07 登记 `claude-code:in-process` 后补单元测试（已写入 M1-07 施工单「测试」节） |
| 4 | 退出码的端到端夹具 `verify-failed`、`requires-missing`、`unknown-override` 未加入 | `F-09-02` 部分交付 | `verify-failed`：M1-03；`requires-missing`、`unknown-override`：M1-06（两张施工单的任务中已列出） |

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- 命令行的帮助、错误与摘要只有中文；英文输出不在 v0.1.0 范围内。
- 本单的证据都来自夹具与单元测试，没有在宿主中加载产物；Claude Code 的宿主实测从 M1-03
  的 TA-15 开始。
- 下一步：M1-03（Claude Code 命令 hooks 与守卫入口）。
