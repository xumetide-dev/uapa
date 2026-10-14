# 施工单 M1-03：守卫端到端（Claude Code 命令 hooks）

> 实现守卫运行时的公共部分、打包与能力检查，并以 `claude-code:subprocess` 为第一个生成 hooks
> 配置与子进程入口的目标（里程碑 M3）。之后的子进程目标只实现各自的协议与 hooks 配置。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M1-00](M1-00-v0-1-0-three-host-build.md) |
| 覆盖功能点 | `F-03-13`、`F-03-14`、`F-04-01`、`F-04-02`、`F-04-03`、`F-04-04`、`F-04-05`、`F-04-06`、`F-05-03`、`F-05-04`、`F-05-09` |
| 依赖工单 | [M1-02](M1-02-skills-end-to-end.md) |
| 关联 issue | 无 |
| 验收文件 | [M1-03](../acceptance/M1-03-claude-code-command-hooks-guard.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 完全没有：`src/runtime/core/` 中的换算与 `decisions.ts`、`src/runtime/entries/`、`src/bundle/`
  的实现；`claude-code` 宿主模块只生成 manifest（M1-02）。
- 已定义：子进程协议与公共部分（[入口与打包接口](../architecture/runtime-interfaces.md) 第 3 节）、
  打包请求（第 1 节）、守卫返回值检查（第 4 节）、决策输出（hooks 适配第 4 节）。
- 未核实：Claude Code stdin 中工具入参与提示文本的字段名、改写输出是否另需
  `permissionDecision`、提示事件能否阻断、超时字段名、`SessionEnd` 事件、省略 matcher 时是否
  匹配全部工具（TA-15）。

## ⚠️ 关键落地约束（必须先验证）

- **TA-15 中 Claude Code 的各项**（入口前提，SD-22；发布前，SD-23）：在临时目录建记录输入的
  插件，`hooks/hooks.json` 在 `PreToolUse`（不写 matcher）、`PostToolUse`、`UserPromptSubmit`、
  `Stop`、`SessionStart`、`SessionEnd` 上运行同一脚本；用 `claude -p --plugin-dir <目录>` 运行最小
  会话，不安装插件。脚本按命令中的标记分别返回：退出码 2 拒绝、`updatedInput` 不带与带
  `permissionDecision`、超时、`Stop` 的 `decision: "block"`；另以含标记的提示测试 `UserPromptSubmit`
  的阻断。结论写入 [Claude Code 本地实测记录](../research/coding-agent-plugin-manifests/claude-code-local-tests.md)，
  并按结论更新 F-05-01 的能力数据（`promptGate`、`hookTimeoutSeconds`）与命令 hooks 声明第 2 节的
  `SessionEnd`。入口前提没有结论时，本工单不开始实现 F-05-04。
- rolldown 1.2 以虚拟模块提供 `uapa:guard` 与 `uapa:target-data`，以常量替换写入
  `__UAPA_PLUGIN_NAME__` 与 `__UAPA_MODULE_SESSION_ENV__`；先用一个最小入口实测输出为 ES2022 ESM
  单文件、只保留 `node:` 导入。
- `bundle` 按 `import.meta.url` 定位 `src/runtime/`；源码运行时定位到 `.ts` 文件，`dist/` 中定位到
  编译后的文件（F-10-05 验证后者）。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 是 | F-03-13 的单元测试；入口用例：守卫抛错、返回值无效、缺少会话 id 时执行前检查以退出码 2 拒绝，原因符合 F-04-03、F-04-04 |
| 产物零依赖 | 是 | 打包后的入口只含 `node:` 导入（TA-01 的解析检查）；`external` 为 `'node'` 时出现其他导入则打包失败的单元测试 |
| 不在运行时推断宿主 | 是 | `claude-code-subprocess.ts` 只读 `CLAUDE_PLUGIN_DATA` 与去重变量；单元测试在设置 `PLUGIN_DATA` 时输出不变 |
| 确定性输出 | 是 | `single-claude` 夹具逐字节比对，含打包后的 `.mjs` |
| 不越权写入 | 是 | 停机计数只写入 `dataDir` 下的 `uapa-stop-<会话 id>.json`；会话 id `x/../y` 的用例（TA-16） |
| 安装不运行脚本 | 否 | |
| 能力数据有出处 | 是 | TA-15 结论写入调研文档后再改能力数据，数据模块的出处与核对日期随之更新 |

## 任务

### 1. 守卫运行时（`src/runtime/core/`、`src/runtime/entries/subprocess.ts`）

- 工具名换算与 `shell` 入参换算（F-04-01）、改写的反向换算与降级（F-04-02）。
- `decisions.ts`：返回值检查与 `guardErrorReason`（F-04-04）。
- `runSubprocessEntry`：参数与 stdin、`parse`、`skip`、调用守卫、异常收口、停机计数（F-04-03～F-04-05）。

### 2. 打包（`src/bundle/`）

- `bundle`（F-04-06）与 `src/runtime/entries/bundle-names.d.ts`；构建编排把它传给宿主模块。

### 3. 能力检查与宿主校验（`src/build/`）

- 守卫能力检查与降级、残余风险（F-03-13）；写出后调用 `verify`（F-03-14）。

### 4. Claude Code 命令 hooks（`src/targets/claude-code/`、`src/runtime/entries/claude-code-subprocess.ts`）

- `hooks/hooks.json` 的 `hooks` 键（F-05-03）；子进程协议与入口（F-05-04）；`verify` 调用
  `claude plugin validate --strict`（F-05-09）。去重变量在只配置本目标时为 `null`。

### 5. 夹具

- 加入 `single-claude` 与 `verify-failed`；入口用例覆盖放行、拒绝、改写、缺少会话 id，以及
  TA-16 的停机序列（写成 `node --test` 测试代码）。

### 不改的地方（红线）

- M1-02 的四个夹具持续通过，期望产物不变。
- `src/runtime/core/` 不做 I/O、不引用 Node 类型（`tsc -p tsconfig.runtime-core.json` 通过）。
- 入口源码之间互不导入；`src/targets/` 不打包进产物。

### 测试

- 单元：换算（含 `host:<原名>`）、`checkBeforeTool` 等三个检查函数的每个失败分支、F-03-13 的
  能力组合（合成能力数据，TA-04）、打包的外部导入检查、`verify` 的三种结果（PATH 中无 `claude`
  为 `skipped`）。
- TA-02：另以只包含引用 `process` 的测试文件的临时配置运行 `tsc`，断言报错。
- 夹具：`single-claude`、`verify-failed` 比对与入口用例；TA-16 的计数序列 1、2、0、1。

## 验收

```bash
pnpm check
node --test test/fixtures/fixtures.test.ts test/runtime/stop-state.test.ts
```

另运行一次宿主校验（宿主实测，维护者本机）：

```bash
claude plugin validate --strict <single-claude 的产物目录>
```

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 最终实现方案、关键技术决策及其验证依据；
3. 主要改动点与涉及模块清单；
4. 测试覆盖、宿主实测结果、判断范围（夹具与单元测试 / 宿主实测）和已知限制；
5. 如适用，附生成的 manifest、hooks 配置或入口的输入输出示例。

## 边界

- 允许新增与修改：`src/runtime/`、`src/bundle/`、`src/build/`、`src/targets/claude-code/`、
  `src/capabilities/claude-code-subprocess.ts`、`test/`；TA-15 结论涉及的调研文档、F-05-01、
  命令 hooks 声明第 2 节。
- 禁止修改：`src/config/` 的配置语义与 M1-02 夹具的期望产物。

## 依赖

M1-02；TA-15 中 Claude Code 的入口前提有结论。
