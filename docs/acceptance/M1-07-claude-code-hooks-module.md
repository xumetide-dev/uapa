# 验收 M1-07：Claude Code hooks 模块与四目标夹具

> 本文记录 M1-07 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M1-07](../workorders/M1-07-claude-code-hooks-module.md) |
| 覆盖功能点 | `F-04-07`、`F-05-05`、`F-05-06`、`F-05-07`、`F-05-08`、`F-05-10`、`F-05-14`（取自总览「工单构成」表） |
| 验收日期 | 2026-10-14 |
| 验收结论 | 有条件通过（TA-11 的嵌套会话与 `/clear` 之后的去重、TA-12 的 `claude plugin test` 待维护者宿主实测，见 §7） |
| 判断范围 | 夹具与单元测试 + 宿主实测 |
| commit | `41c4375` |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | `test/runtime/in-process.test.ts`：守卫抛错、返回值无效与 Bash 缺少 `command` 时 `tool.call` 返回 `{ deny }`，`.catch` 在 `next.called` 为假时返回 `{ deny }`、`{ drop }`；Claude Code 2.1.287 之前不加载 hooks 模块的情况记入残余风险（`test/targets/claude-code-module.test.ts`、`in-process-only` 夹具的报告） |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | `fixtures.test.ts` 的导入检查：各夹具的 `hooks/uapa-guard.mjs` 只导入 `'claude-code'`，`hooks/register.ts` 只导入 `./uapa-guard.mjs`，子进程入口只导入 `node:` 模块；`claude plugin validate --strict` 对 7 个含 Claude Code 目标的夹具产物通过（宿主实测） |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | `test/fixtures/four-targets.test.ts`：`merged` 的预置文件逐字节不变，`merged-conflict` 的源项目根目录只有源文件；`full`、`merged` 每次 `--check` 前后的目录快照一致 |
| V4 | 能力数据含无出处的宿主行为 | 否 | `src/capabilities/claude-code-in-process.ts` 的 `source` 为 `claude-code-mods-guide.md`，各取值注明依据（Mods 指南「常用事件与返回值」「失败处理与 `.catch`」）；`capabilities.test.ts` 核对出处文件存在 |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：守卫不静默失效 | TA-17：守卫抛错且未调用 `next` 时 `.catch` 返回 `{ deny }`、`{ drop }`；`classic.Stop` 不阻止结束 | `.catch` 在 `next.called` 为假时返回 `{ deny: 'uapa: hooks 模块出错' }`、`{ drop: 'uapa: hooks 模块出错' }`，为真时重放 `next`；守卫抛错时 `tool.call` 返回 `{ deny: 'uapa: 守卫出错: boom' }`，`prompt.submit` 返回 `{ drop: … }`，`classic.Stop` 调用 `next` 且计数不变 | `test/runtime/in-process.test.ts` 8 pass / 0 fail | ✅ |
| 2 | 硬约束：产物零依赖 | `hooks/uapa-guard.mjs` 只导入 `'claude-code'`，`hooks/register.ts` 只导入 `./uapa-guard.mjs`（TA-01） | 含 hooks 模块的 5 个夹具产物（`in-process-only`、`claude-both`、`full`、`merged`、`command-hooks`）的导入检查全部通过；`register.ts` 的 `import type` 不计入运行时导入 | `fixtures.test.ts` 16 pass / 0 fail；`bundle.test.ts` 中守卫导入 `node:fs` 时 `'claude-code'` 形态打包失败 | ✅ |
| 3 | 硬约束：不在运行时推断宿主 | 去重只比较 `UAPA_MODULE_SESSION_<插件名>` 与 stdin 的 `session_id` | `claude-both` 的入口用例：变量等于 `session_id` 时退出码 0、无输出；变量为另一会话 id 时照常拒绝（退出码 2）；`full` 的 15 个子进程入口用例在另设其他宿主变量后输出逐字一致 | `fixtures.test.ts`；`host-inference.test.ts` 2 pass（TA-05，`full` 与 `throwing-guard`） | ✅ |
| 4 | 硬约束：确定性输出 | `in-process-only`、`claude-both` 与四目标夹具逐字节比对；TA-06 | 7 个新夹具与期望产物逐字节一致；`full`、`merged` 在两个不同的绝对路径下构建，产物与报告逐字节一致，不含构建路径、临时目录、主目录与 ISO 时间 | `fixtures.test.ts`；`four-targets.test.ts` 的 TA-06 用例 2 pass | ✅ |
| 5 | 硬约束：不越权写入 | TA-07、TA-08 的夹具部分 | `merged` 的 `notes.txt` 不变；`merged-conflict` 退出码 1，三个目标的 stderr 列出 `hooks/hooks.json`、写入它的宿主与 `hooksFile` 提示，根目录不写入；`full` 修改产物后 `--check` 以 1 结束，stdout 依次为 `added dist/agy/plugin.json`、`removed dist/claude-code/extra.txt`、`modified dist/codex/.codex-plugin/plugin.json`；`merged` 根目录的新文件不产生差异 | `four-targets.test.ts` 的 TA-07、TA-08 用例 3 pass | ✅ |
| 6 | 硬约束：能力数据有出处 | `claude-code-in-process.ts` 写 2.1.296、核对日期与 Mods 指南出处 | 版本 2.1.296、核对日期 2026-10-14、出处 `claude-code-mods-guide.md` | `capabilities.test.ts` 4 pass | ✅ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-04-07` | hooks 模块形态的打包 | `external` 为 `'claude-code'` 时，打包结果只导入 `'claude-code'`，出现 `node:` 或其他外部导入时打包失败 | ✅ | `bundle.test.ts`：守卫经本地模块导入 `node:fs` 时 `external: 'claude-code'` 打包失败，错误写明“只允许 'claude-code'”；夹具产物的导入检查（§1 第 2 行） |
| `F-05-05` | 生成 hooks 模块入口 | `generate` 以 `input.bundle`（`entry: 'claude-code-in-process'`、`external: 'claude-code'`）打包并输出为 `hooks/uapa-guard.mjs`。`src/runtime/entries/claude-code-in-process.ts` 导出 `register`，只为 `TargetPlan.checks` 中的检查（打包请求的 `checks`，入口与打包接口第 1 节）在 `tool.call`、`prompt.submit` 与 `classic.Stop` 上注册处理函数并调用守卫：`sessionId` 取 `await $.session.id()`；`tool.call` 的工具名取 `e.tool`，入参为 `e` 去掉 `tool`、`tool_use_id` 后的字段；`allow` 调用 `next(e)`，`deny` 返回 `{ deny: reason }`；`rewrite` 只在 `e.tool` 为 `Bash` 时以 `next({ ...e, command })` 写回，其他工具按 `fallbackReason` 返回 `{ deny }`（Mods 指南只记载了 `Bash` 的 `e.command`）；`prompt.submit` 的提示文本取 `e.text`，`block` 返回 `{ drop: reason }`；`classic.Stop` 的 `continue` 返回 `{ block: reason }`，`stop` 调用 `next(e)`（Mods 指南「常用事件与返回值」）。`'claude-code'` 的类型在 `src/runtime/entries/claude-code-api.d.ts` 中手写（入口与打包接口第 1 节）。生成的 `hooks/register.ts` 以 `import` 声明引入 `./uapa-guard.mjs`，以 const 函数导出 `register` 并在其中调用守卫文件的 `register`（`validate` 不跟踪转导出的 `register`）；`hooks/hooks.json` 写入 `"modules": ["./register.ts"]`（路径相对该文件） | ✅ | `claude-code-module.test.ts` 核对打包请求（`entry`、`external`、`checks`）、`hooks/register.ts` 全文与 `"modules": ["./register.ts"]`；TA-17 核对 `tool.call` 的放行、拒绝、`Bash` 改写与 `PowerShell` 改写按 `fallbackReason` 拒绝，`prompt.submit` 的阻断，`classic.Stop` 的继续与结束；`validate --strict` 列出 `register.ts` 注册的事件（宿主实测，[静态校验](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#hooks-模块的静态校验)） |
| `F-05-06` | hooks 模块的异常收口 | `claude-code-in-process.ts` 以入口与打包接口第 4 节的检查函数校验守卫返回值。守卫抛错或返回值无效时：执行前检查返回 `{ deny: <原因> }`，提示提交前检查返回 `{ drop: <原因> }`，停机前检查调用 `next(e)`，不阻止结束；原因与 F-04-04 相同。执行前与提示提交前检查另写 `.catch`，未调用 `next` 前出错不放行 | ✅ | TA-17 的异常收口用例：抛错为 `uapa: 守卫出错: boom`，无效返回值为 `uapa: 守卫返回值无效`；`.catch` 用例；`validate` 输出 `gating hook with .catch: tool.call`、`prompt.submit`（宿主实测） |
| `F-05-07` | 生成状态类型契约 | 只在 `claude-code:in-process` 进入 `plans` 且其 `TargetPlan.checks` 含 `beforeStop` 时生成，否则不生成 `types/index.d.ts`，`plugin.json` 也不写 `types` 字段。停机门禁计数存于 `$.state`，引用为 `{ plugin: __UAPA_PLUGIN_NAME__, key: 'uapaStopContinuations' }`，值为 `number`；生成 `types/index.d.ts`，只在 `declare module 'claude-code'` 的 `interface PluginState` 中声明 `'<配置 name>': { uapaStopContinuations: number }`；在 `plugin.json` 写 `types` 字段；`claude plugin validate` 能核对状态键 | ✅ | `claude-code-module.test.ts`：计划 `beforeStop` 时生成 `types/index.d.ts` 全文并把 `types` 写在 `plugin.json` 末尾；`in-process-only` 不生成契约、守卫文件不含 `atom(`；`validate --strict` 输出 `declares state: <插件名>.uapaStopContinuations` 与同名的 `state reads`、`state writes`（宿主实测） |
| `F-05-08` | 按会话 id 去重 | 两个 Claude Code 目标都进入 `plans` 时，宿主模块把两个入口的 `TargetRuntimeData.moduleSessionEnv` 设为 `UAPA_MODULE_SESSION_<插件名>`（配置 `name` 转大写，`-` 换为 `_`），否则为 `null`；hooks 模块在 `session.start` 与 `classic.SessionStart`（`source` 为 `clear`、`resume`、`fork`）以 `__UAPA_MODULE_SESSION_ENV__` 为变量名写入会话 id；命令入口经 `skip` 比对该变量与 stdin 的 `session_id`，相等时以退出码 0 结束；不只判断变量是否存在；为 `null` 时不读写该变量，打包后的守卫文件中不出现 `$.env.set` 调用（入口与打包接口第 1 节） | ✅ | `claude-code-module.test.ts`：两个目标时两个打包请求的 `moduleSessionEnv` 为 `UAPA_MODULE_SESSION_DEMO_PLUGIN`，只有一个目标时为 `null`；`claude-both` 的两个入口用例；`hooks-module.test.ts`：`in-process-only` 守卫文件不含 `$.env.set`，`claude-both` 含两次以字面量为参数的调用；TA-17 核对两个会话事件写入的变量名与值；容器中以 `claude -p` 加载 `claude-both` 产物，停机门禁生效而插件数据目录中没有命令入口的计数文件（宿主实测，[会话实测](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#双形态去重的会话实测)） |
| `F-05-10` | 两种形态合为一个插件包 | 同时配置两个目标时写入同一目录：`hooks/hooks.json` 同时含 `hooks` 与 `modules` 键，`plugin.json` 只生成一份；只配置其中一个目标，或其中一个目标未通过能力检查时，只含对应的键；插件包中只有 `claude-code:in-process` 的 hooks 时（只配置了该目标，或 `claude-code:subprocess` 未通过能力检查），残余风险写明 Claude Code 2.1.287 之前的版本不加载 hooks 模块，守卫不生效 | ✅ | `claude-code-module.test.ts`：两个目标时一份 `plugin.json`、`hooks` 键在 `modules` 键之前；只有 `claude-code:in-process` 时只含 `modules` 并记残余风险，只有 `claude-code:subprocess` 时只含 `hooks`；`layout.test.ts`：`claude-code:in-process` 未通过能力检查时插件目录只有 `claude-code:subprocess` 的文件；`in-process-only`、`claude-both`、`full` 夹具 |
| `F-05-14` | `claude-code:in-process` 的能力数据 | 宿主版本 2.1.296，写明核对日期与出处；取值与 hooks 适配第 4、6、8 节一致，工具名见[跨平台对比「工具名差异」](../research/coding-agent-plugin-manifests/cross-platform-comparison.md#工具名差异)；`promptGate` 为支持；`hookTimeoutSeconds` 与 `defaultTimeoutSeconds` 为 `null`；`failureDefault` 全部为 `{ error: 'allow', timeout: 'allow' }`，依据 Mods 指南「失败处理与 `.catch`」（钩子抛错或超出预算时被跳过），入口的收口见 F-05-06；在登记处加入本目标（M5） | ✅ | `capabilities.test.ts` 的 `claude-code:in-process` 用例：版本、出处、`promptGate`、两个超时为 `null`、`failureDefault` 全部放行、工具名与 `claude-code:subprocess` 相同、`commandHookEvents` 全部为 `null`；`command-hooks.test.ts` 的同宿主两目标用例 |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
pnpm check
node --test test/fixtures/fixtures.test.ts test/runtime/in-process.test.ts
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `pnpm check` | 通过：两次 `tsc` 无错误，Biome 检查 162 个文件无问题，`node --test` 193 pass / 0 fail，功能清单检查“93 个功能，18 条用户故事，18 项技术验收，关系检查通过” | 以 `test/container/run.sh check` 在容器中运行 |
| `node --test test/fixtures/fixtures.test.ts test/runtime/in-process.test.ts` | 24 pass / 0 fail（16 个夹具，含新增的 7 个；TA-17 的 8 个用例） | 以 `test/container/run.sh exec` 在容器中运行 |
| `claude plugin validate --strict <插件目录>`（TA-12 的一部分） | 通过：`in-process-only`、`claude-both`、`full`、`command-hooks`、`targets-filter`、`single-claude` 的 `dist/claude-code` 与 `merged` 的源项目根目录，共 7 个 | 宿主实测：`test/container/run.sh shell` 中的 Claude Code 2.1.296（Linux） |
| `claude -p … --plugin-dir <claude-both 产物> --permission-mode default --allowedTools Read`（TA-11 的一部分） | 停机门禁生效（`num_turns` 为 7），插件数据目录中没有命令入口的停机计数文件；对照的 `single-claude` 产物写出计数文件 | 宿主实测：同上，需 `claude setup-token` 的令牌 |

## 4. 交付物

- 能力数据：`src/capabilities/claude-code-in-process.ts`，登记于 `src/config/targets.ts` 与
  `src/capabilities/index.ts`。
- hooks 模块入口：`src/runtime/entries/claude-code-in-process.ts`，手写类型
  `src/runtime/entries/claude-code-api.d.ts`；`tsconfig.runtime-core.json` 包含二者与
  `bundle-names.d.ts`。
- 打包：`src/bundle/types.ts` 的 `BundleRequest` 改为按 `external` 区分的联合类型，`'claude-code'`
  形态带 `checks`；`src/bundle/index.ts` 替换 `__UAPA_CHECKS__.<检查名>`，打包结果残留打包时名称时
  失败。
- Claude Code 宿主模块：`src/targets/claude-code/module.ts`（`hooks/register.ts`、
  `hooks/uapa-guard.mjs`、`types/index.d.ts`、去重变量名），`index.ts` 合包与残余风险，
  `manifest.ts` 的 `types` 字段。
- 夹具：`in-process-only`、`claude-both`、`full`、`merged`、`merged-conflict`、`targets-filter`、
  `command-hooks`。
- 测试：`test/runtime/in-process.test.ts`（TA-17）与桩 `test/runtime/stubs/claude-code.ts`、
  `test/targets/claude-code-module.test.ts`、`test/fixtures/four-targets.test.ts`（TA-06～TA-08）、
  `test/fixtures/hooks-module.test.ts`；`stop-state.test.ts`（TA-16）与 `host-inference.test.ts`
  （TA-05）加入 `full`；`fixtures.test.ts` 的导入检查覆盖 `register.ts`；`command-hooks.test.ts`、
  `layout.test.ts`、`bundle.test.ts`、`capabilities.test.ts` 各加一个用例。
- 文档：入口与打包接口第 1 节；F-05-05、F-05-08、TA-18 的文本；Claude Code 本地实测记录新增
  「hooks 模块的静态校验」「双形态去重的会话实测」两节；Mods 指南与 hooks 适配 §5 的对应说明。

## 5. 与计划的偏差

- 修改了施工单边界之外的文件：`src/bundle/`（任务 1 列出）、`src/runtime/entries/bundle-names.d.ts`、
  `src/config/targets.ts` 与 `src/capabilities/index.ts`（F-05-14 要求登记）、`tsconfig.json`
  （排除 `test/fixtures/*/expected`：期望产物中的 `register.ts` 与 `types/index.d.ts` 面向 Claude
  Code 生成的类型，主配置无法检查）。其他宿主模块未改动。
- 打包接口增加 `checks`：`validate` 对产物中未在类型契约中声明的 `atom` 报错（即使不读写），而
  F-05-07 规定未计划停机前检查时不生成契约，因此未计划的检查须在打包时移除。入口按 `checks` 注册
  处理函数，与 F-05-05 的“按 `TargetPlan.checks`”一致；F-05-05 文本补写这一点。
- `hooks/register.ts` 不能转导出 `register`（`validate` 报错），改为以 const 函数导出并调用守卫文件的
  `register`；F-05-05 文本同步。
- 去重变量另在 `classic.SessionStart`（`clear`、`resume`、`fork`）上重写，F-05-08 文本同步；这三个
  命令之后的会话 id 与去重效果未实测（§7 第 1 行）。
- TA-18 的文本过时（`claude-code:subprocess` 已承载 `SessionEnd`），改为写入 `claude-code:subprocess`
  与 `codex:subprocess`、只在 `agy:subprocess` 跳过。
- 期望产物：已有夹具不变；新增 7 个夹具的 manifest 与 hooks 配置按验收标准核对后写入，`.mjs`、
  `register.ts`、`types/index.d.ts` 与报告由更新命令写入。

## 6. 技术决策

- 入口以 `if (__UAPA_CHECKS__.<检查名>)` 包住各事件的注册，停机计数的 `atom` 以 `/* @__PURE__ */`
  标注；rolldown 移除常量条件的分支与未使用的纯调用（以 `null !== null`、`false` 与点号形式的 define
  实测），产物只剩 `import "claude-code"` 与计划的处理函数。
- `.catch` 处理器不调用 `$`（重入时不可用），只依据 `next.called` 作答，原因为固定的
  `uapa: hooks 模块出错`；守卫自身的抛错与无效返回值在处理函数内按 F-04-04 的原因收口。
- `tool.call` 的 `command` 对任一工具取 `e.command`（是字符串时）；规范名为 `shell` 但缺少命令时按
  `uapa: 无法解析宿主输入: tool.command` 拒绝，`prompt.submit` 的 `e.text` 不是字符串时按
  `uapa: 无法解析宿主输入: text` 丢弃。改写只对 `Bash` 写回，`PowerShell` 按 `fallbackReason` 拒绝。
- `plugin.json` 的 `types` 字段排在配置给出的字段之后；`hooks/hooks.json` 的 `hooks` 键在 `modules`
  键之前，只有 hooks 模块时只写 `modules`（旧版本不加载的情况由残余风险说明）。
- 架构 ARCH-001「风险与待确认」第 2 行中 Codex 的部分不成立：合并布局里 Codex 不读取 Claude Code
  生成的 `hooks/hooks.json`（两者都生成时内容不同即冲突；设 `hosts.codex.hooksFile` 时 Codex 读自己的
  文件；Codex 没有 hooks 时写内联的空值）。Copilot CLI 为预留目标，该行保持待确认。
- 承接 M1-06 验收 §7 第 1、2 行（已关闭）：同宿主两目标时 `claude-code:in-process` 不写 `skipped`
  （`command-hooks.test.ts`）；`claude-code:in-process` 的 `commandHookEvents` 全部为 `null`，声明的
  命令只写在 `hooks` 键中，由用户命令直接运行，不经过去重（`command-hooks` 夹具）。
- 承接 M1-02 验收 §7 第 3 行（已关闭）：skill 只限定 `claude-code:subprocess` 时
  `claude-code:in-process` 的报告记残余风险；`claude-code:in-process` 失败时插件目录只写
  `claude-code:subprocess` 的文件（`layout.test.ts`）。

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|
| 1 | TA-11 只在容器中覆盖了同一会话的去重；嵌套会话（在会话的 Bash 中启动 Claude Code）与 `/clear`、`/resume`、`/branch` 之后的去重未实测 | `F-05-08` 的宿主行为部分验证 | M1-08 创建 tag 前由维护者实测（已写入 M1-08 施工单「关键落地约束」） |
| 2 | TA-12 的 `claude plugin test` 未运行（产物不含测试文件），`validate --strict` 只在容器的 Linux 环境中运行 | 宿主侧的测试运行器未覆盖 | M1-08 创建 tag 前由维护者在本机运行（已写入 M1-08 施工单「关键落地约束」） |

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- hooks 模块的写法依赖 2.1.296 的静态校验规则（不跟踪转导出、未声明的 `atom` 报错、`$.env.set`
  的变量名须为字面量）；宿主升级后先对夹具产物重跑 `validate --strict`。
- 夹具守卫的停机原因要求“先运行测试”，真实会话中模型会尝试运行命令；实测停机门禁时须限制工具
  （本单的会话实测以 `--permission-mode default --allowedTools Read` 运行）。
- 下一步：M1-08（发布 v0.1.0）。
