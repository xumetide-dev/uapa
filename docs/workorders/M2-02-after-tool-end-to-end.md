# 施工单 M2-02：执行后检查端到端

> 公共类型加入 `afterTool`，构建时按 `replaceOutput`、`withholdOutput` 做能力检查，子进程入口与
> hooks 模块在工具执行后调用守卫，并为 Claude Code 两种形态与 Codex 写出替换或扣留的决策；
> agy 按能力缺失不生成执行后 hook。新增 `after-tool` 夹具。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M2-00](M2-00-v0-2-0-three-host-completion.md) |
| 覆盖功能点 | `F-02-04`、`F-04-08`、`F-05-13`、`F-06-07` |
| 依赖工单 | [M2-01](M2-01-v0-2-0-host-facts.md) |
| 关联 issue | 无 |
| 验收文件 | [M2-02](../acceptance/M2-02-after-tool-end-to-end.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 已有但不对：
  - `src/source/guard.ts`：`AFTER_TOOL_ONLY` 与 `NO_AFTER_TOOL` 按 SD-20 拒绝默认导出上的
    `afterTool`，以及 `requires` 中的 `replaceOutput`、`withholdOutput`。
  - `src/runtime/core/types.ts`：`GuardPlugin` 没有 `afterTool`，`GuardCheck` 与 `GUARD_CHECKS`
    只有 `beforeTool`、`beforePrompt`、`beforeStop`；包入口 `src/index.ts` 不导出 `AfterTool`。
  - 以 `GuardCheck` 为键的表：`src/capabilities/types.ts` 的 `failureDefault`，
    `src/targets/claude-code/hooks.ts` 与 `src/targets/codex/hooks.ts` 的 `EVENTS`、
    `CHECK_ARGS`，`src/targets/agy/hooks.ts` 的 `CHECK_ARGS`，`src/build/report.ts` 的
    `CHECK_LABELS`，`src/runtime/entries/bundle-names.d.ts` 的 `__UAPA_CHECKS__`；以 `CheckArg`
    为键的 `src/runtime/entries/subprocess.ts` 的 `CHECKS`。
  - `src/build/plan.ts`：`GATE_OF_CHECK` 只有 `beforePrompt`、`beforeStop`；`degraded` 只写
    `rewrite`。
  - `src/runtime/entries/claude-code-in-process.ts`：执行前检查的 `.catch` 在 `next.called` 为真
    时以 `next(e)` 重放结果；执行后检查出错时这样做会放出原输出，与 F-04-08 不符。
  - `src/runtime/entries/claude-code-api.d.ts`：`ToolCallResult` 只有 `deny`。
- 完全没有：`src/runtime/core/decisions.ts` 中执行后检查的返回值检查；子进程协议中的执行后
  检查方法；`PostToolUse` 的守卫条目；含 `afterTool` 的夹具。
- 宿主事实：执行后检查的输入字段与输出写法以 M2-01 写入的调研文档与入口与打包接口为准。
  Claude Code 官方文档记载内置工具的 `updatedToolOutput` 须符合该工具的输出形状，不符合时被
  静默忽略；agy 的 `withholdOutput`、`replaceOutput` 为不支持（F-11-01）。

## ⚠️ 关键落地约束（必须先验证）

- **以 M2-01 的结论为前提**：某目标的 `withholdOutput` 在 M2-01 后仍为不支持时，本单不为该目标
  生成执行后 hook，夹具与报告按能力缺失写；不按官方文档的未实测描述实现。
- **不写会被宿主静默忽略的输出**：Claude Code 命令 hooks 只对 M2-01 实测确认了输出形状的工具
  写 `updatedToolOutput`；其余工具的处理按 SD-29，并在报告中写明。
- **hooks 模块只注册一个 `tool.call` 处理函数**：同一插件注册两个不带 matcher 的处理函数时
  模块校验失败（M2-01 实测），执行前与执行后检查写在同一个处理函数中（先执行前检查，`next`
  之后执行后检查），写法见入口与打包接口第 2、4 节。
- **执行后检查出错不放出原输出**：hooks 模块在 `next` 之后出错时，`.catch` 返回 `{ deny }`，
  不以 `next(e)` 重放；`next` 之前出错仍按执行前检查拒绝。
- **测试只用标记文本**：入口用例的工具输出与替换文本为 `uapa-keep-probe`、
  `uapa-replace-probe`、`uapa-withhold-probe`、`uapa-throw-probe` 这类标记，不出现真实命令。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 是 | `after-tool` 夹具的入口用例：守卫抛错、返回值无效与输入无法解析时输出扣留；`requires` 含目标缺少的 `replaceOutput` 或 `withholdOutput` 时该目标失败（单元测试）；agy 的报告写明执行后检查被省略 |
| 产物零依赖 | 是 | TA-01：`after-tool` 产物的子进程入口只导入 `node:` 内置模块，`hooks/uapa-guard.mjs` 只导入 `'claude-code'` |
| 不在运行时推断宿主 | 是 | 入口只读打包时内联的 `capabilities`；子进程协议单元测试断言能力数据与协议方法一致 |
| 确定性输出 | 是 | `after-tool` 夹具在临时目录中构建，产物与报告逐字比对 |
| 不越权写入 | 否 | |
| 安装不运行脚本 | 否 | |
| 能力数据有出处 | 是 | 各目标 `failureDefault.afterTool` 的注释指向 M2-01 的调研结论；TA-09 通过 |

## 任务

### 1. 守卫接口（`src/runtime/core/types.ts`、`src/index.ts`、`src/source/guard.ts`）

- `AfterTool`、`GuardPlugin.afterTool` 按 hooks 适配第 2 节；`GuardCheck` 与 `GUARD_CHECKS` 加入
  `'afterTool'`；包入口导出 `AfterTool`；`readGuard` 不再拒绝 `afterTool`、`replaceOutput`、
  `withholdOutput`（F-02-04）。

### 2. 能力检查与构建报告（`src/build/`）

- 按 SD-29 与修订后的 F-03-13：`afterTool` 的生成条件为 `withholdOutput`，缺失时省略并写残余
  风险；`replaceOutput` 缺失且 `requires` 不含时写 `degraded`；`requires` 含缺失能力时目标失败
  （F-02-04）。改动在 `plan.ts`、`state.ts` 与 `report.ts`。

### 3. 返回值检查与子进程公共部分（`src/runtime/core/`、`src/runtime/entries/`）

- `decisions.ts` 的 `checkAfterTool` 校验 `keep`、`replace`、`withhold`；`subprocess.ts` 的检查名
  加入执行后检查；守卫抛错、返回值无效与输入无法解析时调用协议的扣留输出，原因与 F-04-04
  相同（F-04-08）。

### 4. Claude Code

- 命令 hooks：`src/targets/claude-code/hooks.ts` 写 `PostToolUse` 条目；
  `src/runtime/entries/claude-code-subprocess.ts` 以 `updatedToolOutput` 输出替换与扣留，写法以
  M2-01 的实测为准（F-05-13）。
- hooks 模块：`claude-code-in-process.ts` 在 `next` 之后调用守卫，替换返回 `{ result }`、扣留返回
  `{ deny }`；`claude-code-api.d.ts` 补 `next` 结果与 `{ result }` 的类型（F-05-13）。
- `src/capabilities/claude-code-*.ts` 的 `failureDefault.afterTool` 按 M2-01 的结论填写。

### 5. Codex

- `src/targets/codex/hooks.ts` 写 `PostToolUse` 条目；`src/runtime/entries/codex-subprocess.ts` 的
  扣留输出 `decision: "block"`，字段以 M2-01 的源码核对为准；`requires` 含 `replaceOutput` 时
  目标失败（F-06-07）。
- `src/capabilities/codex-subprocess.ts` 的 `failureDefault.afterTool` 按源码结论填写。

### 6. agy（`src/targets/agy/`、`src/capabilities/agy-subprocess.ts`）

- 不生成执行后 hook；`failureDefault.afterTool` 写 `{ error: 'allow', timeout: 'allow' }` 并注明
  “宿主不能阻断或替换输出”。

### 7. 夹具（`test/fixtures/after-tool/`）

- 守卫实现 `beforeTool`（放行）与 `afterTool`：输出含 `uapa-replace-probe` 时返回 `replace`，
  含 `uapa-withhold-probe` 时返回 `withhold`，含 `uapa-throw-probe` 时抛错，含
  `uapa-invalid-probe` 时返回无效值，其余返回 `keep`；四个目标，默认布局。
- 入口用例覆盖两个子进程目标的保留、替换、扣留、抛错与缺少输出字段；hooks 模块的对应分支写进
  `test/runtime/in-process.test.ts`。

### 不改的地方（红线）

- v0.1.0 的 16 个夹具：manifest、hooks 配置、构建报告与入口用例的期望不变；只有打包生成的
  `.mjs` 可因 `GuardCheck` 增加取值而变化，在验收 §5 写明。
- 执行前、提示提交前与停机前检查的输出与异常收口不变。
- agy 的 hooks 配置中不出现守卫的 `PostToolUse` 条目。

### 测试

- 单元：
  - `checkAfterTool` 的有效与无效返回值；`readGuard` 接受 `afterTool`。
  - `planTargets` 对 `withholdOutput`、`replaceOutput` 在 `requires` 中与不在其中的四种情况。
  - 子进程公共部分以 `test/` 下的最小入口覆盖保留、替换、扣留、抛错、无效返回值与输入无法
    解析；Claude Code 与 Codex 协议的输出写法。
  - hooks 模块在 `next` 之后的保留、替换、扣留与出错。
- 夹具：`after-tool` 的整树比对与入口用例（TA-19）；agy 的报告含执行后检查被省略的残余风险，
  Codex 的报告按能力数据含 `replace` 的降级。

## 验收

```bash
pnpm check
node --test test/fixtures/fixtures.test.ts test/runtime/decisions.test.ts test/runtime/subprocess.test.ts test/runtime/in-process.test.ts test/runtime/claude-code-subprocess.test.ts test/runtime/codex-subprocess.test.ts test/build/checks.test.ts test/source/guard.test.ts
```

宿主实测见 M2-05。

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 最终实现方案、关键技术决策及其验证依据；
3. 主要改动点与涉及模块清单；
4. 测试覆盖、判断范围（夹具与单元测试）和已知限制；
5. `after-tool` 夹具中各目标的 hooks 配置与入口的输入输出示例。

## 边界

- 允许新增与修改：`src/runtime/`、`src/source/guard.ts`、`src/index.ts`、`src/build/`、
  `src/targets/`、`src/capabilities/`、`test/`、与本单相关的接口文档与功能清单条目。
- 禁止修改：v0.1.0 夹具的手写期望文件；发布脚本。

## 依赖

M2-01：执行后检查的宿主结论、SD-29 与入口与打包接口的执行后检查协议。
