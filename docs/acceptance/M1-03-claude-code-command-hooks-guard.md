# 验收 M1-03：守卫端到端（Claude Code 命令 hooks）

> 本文记录 M1-03 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M1-03](../workorders/M1-03-claude-code-command-hooks-guard.md) |
| 覆盖功能点 | `F-03-13`、`F-03-14`、`F-04-01`、`F-04-02`、`F-04-03`、`F-04-04`、`F-04-05`、`F-04-06`、`F-05-03`、`F-05-04`、`F-05-09`（取自总览「工单构成」表） |
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
| 1 | 硬约束：守卫不静默失效 | F-03-13 的单元测试；入口用例：守卫抛错、返回值无效、缺少会话 id 时执行前检查以退出码 2 拒绝，原因符合 F-04-03、F-04-04 | | | ⏳ |
| 2 | 硬约束：产物零依赖 | 打包后的入口只含 `node:` 导入（TA-01 的解析检查）；`external` 为 `'node'` 时出现其他导入则打包失败的单元测试 | | | ⏳ |
| 3 | 硬约束：不在运行时推断宿主 | `claude-code-subprocess.ts` 只读 `CLAUDE_PLUGIN_DATA` 与去重变量；单元测试在设置 `PLUGIN_DATA` 时输出不变 | | | ⏳ |
| 4 | 硬约束：确定性输出 | `single-claude` 夹具逐字节比对，含打包后的 `.mjs` | | | ⏳ |
| 5 | 硬约束：不越权写入 | 停机计数只写入 `dataDir` 下的 `uapa-stop-<会话 id>.json`；会话 id `x/../y` 的用例（TA-16） | | | ⏳ |
| 6 | 硬约束：能力数据有出处 | TA-15 结论写入调研文档后再改能力数据，数据模块的出处与核对日期随之更新 | | | ⏳ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-03-13` | 构建时检查守卫能力 | 配置了守卫时，`requires` 中有目标缺失的能力（v0.1.0 只可能是 `rewriteInput`、`stopGate`、`promptGate`）则该目标失败；未列入 `requires` 的缺失能力：`rewriteInput` 在守卫实现了 `beforeTool` 时记为降级（`rewrite` 按 `fallbackReason` 拒绝），`stopGate`、`promptGate` 不生成对应 hook 并记为残余风险（hooks 适配第 6 节）；检查全部被省略时（未配置守卫的情况见 F-03-03），按模块接口 §5 不生成该目标的 hooks 配置与入口 | ⏳ | |
| `F-03-14` | 写出后调用宿主校验 | 写出后，对本次写出了文件且实现了 `verify` 的宿主模块，以其插件目录的绝对路径调用一次；`failed` 或 `verify` 抛错时该宿主的目标全部失败，抛错时错误为异常消息，已写出的文件保留；结果写入各目标报告的 `hostValidation`，未调用 `verify` 时为 `none`；`--check` 模式不调用 | ⏳ | |
| `F-04-01` | 工具名换算 | 换算函数以 `ToolNameMap`（宿主工具名到规范名，类型见 F-02-01）为参数，不引用 `src/capabilities/`；未映射的工具以 `host:<原名>` 传入；规范名为 `shell` 时入参换算为 `{ command }`，命令文本缺失时按输入无法解析处理（入口与打包接口第 3 节） | ⏳ | |
| `F-04-02` | 入参改写的反向换算与降级 | `rewrite` 只对 `shell` 生效：由宿主实现的 `rewriteShell` 复制原始入参并只替换命令字段；对其他工具返回 `rewrite`，或 `TargetRuntimeData.capabilities.rewriteInput` 为 `false` 时，按 `fallbackReason` 拒绝，不放行原始入参 | ⏳ | |
| `F-04-03` | 读取宿主输入 | 检查名由命令行第一个参数传入（`before-tool`、`before-prompt`、`before-stop`）；参数缺失或不是这三个值时，不读取 stdin，以退出码 1 结束并在 stderr 写原因；从 stdin 读取 JSON，经宿主实现的 `parse` 取出会话 id、工具名与入参，公共部分不含宿主字段名；输入无法解析时，执行前与提示提交前检查按拒绝输出，原因为 `uapa: 无法解析宿主输入: <缺失或类型不符的字段>`，停机前检查不阻止结束并在 stderr 写同一原因；宿主实现了 `skip` 且返回 `true`，或守卫未实现该检查时按放行结束，不调用守卫 | ⏳ | |
| `F-04-04` | 异常收口 | 守卫逻辑抛错时原因为 `uapa: 守卫出错: <错误消息>`，返回值形状不符或原因为空白时为 `uapa: 守卫返回值无效`；执行前与提示提交前检查以该原因调用宿主实现的 `deny`；停机前检查不阻止结束，并在 stderr 写该原因；检查函数位于 `src/runtime/core/decisions.ts`（入口与打包接口第 4 节），两种形态的入口共用 | ⏳ | |
| `F-04-05` | 按会话保存停机门禁计数 | `beforeStop` 返回 `continue` 时计数加 1，返回 `stop` 时清零；计数文件为宿主实现的 `dataDir` 所返回目录下的 `uapa-stop-<encodeURIComponent(会话 id)>.json`，内容为 `{"continuations":<n>}` 加换行，先写临时文件再重命名；`dataDir` 为 `null` 或目录不可写时 `continuations` 按 0 传入，并在 stderr 写原因；目录不存在时先递归创建（agy 的目录位于系统临时目录，见 SD-06） | ⏳ | |
| `F-04-06` | 打包入口 | `bundle` 按入口与打包接口第 1 节把守卫逻辑（`uapa:guard`）、目标数据（`uapa:target-data`）、`runtime/core` 与请求的入口打包为 ES2022 ESM 单文件，替换 `__UAPA_PLUGIN_NAME__`、`__UAPA_MODULE_SESSION_ENV__`；`external` 为 `'node'` 时只保留 `node:` 内置模块，出现其他外部导入时打包失败；按 `import.meta.url` 相对自身定位入口，定位方式对源码目录与 `dist/` 目录结构都成立；入口源码用到的打包时名称在 `src/runtime/entries/bundle-names.d.ts` 中声明 | ⏳ | |
| `F-05-03` | 生成命令 hooks 配置 | `hooks/hooks.json` 的 `hooks` 键按 `TargetPlan.checks` 生成条目：`beforeTool` → `PreToolUse`，`beforePrompt` → `UserPromptSubmit`，`beforeStop` → `Stop`；不写 matcher；命令为 `node "${CLAUDE_PLUGIN_ROOT}/hooks/uapa-claude-code.mjs" <检查名>`；超时字段未核实，不写出（沿用宿主默认超时的残余风险由构建编排按能力数据写出） | ⏳ | |
| `F-05-04` | 子进程入口的决策输出 | `generate` 以 `input.bundle`（`entry: 'claude-code-subprocess'`、`external: 'node'`）打包入口并输出为 `hooks/uapa-claude-code.mjs`。`claude-code-subprocess.ts` 实现 `SubprocessProtocol`：会话 id 取 stdin `session_id`，工具名取 `tool_name`；拒绝以退出码 2 结束并在 stderr 写原因；改写输出 `hookSpecificOutput.updatedInput`；停机继续输出 `decision: "block"` 与 `reason`；数据目录取 `CLAUDE_PLUGIN_DATA`；工具入参与提示文本的字段名、改写输出是否另需 `permissionDecision` 等字段、提示阻断的写法取自 TA-15 入口前提的结论，写在协议实现中并注明出处 | ⏳ | |
| `F-05-09` | 调用宿主校验命令 | 宿主模块实现 `verify`：运行 `claude plugin validate --strict <插件目录>`，退出码 0 为 `passed`，非零为 `failed` 并带命令输出；PATH 中没有 `claude` 时为 `skipped`；调用时机与失败处理见 F-03-14 | ⏳ | |

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
| `pnpm check` | ⏳ | 无 |
| `node --test test/fixtures/fixtures.test.ts test/runtime/stop-state.test.ts` | ⏳ | 无 |
| `claude plugin validate --strict <single-claude 的产物目录>` | ⏳ | 宿主实测：本机 Claude Code |

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
