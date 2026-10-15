# 施工单 M1-06：合并布局、覆盖文件、比对与命令 hooks

> 补齐构建编排的其余能力：合并布局、覆盖目录、`uapa build --check`、配置中声明的命令 hooks，
> 并加入三个子进程目标的夹具（里程碑 M4 的其余部分）。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M1-00](M1-00-v0-1-0-three-host-build.md) |
| 覆盖功能点 | `F-01-06`、`F-03-06`、`F-03-08`、`F-03-12`、`F-09-04`、`F-01-09`、`F-03-15`、`F-05-15`、`F-06-08`、`F-11-06` |
| 依赖工单 | [M1-04](M1-04-agy-target.md)、[M1-05](M1-05-codex-target.md) |
| 关联 issue | 无 |
| 验收文件 | [M1-06](../acceptance/M1-06-layout-overrides-check-command-hooks.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 完全没有：覆盖目录读取与应用、合并布局写出、比对模式、`--check` 选项、`commandHooks` 的校验
  与写入。M1-02 的默认布局写出与 M1-03～M1-05 的三个子进程目标已完成。
- 规则已定义：写出、比对与退出码（模块接口 §8）、插件目录解析（§2）、命令 hooks
  （[命令 hooks 声明](../architecture/command-hooks.md)）。

## ⚠️ 关键落地约束（必须先验证）

- 比对模式要与实际构建清空后的结果一致：部分目标失败时按成功目标的产物计算 `removed`
  （模块接口 §8）。先写比对与写出共用的“计划写出的文件集合”，两者都从它得出。
- 合并布局中 agy 与 Codex 的根 `plugin.json` 冲突，提示取 F-11-02 的 `conflictHint`；Codex 未设
  `hooksFile` 时与 Claude Code 的 `hooks/hooks.json` 冲突，提示取 F-06-03 的 `conflictHint`。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 是 | `throwing-guard` 与 `requires-missing` 夹具（TA-03、TA-04） |
| 产物零依赖 | 否 | |
| 不在运行时推断宿主 | 是 | TA-05：`full` 之前以三个子进程目标的入口用例各运行两次，输出逐字一致 |
| 确定性输出 | 是 | 夹具逐字节比对 |
| 不越权写入 | 是 | 合并布局不删除目录中的其他文件、冲突时不写入（TA-07 的单元部分）；`--check` 前后目录快照一致（TA-08 的单元部分） |
| 安装不运行脚本 | 否 | |
| 能力数据有出处 | 是 | 三个子进程目标的 `commandHookEvents` 取自命令 hooks 声明第 2 节 |

## 任务

### 1. 覆盖目录（`src/source/`、`src/build/`）

- 读取 `overrides/<宿主>/`（F-01-06）；未配置宿主的覆盖目录为输入问题。
- 写出前应用覆盖文件，报告记入 `overridden`（F-03-12）。

### 2. 合并布局与比对（`src/build/`、`src/cli/`）

- 合并布局写出（F-03-06）：冲突时不写入，保留目录中的无关文件。
- 比对模式（F-03-08）与 `uapa build --check`（F-09-04），与写出共用“计划写出的文件集合”。

### 3. 命令 hooks（`src/config/`、`src/build/`、三个子进程宿主模块）

- 配置校验（F-01-09）、承载检查（F-03-15）、写入 `claude-code:subprocess`（F-05-15）、
  `codex:subprocess`（F-06-08）与 `agy:subprocess`（F-11-06）的 hooks 配置。

### 4. 夹具

- 加入 `throwing-guard`、`requires-missing`、`unknown-override`。

### 不改的地方（红线）

- 已有夹具与期望产物不变。
- 默认布局的清空规则与路径校验（SD-14）不变。

### 测试

- 单元：合并布局的冲突、新增文件、无关文件保留；覆盖文件写入报告的 `overridden`；比对的
  `added`、`modified`、`removed` 与排序；`commandHooks` 每条校验失败的字段路径；承载检查的失败与
  跳过两种结果。
- 夹具：三个里程碑 M4 夹具的比对与入口用例。
- 承接 [M1-03 验收 §7](../acceptance/M1-03-claude-code-command-hooks-guard.md#7-已知限制与技术债) 第 1 行（比对模式实现后）：
  `--check` 模式不调用宿主模块的 `verify`，各目标报告的 `hostValidation` 为 `none`。
- 承接 [M1-04 验收 §7](../acceptance/M1-04-agy-target.md#7-已知限制与技术债) 第 1 行（合并布局实现后）：
  agy 与 Claude Code 共用插件目录时，`agy:subprocess` 的残余风险写明安装命令是否把含 `.claude-plugin/`
  的目录按 Claude Code 插件转换未实测（F-11-03）；`HostInput` 目前不含插件目录布局，宿主模块需由构建
  编排得知与哪些宿主共用目录。

## 验收

```bash
pnpm check
node --test test/fixtures/fixtures.test.ts
```

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 最终实现方案、关键技术决策及其验证依据；
3. 主要改动点与涉及模块清单；
4. 测试覆盖、宿主实测结果、判断范围（夹具与单元测试 / 宿主实测）和已知限制；
5. 如适用，附生成的 manifest、hooks 配置或入口的输入输出示例。

## 边界

- 允许新增与修改：`src/config/`、`src/source/`、`src/build/`、`src/cli/`、三个子进程宿主模块中
  命令 hooks 的写入、`test/`。
- 禁止修改：入口协议与决策输出。

## 依赖

M1-04、M1-05。
