# 验收 M1-03：守卫端到端（Claude Code 命令 hooks）

> 本文记录 M1-03 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M1-03](../workorders/M1-03-claude-code-command-hooks-guard.md) |
| 覆盖功能点 | `F-03-13`、`F-03-14`、`F-04-01`、`F-04-02`、`F-04-03`、`F-04-04`、`F-04-05`、`F-04-06`、`F-05-03`、`F-05-04`、`F-05-09`（取自总览「工单构成」表） |
| 验收日期 | 2026-10-14 |
| 验收结论 | 有条件通过（F-03-14 的 `--check` 分支待 M1-06 实现比对模式后验证；F-04-06 在 `dist/` 中的入口定位由 M1-08 的 F-10-05 验证，见 §7） |
| 判断范围 | 夹具与单元测试 + 宿主实测 |
| commit | 67d6877 |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | 守卫出错、返回值无效、输入无法解析时执行前检查以退出码 2 拒绝（`test/runtime/subprocess.test.ts`、`test/runtime/claude-code-subprocess.test.ts`、入口用例 `missing-session-id.json`）；能力缺失时目标失败或记降级与残余风险（`test/build/checks.test.ts`）；入口无法启动时宿主放行，构建报告写明（`single-claude` 的 `residualRisks` 三条） |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | 夹具测试的 `checkImports` 解析产物中每个 `.mjs`，`hooks/uapa-claude-code.mjs` 只导入 `node:fs`、`node:path`；`test/bundle/bundle.test.ts` 断言出现其他导入时打包失败 |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | `single-claude`、`verify-failed` 比对整个源项目目录，只多出 `dist/claude-code/` 与 `dist/uapa-report.json`；`--check` 尚未开放（`runBuild` 收到 `check: true` 时抛出“比对模式尚未实现”） |
| V4 | 能力数据含无出处的宿主行为 | 否 | `promptGate`、`hookTimeoutSeconds` 的取值来自 [Claude Code 本地实测记录「命令 hooks」](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#命令-hooks)，出处文件 `claude-code-plugins.md` 的「命令 hooks 的本地实测」一节引用该记录；`test/capabilities/capabilities.test.ts`（TA-09）通过 |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：守卫不静默失效 | F-03-13 的单元测试；入口用例：守卫抛错、返回值无效、缺少会话 id 时执行前检查以退出码 2 拒绝，原因符合 F-04-03、F-04-04 | 守卫抛错时 stderr 为 `uapa: 守卫出错: boom`，返回值无效时为 `uapa: 守卫返回值无效`，缺少 `session_id` 时为 `uapa: 无法解析宿主输入: session_id`，退出码均为 2；F-03-13 的 4 个能力组合用例通过 | `test/runtime/subprocess.test.ts`（9 个用例）、`test/runtime/claude-code-subprocess.test.ts`（7 个）、入口用例 `single-claude/.../missing-session-id.json`、`test/build/checks.test.ts` | ✅ |
| 2 | 硬约束：产物零依赖 | 打包后的入口只含 `node:` 导入（TA-01 的解析检查）；`external` 为 `'node'` 时出现其他导入则打包失败的单元测试 | 入口只导入 `node:fs`、`node:path`；守卫导入 `left-pad` 与 `fs` 时报 `打包结果含不允许的外部导入：fs、left-pad（只允许 node: 内置模块）` | `test/fixtures/fixtures.test.ts` 的 `checkImports`；`test/bundle/bundle.test.ts`（4 个用例） | ✅ |
| 3 | 硬约束：不在运行时推断宿主 | `claude-code-subprocess.ts` 只读 `CLAUDE_PLUGIN_DATA` 与去重变量；单元测试在设置 `PLUGIN_DATA` 时输出不变 | 设置 `PLUGIN_DATA` 时停机前与执行前检查的输出与未设置时逐字一致，`PLUGIN_DATA` 指向的目录为空；源码中只出现 `CLAUDE_PLUGIN_DATA` 与 `__UAPA_MODULE_SESSION_ENV__` 两处环境变量读取 | `test/runtime/claude-code-subprocess.test.ts`「只读取 CLAUDE_PLUGIN_DATA」 | ✅ |
| 4 | 硬约束：确定性输出 | `single-claude` 夹具逐字节比对，含打包后的 `.mjs` | `single-claude` 的 8 个文件逐字节一致，含 `hooks/uapa-claude-code.mjs`；两个不同位置的守卫打包结果相同且不含本机路径 | `test/fixtures/fixtures.test.ts`；`test/bundle/bundle.test.ts`「打包结果为单文件……与源文件位置无关」 | ✅ |
| 5 | 硬约束：不越权写入 | 停机计数只写入 `dataDir` 下的 `uapa-stop-<会话 id>.json`；会话 id `x/../y` 的用例（TA-16） | 数据目录中只有 `uapa-stop-a.json`、`uapa-stop-b.json`、`uapa-stop-x%2F..%2Fy.json` | `test/runtime/stop-state.test.ts`；`test/runtime/subprocess.test.ts`「停机计数按会话保存」 | ✅ |
| 6 | 硬约束：能力数据有出处 | TA-15 结论写入调研文档后再改能力数据，数据模块的出处与核对日期随之更新 | 结论写入 Claude Code 本地实测记录「命令 hooks」与 `claude-code-plugins.md`「命令 hooks 的本地实测」；能力数据 `checked` 改为 `2026-10-14`，注释注明 TA-15 | `src/capabilities/claude-code-subprocess.ts`；宿主实测（Claude Code 2.1.296） | ✅ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-03-13` | 构建时检查守卫能力 | 配置了守卫时，`requires` 中有目标缺失的能力（v0.1.0 只可能是 `rewriteInput`、`stopGate`、`promptGate`）则该目标失败；未列入 `requires` 的缺失能力：`rewriteInput` 在守卫实现了 `beforeTool` 时记为降级（`rewrite` 按 `fallbackReason` 拒绝），`stopGate`、`promptGate` 不生成对应 hook 并记为残余风险（hooks 适配第 6 节）；检查全部被省略时（未配置守卫的情况见 F-03-03），按模块接口 §5 不生成该目标的 hooks 配置与入口 | ✅ | `test/build/checks.test.ts` 4 个用例：`requires` 缺能力时目标失败且不调用宿主模块；缺 `rewriteInput` 记降级，缺 `promptGate`、`stopGate` 省略检查并按序写残余风险；全部能力具备时不记降级；检查全部省略时 `TargetPlan.checks` 为空、不生成 hooks 配置与入口（`test/targets/claude-code-hooks.test.ts`「checks 为空」） |
| `F-03-14` | 写出后调用宿主校验 | 写出后，对本次写出了文件且实现了 `verify` 的宿主模块，以其插件目录的绝对路径调用一次；`failed` 或 `verify` 抛错时该宿主的目标全部失败，抛错时错误为异常消息，已写出的文件保留；结果写入各目标报告的 `hostValidation`，未调用 `verify` 时为 `none`；`--check` 模式不调用 | ⚠️ 仅 `--check` 分支未验证 | `test/build/checks.test.ts` 3 个用例：以插件目录绝对路径调用一次、结果写入 `hostValidation`；`failed` 与抛错时目标失败、文件保留、错误为异常消息；未写出文件时不调用、为 `none`。夹具 `verify-failed`：退出码 1，报告 `hostValidation` 为 `failed`。`--check` 尚未开放，见 §7 第 1 行 |
| `F-04-01` | 工具名换算 | 换算函数以 `ToolNameMap`（宿主工具名到规范名，类型见 F-02-01）为参数，不引用 `src/capabilities/`；未映射的工具以 `host:<原名>` 传入；规范名为 `shell` 时入参换算为 `{ command }`，命令文本缺失时按输入无法解析处理（入口与打包接口第 3 节） | ✅ | `test/runtime/tools.test.ts` 3 个用例；`src/runtime/core/tools.ts` 不引用 `src/capabilities/`（`tsc -p tsconfig.runtime-core.json` 通过）；`test/runtime/subprocess.test.ts` 中 `NotebookEdit` 以 `host:NotebookEdit` 传入 |
| `F-04-02` | 入参改写的反向换算与降级 | `rewrite` 只对 `shell` 生效：由宿主实现的 `rewriteShell` 复制原始入参并只替换命令字段；对其他工具返回 `rewrite`，或 `TargetRuntimeData.capabilities.rewriteInput` 为 `false` 时，按 `fallbackReason` 拒绝，不放行原始入参 | ✅ | `test/runtime/tools.test.ts`「rewrite 只对 shell……」；`test/runtime/subprocess.test.ts`：目标不能改写时按 `fallbackReason` 拒绝；入口用例 `rewrite.json`：`updatedInput` 保留 `description`、只换 `command` |
| `F-04-03` | 读取宿主输入 | 检查名由命令行第一个参数传入（`before-tool`、`before-prompt`、`before-stop`）；参数缺失或不是这三个值时，不读取 stdin，以退出码 1 结束并在 stderr 写原因；从 stdin 读取 JSON，经宿主实现的 `parse` 取出会话 id、工具名与入参，公共部分不含宿主字段名；输入无法解析时，执行前与提示提交前检查按拒绝输出，原因为 `uapa: 无法解析宿主输入: <缺失或类型不符的字段>`，停机前检查不阻止结束并在 stderr 写同一原因；宿主实现了 `skip` 且返回 `true`，或守卫未实现该检查时按放行结束，不调用守卫 | ✅ | `test/runtime/subprocess.test.ts`：检查名缺失或无效时退出码 1 且不读取 stdin（stdin 保持打开，10 秒内结束）；字段缺失时的原因；`skip` 与守卫未实现检查时放行；`test/runtime/claude-code-subprocess.test.ts` 的宿主字段路径 `session_id`、`tool_name`、`tool_input`、`tool.command`、`prompt` |
| `F-04-04` | 异常收口 | 守卫逻辑抛错时原因为 `uapa: 守卫出错: <错误消息>`，返回值形状不符或原因为空白时为 `uapa: 守卫返回值无效`；执行前与提示提交前检查以该原因调用宿主实现的 `deny`；停机前检查不阻止结束，并在 stderr 写该原因；检查函数位于 `src/runtime/core/decisions.ts`（入口与打包接口第 4 节），两种形态的入口共用 | ✅ | `test/runtime/decisions.test.ts` 4 个用例覆盖三个检查函数的每个失败分支；`test/runtime/subprocess.test.ts`：执行前与提示提交前检查拒绝，停机前检查放行并在 stderr 写原因 |
| `F-04-05` | 按会话保存停机门禁计数 | `beforeStop` 返回 `continue` 时计数加 1，返回 `stop` 时清零；计数文件为宿主实现的 `dataDir` 所返回目录下的 `uapa-stop-<encodeURIComponent(会话 id)>.json`，内容为 `{"continuations":<n>}` 加换行，先写临时文件再重命名；`dataDir` 为 `null` 或目录不可写时 `continuations` 按 0 传入，并在 stderr 写原因；目录不存在时先递归创建（agy 的目录位于系统临时目录，见 SD-06） | ✅ | `test/runtime/subprocess.test.ts`：计数序列、目录递归创建、数据目录为 `null`、不可写、计数文件无效时按 0 计并写原因；`test/runtime/stop-state.test.ts`（TA-16）：会话 a 的输出为继续、继续、结束、继续，计数 1、2、0、1，会话 b 为 1。宿主实测：真实会话中继续两次后结束，计数文件为 `{"continuations":0}`（宿主实测） |
| `F-04-06` | 打包入口 | `bundle` 按入口与打包接口第 1 节把守卫逻辑（`uapa:guard`）、目标数据（`uapa:target-data`）、`runtime/core` 与请求的入口打包为 ES2022 ESM 单文件，替换 `__UAPA_PLUGIN_NAME__`、`__UAPA_MODULE_SESSION_ENV__`；`external` 为 `'node'` 时只保留 `node:` 内置模块，出现其他外部导入时打包失败；按 `import.meta.url` 相对自身定位入口，定位方式对源码目录与 `dist/` 目录结构都成立；入口源码用到的打包时名称在 `src/runtime/entries/bundle-names.d.ts` 中声明 | ⚠️ 仅源码目录的入口定位已验证 | `test/bundle/bundle.test.ts` 4 个用例：入口名定位到 `src/runtime/entries/*.ts`；单文件、只含 `node:` 导入、不含 `//#region` 与本机路径；打包时名称被替换，`moduleSessionEnv` 为 `null` 时不保留去重分支；不允许的外部导入使打包失败。`dist/` 中的定位见 §7 第 2 行 |
| `F-05-03` | 生成命令 hooks 配置 | `hooks/hooks.json` 的 `hooks` 键按 `TargetPlan.checks` 生成条目：`beforeTool` → `PreToolUse`，`beforePrompt` → `UserPromptSubmit`，`beforeStop` → `Stop`；不写 matcher；命令为 `node "${CLAUDE_PLUGIN_ROOT}/hooks/uapa-claude-code.mjs" <检查名>`；每个条目写 `timeout`，取能力数据的 `hookTimeoutSeconds`（秒） | ✅ | `test/targets/claude-code-hooks.test.ts`：三个事件、不写 matcher、`timeout` 为 30，`hookTimeoutSeconds` 为 `null` 时不写；夹具 `single-claude` 的 `hooks/hooks.json` 手写期望逐字节一致；宿主实测：`claude plugin validate --strict` 通过，真实会话中三个事件的入口都被调用（宿主实测） |
| `F-05-04` | 子进程入口的决策输出 | `generate` 以 `input.bundle`（`entry: 'claude-code-subprocess'`、`external: 'node'`）打包入口并输出为 `hooks/uapa-claude-code.mjs`。`claude-code-subprocess.ts` 实现 `SubprocessProtocol`：会话 id 取 stdin `session_id`，工具名取 `tool_name`；拒绝以退出码 2 结束并在 stderr 写原因；改写输出 `hookSpecificOutput.updatedInput`；停机继续输出 `decision: "block"` 与 `reason`；数据目录取 `CLAUDE_PLUGIN_DATA`；工具入参与提示文本的字段名、改写输出是否另需 `permissionDecision` 等字段、提示阻断的写法取自 TA-15 入口前提的结论，写在协议实现中并注明出处：工具入参取 `tool_input`，shell 命令取 `tool_input.command`，提示文本取 `prompt`；改写只写 `hookEventName` 与 `updatedInput`，`updatedInput` 为原入参换入新命令后的完整对象；提示阻断以退出码 2 结束并在 stderr 写原因 | ✅ | `test/runtime/claude-code-subprocess.test.ts` 7 个用例；入口用例 `allow`、`deny`、`rewrite`、`missing-session-id`、`prompt-block`；宿主实测：`echo uapa-deny-probe` 被拒绝，模型收到 `拒绝标记命令 uapa-deny-probe`；`echo uapa-rewrite-probe hello` 的输出为 `uapa-rewritten hello`；含 `API_KEY=` 的提示被拦下且不调用模型；停机继续生效（宿主实测，Claude Code 2.1.296） |
| `F-05-09` | 调用宿主校验命令 | 宿主模块实现 `verify`：运行 `claude plugin validate --strict <插件目录>`，退出码 0 为 `passed`，非零为 `failed` 并带命令输出；PATH 中没有 `claude` 时为 `skipped`；调用时机与失败处理见 F-03-14 | ✅ | `test/targets/claude-code-hooks.test.ts`：PATH 中没有 `claude` 为 `skipped`，退出码 0 为 `passed`，非零为 `failed` 且输出中的插件目录换为 `<插件目录>`；夹具 `verify-failed` 以 PATH 中的假 `claude` 得到 `failed`；宿主实测：真实 `claude plugin validate --strict` 对 `single-claude` 产物通过（宿主实测） |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
pnpm check
node --test test/fixtures/fixtures.test.ts test/runtime/stop-state.test.ts
claude plugin validate --strict <single-claude 的产物目录>
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `pnpm check` | ✅ 两次 `tsc` 通过；Biome 检查 92 个文件无问题；92 pass / 0 fail；功能清单关系检查通过（93 个功能） | 无 |
| `node --test test/fixtures/fixtures.test.ts test/runtime/stop-state.test.ts` | ✅ 7 pass / 0 fail（6 个夹具，含 `single-claude` 的 5 个入口用例；TA-16 1 个） | 无 |
| `claude plugin validate --strict <single-claude 的产物目录>` | ✅ `Validation passed`，退出码 0 | 宿主实测：本机 Claude Code 2.1.296 |

另在临时目录中以 `claude -p --model haiku --plugin-dir <single-claude 的产物目录>` 运行真实会话
（宿主实测，Claude Code 2.1.296），提示只要求运行标记命令：

| 场景 | 结果 |
|---|---|
| 提示含 `API_KEY=` | 输出 `UserPromptSubmit operation blocked by hook:` 与 `提示中含疑似密钥`，不调用模型 |
| `echo uapa-deny-probe` | 工具结果为 `PreToolUse:Bash hook error: [...]: 拒绝标记命令 uapa-deny-probe` |
| `echo uapa-rewrite-probe hello` | 工具输出为 `uapa-rewritten hello` |
| 回答结束 | 宿主两次收到 `{"decision":"block","reason":"请先运行测试再结束"}` 并继续，第三次结束；计数文件为 `{"continuations":0}` |

## 4. 交付物

- 守卫运行时：`src/runtime/core/tools.ts`、`src/runtime/core/decisions.ts`、
  `src/runtime/entries/subprocess.ts`、`src/runtime/entries/bundle-names.d.ts`。
- 打包：`src/bundle/index.ts`；构建编排接入 `bundle`，`src/build/index.ts` 中的占位实现删除。
- 构建编排：`src/build/plan.ts`（能力检查）、`src/build/report.ts`（省略检查的残余风险）、
  `src/build/verify.ts`（宿主校验）、`src/build/state.ts`（`omitted`）。
- Claude Code：`src/targets/claude-code/hooks.ts`、`src/targets/claude-code/verify.ts`、
  `src/runtime/entries/claude-code-subprocess.ts`；`src/capabilities/claude-code-subprocess.ts`
  的 `promptGate` 为 `true`、`hookTimeoutSeconds` 为 30。
- 夹具 `single-claude`（5 个入口用例）与 `verify-failed`；夹具运行器支持 `path/` 与入口用例。
  M1-02 验收 §7 第 4 行中 `verify-failed` 一项由本单交付。
- 测试：`test/runtime/` 7 个文件、`test/bundle/bundle.test.ts`、`test/build/checks.test.ts`、
  `test/targets/claude-code-hooks.test.ts`，及 `test/helpers/` 的 `build.ts`、`entry.ts`、`imports.ts`。
- 文档：TA-15 结论写入 Claude Code 本地实测记录「命令 hooks」「实测会话的工具权限」与
  `claude-code-plugins.md`「命令 hooks 的本地实测」；同步 hooks 适配第 3、4、7 节，命令 hooks
  声明第 2 节，F-05-01、F-05-03、F-05-04、F-05-15，SD-03、SD-22、SD-23，TA-15，P-01。

## 5. 与计划的偏差

- M1-02 夹具的期望产物有变化（施工单「边界」禁止修改）：`no-guard`、`empty` 的构建报告中
  `hostValidation` 由 `none` 变为 `skipped`（F-03-14 写出后调用 `verify`，夹具的 PATH 中没有
  `claude`），`host.checked` 由 `2026-10-13` 变为 `2026-10-14`（TA-15 结论更新了能力数据）。
  依据 TA-15 的验收标准：结论改变产物时，在同一提交中更新期望产物。
- 修改范围超出施工单「边界」列出的 F-05-01 与命令 hooks 声明第 2 节：TA-15 结论同时改变了
  F-05-03（写出 `timeout`）、F-05-04（字段名与输出写法）、F-05-15（`SessionEnd`）与 SD-03、
  SD-22、SD-23、TA-15、P-01 的状态描述，按 TA-15 的验收标准一并更新。
- 超时：F-05-01 原写 `hookTimeoutSeconds` 为 `null`。实测确认字段名后，按 hooks 适配第 7 节
  “字段名已核实的目标写 30 秒”改为 30，`single-claude` 不再有“未写超时”的残余风险。
- 夹具 `single-claude` 的插件名为 `single-guard`：名称中以 `-` 分隔的段为 `claude` 时
  `claude plugin validate --strict` 失败（2.1.296 本地实测，已写入调研文档）。夹具目录名不变。
- 夹具守卫的拒绝与改写只匹配标记命令（`uapa-deny-probe`、`echo uapa-rewrite-probe`），依据
  仓库的测试安全约定。
- 入口用例另加 `prompt-block.json`，施工单只要求执行前事件的四例。

## 6. 技术决策

| 决策 | 依据 | 回填 |
|---|---|---|
| 改写只输出 `hookSpecificOutput.hookEventName` 与 `updatedInput`，不写 `permissionDecision`；`updatedInput` 为原入参换入新命令后的完整对象 | TA-15：两种写法都生效，`updatedInput` 整体替换入参 | hooks 适配第 4 节、F-05-04 已回填 |
| 提示阻断以退出码 2 与 stderr 输出，与执行前检查共用 `deny` | TA-15：退出码 2 与 `decision: "block"` 都能拦下提示 | hooks 适配第 4 节已回填 |
| 命令 hooks 条目写 `timeout: 30` | TA-15：`timeout` 以秒为单位生效；hooks 适配第 7 节 | F-05-01、F-05-03、hooks 适配第 7 节已回填 |
| `dataDir` 为空字符串时按 `null` 处理 | 空路径会把计数写到工作目录 | 无需回填 |
| rolldown 以 `experimental.attachDebugInfo: 'none'` 去掉 `//#region` 注释 | 注释含源文件的本机路径，破坏确定性输出 | 无需回填（实现细节） |

架构与接口文档中不再有本单定下而仍写“未核实”的项（以 `grep` 核对 `docs/architecture/`）。

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|
| 1 | 比对模式尚未实现，F-03-14 “`--check` 模式不调用 `verify`”无法构造用例 | `F-03-14` 部分交付 | M1-06 实现 F-03-08 时补单元测试（已写入 M1-06 施工单「测试」节） |
| 2 | 入口只在源码目录中验证了定位，`dist/` 中按 `import.meta.url` 定位编译后入口未验证 | `F-04-06` 部分交付 | M1-08 的 F-10-05 安装冒烟从 `dist/` 打包入口（M1-08 施工单「关键落地约束」已列出） |

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- 宿主实测只覆盖 Claude Code 2.1.296 与 macOS；宿主升级后需重跑 TA-15 中 Claude Code 的各项。
- 不带 `--permission-mode default` 的实测会话中，`--allowedTools` 不限制命令（见本地实测记录
  「实测会话的工具权限」）；后续实测同时写两个参数。
- 下一步：M1-04（agy 目标）。
