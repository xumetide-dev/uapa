# 施工单 M5-05：守卫可靠性与残余风险

> 本单的改动按宿主列出：
> - Claude Code：可以选择让执行前与提示提交前的守卫入口出错时阻断；`Monitor`、`NotebookEdit`
>   加入工具名换算。
> - Codex：声明的 `SessionEnd` 命令 hook 写 3 秒超时。
> - agy：补全停机继续上限与 `/btw` 的残余风险；停机计数的目录不变（SD-46）。
> - 三个宿主：补全漏记的残余风险。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M5-00](M5-00-v0-4-0-host-coverage.md) |
| 覆盖功能点 | `F-05-21`、`F-05-22`、`F-05-23`、`F-06-14`、`F-06-16`、`F-11-14` |
| 依赖工单 | [M5-01](M5-01-v0-4-0-host-facts-and-interfaces.md)、[M5-03](M5-03-converted-rules-and-commands.md) |
| 关联 issue | 无 |
| 验收文件 | [M5-05](../acceptance/M5-05-guard-reliability-and-risks.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 已有且够用：
  - `commandHooks`、`hooksKey`（`src/targets/claude-code/hooks.ts`）写守卫条目。
  - 各宿主模块的 `residualRisks` 按计划逐条追加残余风险，例如 agy 的 `STOP_COUNTER_RISK`、
    `PRE_TOOL_USE_RISK`（`src/targets/agy/index.ts`）。
  - `openStopCounter`（`src/runtime/entries/stop-counter.ts`）按协议给出的目录保存计数。
- 已有但不对：
  - Codex 的命令 hooks 一律写 `hookTimeoutSeconds`（30），`SessionEnd` 也是 30
    （`src/targets/codex/hooks.ts`）。
  - Claude Code 的 `toolNames` 没有 `Monitor`、`NotebookEdit`。
- 完全没有：`onFailure` 的写出；SD-43 第 (6) 项列出的残余风险。
- 宿主事实：
  - Claude Code CHANGELOG 2.1.295（`onFailure`）；文档「hooks」「permissions」「tools reference」。
  - Codex rust-v0.162.1：`hooks/src/engine/discovery.rs`、`hooks/src/engine/mod.rs`。
  - agy CHANGELOG 1.1.9、1.3.2。
  - TA-25 第 1、5、8、9 项的结论：`Monitor` 的入参含 `command`，`NotebookEdit` 为 `notebook_path`
    等；`onFailure: "block"` 在入口缺失时阻断；agy 1.3.5 的 hook 进程中没有 `PLUGIN_DATA`；插件
    agent 的会话中 hooks 照常运行，连续继续 10 次后不再采用 `continue`。

## ⚠️ 关键落地约束（必须先验证）

- **`onFailure` 不改默认行为**：只有配置 `hosts['claude-code'].onFailure: 'block'` 时写入，现有
  夹具的产物不变；能力数据的 `failureDefault` 不变。
- **工具名换算只按实测的入参**：`Monitor` 的命令字段为 `command`，与 `Bash` 相同，改写的反向
  换算写回该键。
- **agy 的数据目录**：TA-25 第 8 项证实 1.3.5 的 hook 进程中没有 `PLUGIN_DATA`，F-11-13 已改为
  预留（SD-46），入口不变；`STOP_COUNTER_RISK` 只把宿主版本改为 1.3.5。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 是 | `host-coverage` 的 `hooks.json` 中执行前与提示提交前守卫条目带 `onFailure`；`Monitor` 的入口用例以标记命令得到拒绝；TA-27 在宿主中复测 |
| 产物零依赖 | 否 | 不改入口 |
| 不在运行时推断宿主 | 否 | 不改入口 |
| 确定性输出 | 是 | `command-hooks`、`host-coverage` 夹具逐字节比对 |
| 不越权写入 | 否 | 不改写出 |
| 安装不运行脚本 | 否 | 不改 `package.json` |
| 能力数据有出处 | 是 | `toolNames` 新增项的注释指向 TA-25 的小节 |

## 任务

### 1. Claude Code（`src/targets/claude-code/`、`src/capabilities/claude-code-*.ts`）

- `hooks.ts`：按 F-05-21 写 `onFailure`，并改写残余风险。
- 能力数据：按 F-05-22 与 TA-25 第 1 项修改 `toolNames`。
- 残余风险：按 F-05-23 补全。

### 2. Codex（`src/targets/codex/`）

- `hooks.ts`：按 F-06-14，声明的 `SessionEnd` 写 `timeout: 3`。
- 残余风险：按 F-06-16 补全；技能名超长时列为跳过。
- 信任风险（`risks.ts` 的 `TRUST_RISK`）的后果按插件包中实际的 hooks 写：没有守卫、只有声明的命令
  hooks 或 always 规则的输出条目（M5-03 起）时，不写“守卫不生效”。

### 3. agy（`src/targets/agy/`、`src/runtime/entries/agy-subprocess.ts`）

- 按 F-11-14 补全残余风险；`STOP_COUNTER_RISK` 中的宿主版本改为 1.3.5，入口不改。

### 4. 文档

- `docs/guide/targets.md`：残余风险的说明，以及 `onFailure` 的用法与后果。
- `docs/guide/guards.md`：`Monitor` 的检查。
- `docs/architecture/command-hooks.md`：已在 M5-01 定稿，本单只核对。

### 不改的地方（红线）

- 默认配置的产物只因 F-06-14 改变：`command-hooks` 夹具中 Codex 的 `SessionEnd` 超时。其余夹具中
  只有残余风险的文字随功能条目增加，在验收 §5 列出。
- 守卫接口、入口协议与决策输出不变。

### 测试

- 单元：
  - `onFailure` 只出现在 `PreToolUse` 与 `UserPromptSubmit` 的守卫条目中。
  - 只配置 `claude-code:in-process` 时的残余风险。
  - Codex 的 `SessionEnd` 超时。
  - 每条新增残余风险的触发条件。
- 夹具与入口用例：
  - `host-coverage` 配置 `onFailure`。
  - `Monitor` 的入参运行标记命令，期望拒绝（入参形状以 TA-25 为准）。

## 验收

```bash
test/container/run.sh check
```

```bash
test/container/run.sh exec node --test test/fixtures/fixtures.test.ts
```

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 最终实现方案、关键技术决策及其验证依据；
3. 主要改动点与涉及模块清单；
4. 测试覆盖、宿主实测结果、判断范围和已知限制；
5. 如适用，附生成的产物或入口的输入输出示例。

## 边界

- 允许新增与修改：`src/targets/`、`src/capabilities/`、`src/runtime/entries/agy-subprocess.ts`、
  `test/`、`docs/guide/`、夹具表中本单涉及的段落。
- 禁止修改：守卫公共类型、`src/runtime/core/`、`src/runtime/entries/subprocess.ts` 的协议。

## 依赖

M5-01 的 TA-25 结论；M5-03 对 Codex 宿主模块残余风险的拆分。
