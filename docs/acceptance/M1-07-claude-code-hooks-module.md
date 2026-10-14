# 验收 M1-07：Claude Code hooks 模块与四目标夹具

> 本文记录 M1-07 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M1-07](../workorders/M1-07-claude-code-hooks-module.md) |
| 覆盖功能点 | `F-04-07`、`F-05-05`、`F-05-06`、`F-05-07`、`F-05-08`、`F-05-10`、`F-05-14`（取自总览「工单构成」表） |
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
| 1 | 硬约束：守卫不静默失效 | TA-17：守卫抛错且未调用 `next` 时 `.catch` 返回 `{ deny }`、`{ drop }`；`classic.Stop` 不阻止结束 | | | ⏳ |
| 2 | 硬约束：产物零依赖 | `hooks/uapa-guard.mjs` 只导入 `'claude-code'`，`hooks/register.ts` 只导入 `./uapa-guard.mjs`（TA-01） | | | ⏳ |
| 3 | 硬约束：不在运行时推断宿主 | 去重只比较 `UAPA_MODULE_SESSION_<插件名>` 与 stdin 的 `session_id` | | | ⏳ |
| 4 | 硬约束：确定性输出 | `in-process-only`、`claude-both` 与四目标夹具逐字节比对；TA-06 | | | ⏳ |
| 5 | 硬约束：不越权写入 | TA-07、TA-08 的夹具部分 | | | ⏳ |
| 6 | 硬约束：能力数据有出处 | `claude-code-in-process.ts` 写 2.1.296、核对日期与 Mods 指南出处 | | | ⏳ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-04-07` | hooks 模块形态的打包 | `external` 为 `'claude-code'` 时，打包结果只导入 `'claude-code'`，出现 `node:` 或其他外部导入时打包失败 | ⏳ | |
| `F-05-05` | 生成 hooks 模块入口 | `generate` 以 `input.bundle`（`entry: 'claude-code-in-process'`、`external: 'claude-code'`）打包并输出为 `hooks/uapa-guard.mjs`。`src/runtime/entries/claude-code-in-process.ts` 导出 `register`，按 `TargetPlan.checks` 在 `tool.call`、`prompt.submit` 与 `classic.Stop` 上调用守卫：`sessionId` 取 `await $.session.id()`；`tool.call` 的工具名取 `e.tool`，入参为 `e` 去掉 `tool`、`tool_use_id` 后的字段；`allow` 调用 `next(e)`，`deny` 返回 `{ deny: reason }`；`rewrite` 只在 `e.tool` 为 `Bash` 时以 `next({ ...e, command })` 写回，其他工具按 `fallbackReason` 返回 `{ deny }`（Mods 指南只记载了 `Bash` 的 `e.command`）；`prompt.submit` 的提示文本取 `e.text`，`block` 返回 `{ drop: reason }`；`classic.Stop` 的 `continue` 返回 `{ block: reason }`，`stop` 调用 `next(e)`（Mods 指南「常用事件与返回值」）。`'claude-code'` 的类型在 `src/runtime/entries/claude-code-api.d.ts` 中手写（入口与打包接口第 1 节）。生成的 `hooks/register.ts` 以 `import` 声明引入 `./uapa-guard.mjs` 并导出 `register`；`hooks/hooks.json` 写入 `"modules": ["./register.ts"]`（路径相对该文件） | ⏳ | |
| `F-05-06` | hooks 模块的异常收口 | `claude-code-in-process.ts` 以入口与打包接口第 4 节的检查函数校验守卫返回值。守卫抛错或返回值无效时：执行前检查返回 `{ deny: <原因> }`，提示提交前检查返回 `{ drop: <原因> }`，停机前检查调用 `next(e)`，不阻止结束；原因与 F-04-04 相同。执行前与提示提交前检查另写 `.catch`，未调用 `next` 前出错不放行 | ⏳ | |
| `F-05-07` | 生成状态类型契约 | 只在 `claude-code:in-process` 进入 `plans` 且其 `TargetPlan.checks` 含 `beforeStop` 时生成，否则不生成 `types/index.d.ts`，`plugin.json` 也不写 `types` 字段。停机门禁计数存于 `$.state`，引用为 `{ plugin: __UAPA_PLUGIN_NAME__, key: 'uapaStopContinuations' }`，值为 `number`；生成 `types/index.d.ts`，只在 `declare module 'claude-code'` 的 `interface PluginState` 中声明 `'<配置 name>': { uapaStopContinuations: number }`；在 `plugin.json` 写 `types` 字段；`claude plugin validate` 能核对状态键 | ⏳ | |
| `F-05-08` | 按会话 id 去重 | 两个 Claude Code 目标都进入 `plans` 时，宿主模块把两个入口的 `TargetRuntimeData.moduleSessionEnv` 设为 `UAPA_MODULE_SESSION_<插件名>`（配置 `name` 转大写，`-` 换为 `_`），否则为 `null`；hooks 模块在 `session.start` 以 `__UAPA_MODULE_SESSION_ENV__` 为变量名写入会话 id；命令入口经 `skip` 比对该变量与 stdin 的 `session_id`，相等时以退出码 0 结束；不只判断变量是否存在；为 `null` 时不读写该变量，打包后的守卫文件中不出现 `$.env.set` 调用（入口与打包接口第 1 节） | ⏳ | |
| `F-05-10` | 两种形态合为一个插件包 | 同时配置两个目标时写入同一目录：`hooks/hooks.json` 同时含 `hooks` 与 `modules` 键，`plugin.json` 只生成一份；只配置其中一个目标，或其中一个目标未通过能力检查时，只含对应的键；插件包中只有 `claude-code:in-process` 的 hooks 时（只配置了该目标，或 `claude-code:subprocess` 未通过能力检查），残余风险写明 Claude Code 2.1.287 之前的版本不加载 hooks 模块，守卫不生效 | ⏳ | |
| `F-05-14` | `claude-code:in-process` 的能力数据 | 宿主版本 2.1.296，写明核对日期与出处；取值与 hooks 适配第 4、6、8 节一致，工具名见[跨平台对比「工具名差异」](../research/coding-agent-plugin-manifests/cross-platform-comparison.md#工具名差异)；`promptGate` 为支持；`hookTimeoutSeconds` 与 `defaultTimeoutSeconds` 为 `null`；`failureDefault` 全部为 `{ error: 'allow', timeout: 'allow' }`，依据 Mods 指南「失败处理与 `.catch`」（钩子抛错或超出预算时被跳过），入口的收口见 F-05-06；在登记处加入本目标（M5） | ⏳ | |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
pnpm check
node --test test/fixtures/fixtures.test.ts test/runtime/in-process.test.ts
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `pnpm check` | ⏳ | 无 |
| `node --test test/fixtures/fixtures.test.ts test/runtime/in-process.test.ts` | ⏳ | 无 |

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
