# 施工单 M4-04：守卫选项

> 守卫在默认导出的 `options` 中声明选项，检查方法从 `GuardContext` 读取取值。Claude Code 产物把
> 选项写为 `userConfig`，两种形态读取用户设置的取值；Codex 与 agy 取默认值并写残余风险。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M4-00](M4-00-v0-3-0-rules-commands-guard-options.md) |
| 覆盖功能点 | `F-02-05`、`F-04-09`、`F-05-17`、`F-05-18`、`F-06-10`、`F-11-10` |
| 依赖工单 | [M4-01](M4-01-v0-3-0-interfaces.md) |
| 关联 issue | 无 |
| 验收文件 | [M4-04](../acceptance/M4-04-guard-options.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 已有且够用：`readGuard`（`src/source/guard.ts`）读取并校验守卫的默认导出；`TargetRuntimeData`
  由宿主模块填写、`bundle` 内联；`decide`（`src/runtime/entries/subprocess.ts`）在调用守卫的各
  检查中统一收口异常；hooks 模块入口的 `register(on)`（`claude-code-in-process.ts`）。
- 已有但不对：生成的 `hooks/register.ts`（`src/targets/claude-code/module.ts` 的
  `REGISTER_SOURCE`）为 `on => guard(on)`，不传 `options`；`hosts['claude-code'].userConfig` 的
  类型为 `unknown`，原样写入 `plugin.json`；`subprocess.ts` 已有 350 行。
- 完全没有：`GuardOption`、`GuardContext`、`GuardDeclaration.options`、
  `TargetRuntimeData.options`、`SubprocessProtocol.optionValue`，以及取值的解析与校验。
- 宿主事实：[Claude Code「commands 与 userConfig」](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#commands-与-userconfig)
  ——变量名为 `CLAUDE_PLUGIN_OPTION_<全大写>`，只导出用户设置过的选项；hooks 模块的 `options`
  含带类型的取值与默认值。

## ⚠️ 关键落地约束（必须先验证）

- **`register.ts` 传入 `options` 后的静态校验**：改为 `(on, options) => guard(on, options)` 后，在
  容器中对 `guard-options` 的 Claude Code 产物运行 `claude plugin validate --strict`。不通过时
  `register.ts` 保持原样，`claude-code:in-process` 取默认值并写残余风险，与 Codex、agy 相同，
  在验收 §5 写明。
- **取值的解析只在 `runtime/core`**：解析与类型检查是不做 I/O 的纯函数，放在
  `src/runtime/core/options.ts`，两种形态共用；`subprocess.ts` 只调用协议的 `optionValue`。
- **无效取值按守卫出错收口**：执行前检查拒绝、提示提交前检查阻断、停机前检查不阻止结束并在
  stderr 写原因、执行后检查扣留，原因为 `uapa: 守卫选项无效: <选项名>`。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 是 | `guard-options` 的入口用例：`CLAUDE_PLUGIN_OPTION_*` 为无效值时执行前检查以退出码 2 拒绝；hooks 模块以桩传入类型不符的 `options` 时返回 `{ deny }` |
| 产物零依赖 | 是 | TA-01 的导入检查覆盖 `guard-options` 的入口与守卫文件 |
| 不在运行时推断宿主 | 是 | 入口只按打包时注入的 `options` 与本目标协议读取；`codex:subprocess`、`agy:subprocess` 的入口用例设置 `CLAUDE_PLUGIN_OPTION_*` 时仍取默认值 |
| 确定性输出 | 是 | `guard-options` 夹具逐字节比对；`userConfig` 与 `options` 按选项名排序 |
| 不越权写入 | 否 | 不改写出与比对 |
| 安装不运行脚本 | 否 | 不改 `package.json` |
| 能力数据有出处 | 否 | 不改能力数据；宿主读取方式的出处写在协议实现的注释中 |

## 任务

### 1. 公共类型与守卫声明（`src/runtime/core/types.ts`、`src/source/guard.ts`、`src/index.ts`）

- `GuardOption`、`GuardContext`；`GuardPlugin.options`；各检查方法的最后一个参数（F-02-05）。
- `readGuard` 校验选项并得出按名称排序的 `GuardDeclaration.options`。

### 2. 取值解析（`src/runtime/core/options.ts`，新文件）

- 由声明与各选项的文本（或模块收到的值）得出 `GuardContext.options`，或无效的选项名
  （F-04-09、F-05-18）。

### 3. 子进程入口（`src/runtime/entries/subprocess.ts`、`*-subprocess.ts`）

- `TargetRuntimeData.options`；`SubprocessProtocol.optionValue`（可选）；在调用守卫的检查中解析
  取值并传入 `GuardContext`，无效时按上文收口（F-04-09）。
- `claude-code-subprocess.ts` 实现 `optionValue`（F-05-18）；Codex 与 agy 不实现（F-06-10、F-11-10）。

### 4. hooks 模块（`src/runtime/entries/claude-code-in-process.ts`、`src/targets/claude-code/module.ts`）

- `register(on, options)`，处理函数以 `options` 解析取值；生成的 `register.ts` 传入 `options`
  （F-05-18；按关键落地约束验证）。

### 5. 宿主模块（`src/targets/`）

- 三个宿主模块把 `GuardDeclaration.options` 写入 `TargetRuntimeData.options`。
- Claude Code：`plugin.json` 的 `userConfig` 按 F-05-17 生成，宿主选项不是对象或键冲突时生成
  失败。Codex 与 agy：守卫声明有选项且 `TargetPlan.checks` 非空时写残余风险（F-06-10、F-11-10）。

### 6. 文档

- `docs/guide/guards.md` 写选项的声明与读取、各宿主的取值来源；`docs/guide/configuration.md`
  说明 `hosts['claude-code'].userConfig` 与守卫选项的关系。

### 不改的地方（红线）

- 现有夹具的期望产物不变：守卫没有选项时，`TargetRuntimeData.options` 为空对象，打包生成的
  入口与守卫文件除常量外不变；有变化时在验收 §5 列出受影响的文件并说明原因。
- 不改 `requires` 与能力检查；不新增 `Capability`。
- 不读取 `CLAUDE_PLUGIN_OPTION_*` 以外的环境变量取选项。

### 测试

- 单元：`test/source/` 中 `readGuard` 的选项名不合规则、全大写后重名、`default` 与 `type`
  不一致、number 默认值不是有限数、`title` 为空；`test/runtime/` 中 `options.ts` 对三种类型的
  有效与无效文本、模块收到的类型不符的值。
- 夹具：新增 `guard-options`（夹具表）；入口用例覆盖三个子进程目标的默认值、
  `claude-code:subprocess` 的有效与无效环境变量、Codex 与 agy 设置了同名变量；hooks 模块按
  TA-17 的方式以桩加载产物并传入 `options`。断言 TA-23 的通过标准。
- 宿主实测：容器中对 `guard-options` 的 Claude Code 产物运行 `claude plugin validate --strict`。

## 验收

```bash
test/container/run.sh check
```

```bash
test/container/run.sh exec node --test test/fixtures/fixtures.test.ts test/fixtures/hooks-module.test.ts
```

宿主实测（需要容器中的 Claude 令牌）：对 `guard-options` 期望树中的 Claude Code 插件目录运行
`claude plugin validate --strict <插件目录>`。

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 最终实现方案、关键技术决策及其验证依据；
3. 主要改动点与涉及模块清单；
4. 测试覆盖、宿主实测结果、判断范围和已知限制；
5. 如适用，附生成的产物或入口的输入输出示例。

## 边界

- 允许新增与修改：`src/runtime/`、`src/source/guard.ts`、`src/index.ts`、`src/targets/`（选项相关
  部分）、`src/config/types.ts`（`userConfig` 的类型说明）、`test/`、`docs/guide/`、夹具表与
  接口文档中本单涉及的段落。
- 禁止修改：`src/build/` 的能力检查与写出、能力数据、`package.json`。

## 依赖

M4-01 的接口定稿；容器中的 Claude 令牌（宿主实测）。
