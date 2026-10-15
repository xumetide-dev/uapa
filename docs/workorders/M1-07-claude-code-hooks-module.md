# 施工单 M1-07：Claude Code hooks 模块与四目标夹具

> 构建 `claude-code:in-process`，与命令 hooks 合为一个插件包并按会话去重（里程碑 M5）；
> 最后加入含四个目标的夹具，作为发布的前提。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M1-00](M1-00-v0-1-0-three-host-build.md) |
| 覆盖功能点 | `F-04-07`、`F-05-05`、`F-05-06`、`F-05-07`、`F-05-08`、`F-05-10`、`F-05-14` |
| 依赖工单 | [M1-03](M1-03-claude-code-command-hooks-guard.md)（四目标夹具另依赖 [M1-06](M1-06-layout-overrides-check-command-hooks.md)） |
| 关联 issue | 无 |
| 验收文件 | [M1-07](../acceptance/M1-07-claude-code-hooks-module.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 完全没有：`src/runtime/entries/claude-code-in-process.ts`、`claude-code-api.d.ts`、
  `src/capabilities/claude-code-in-process.ts`；`claude-code` 宿主模块只生成命令 hooks。
- 宿主事实：[Mods 指南](../research/coding-agent-plugin-manifests/claude-code-mods-guide.md)、
  [Claude Code 本地实测记录](../research/coding-agent-plugin-manifests/claude-code-local-tests.md)
  （两种形态在 2.1.296 上都执行，`$.env.set` 的变量出现在命令 hook 进程环境中）。

## ⚠️ 关键落地约束（必须先验证）

- `$.env.set` 的变量名与 `$.state` 的引用必须是字面量：先打包一个最小模块，运行
  `claude plugin validate --strict` 确认常量替换后的产物通过校验。
- `'claude-code'` 的类型只手写入口用到的部分；以 `tsconfig.runtime-core.json` 检查入口，不引用
  Node 类型。
- 四目标夹具（`full`、`merged`、`merged-conflict`、`targets-filter`、`command-hooks`）在 M1-06
  之后加入；若本工单早于 M1-06 完成 hooks 模块部分，夹具部分留到 M1-06 之后再提交，并在验收 §5
  写明。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 是 | TA-17：守卫抛错且未调用 `next` 时 `.catch` 返回 `{ deny }`、`{ drop }`；`classic.Stop` 不阻止结束 |
| 产物零依赖 | 是 | `hooks/uapa-guard.mjs` 只导入 `'claude-code'`，`hooks/register.ts` 只导入 `./uapa-guard.mjs`（TA-01） |
| 不在运行时推断宿主 | 是 | 去重只比较 `UAPA_MODULE_SESSION_<插件名>` 与 stdin 的 `session_id` |
| 确定性输出 | 是 | `in-process-only`、`claude-both` 与四目标夹具逐字节比对；TA-06 |
| 不越权写入 | 是 | TA-07、TA-08 的夹具部分 |
| 安装不运行脚本 | 否 | |
| 能力数据有出处 | 是 | `claude-code-in-process.ts` 写 2.1.296、核对日期与 Mods 指南出处 |

## 任务

### 1. 能力数据与打包（`src/capabilities/`、`src/bundle/`）

- 能力数据 `src/capabilities/claude-code-in-process.ts`（F-05-14）与登记。
- 打包 `external: 'claude-code'`（F-04-07）：产物只导入 `'claude-code'`。

### 2. hooks 模块入口（`src/runtime/entries/claude-code-in-process.ts`）

- 入口与 `hooks/register.ts`（F-05-05）、异常收口（F-05-06）、状态类型契约（F-05-07）。

### 3. 双形态去重与合包（`src/targets/claude-code/`）

- 双形态去重（F-05-08）与合为一个插件包（F-05-10）。

### 4. 夹具

- 加入 `in-process-only`、`claude-both`。
- M1-06 之后加入四目标夹具（`full`、`merged`、`merged-conflict`、`targets-filter`、
  `command-hooks`），完成 TA-05、TA-06、TA-07、TA-08、TA-16、TA-18 的夹具部分。

### 不改的地方（红线）

- `claude-code:subprocess` 单独配置时的产物不变（`single-claude` 夹具）。
- 子进程入口的公共部分不变。

### 测试

- TA-17：以 `node:module` 的解析钩子把 `'claude-code'` 解析到 `test/` 下的桩模块，逐一调用记录的
  处理函数。
- TA-02：`tsc -p tsconfig.runtime-core.json` 覆盖 `claude-code-in-process.ts`。
- 夹具：`in-process-only` 断言守卫文件不含 `$.env.set`；`claude-both` 的去重入口用例。
- 承接 [M1-02 验收 §7](../acceptance/M1-02-skills-end-to-end.md#7-已知限制与技术债) 第 3 行（同一宿主有两个目标后）：
  skill 只限定 `claude-code:subprocess` 时，`claude-code:in-process` 的报告记一条残余风险；
  同一宿主中一个目标失败时，该目标不进入插件目录，另一目标照常写出。
- 承接 [M1-06 验收 §7](../acceptance/M1-06-layout-overrides-check-command-hooks.md#7-已知限制与技术债) 第 1 行：
  同时配置两个 Claude Code 目标时，未写 `targets` 的 `SessionEnd` 声明列入 `claude-code:subprocess`
  的 `commandHooks`，`claude-code:in-process` 不承载也不写 `skipped`（F-03-15）。
- 承接 [M1-06 验收 §7](../acceptance/M1-06-layout-overrides-check-command-hooks.md#7-已知限制与技术债) 第 2 行：
  `claude-code:in-process` 的 `commandHookEvents` 全部为 `null`；声明的命令只写在 `hooks/hooks.json`
  的 `hooks` 键中，去重（F-05-08）不作用于这些条目（F-05-15）。

## 验收

```bash
pnpm check
node --test test/fixtures/fixtures.test.ts test/runtime/in-process.test.ts
```

宿主实测（维护者本机，不阻塞发布）：TA-11 在 Claude Code 中同时加载两种形态；TA-12 对夹具产物运行
`claude plugin validate --strict` 与 `claude plugin test`。

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 最终实现方案、关键技术决策及其验证依据；
3. 主要改动点与涉及模块清单；
4. 测试覆盖、宿主实测结果、判断范围（夹具与单元测试 / 宿主实测）和已知限制；
5. 如适用，附生成的 manifest、hooks 配置或入口的输入输出示例。

## 边界

- 允许新增与修改：`src/runtime/entries/claude-code-*`、
  `src/capabilities/claude-code-in-process.ts`、
  `src/targets/claude-code/`、`tsconfig.runtime-core.json` 的包含列表、`test/`。
- 禁止修改：其他宿主模块。

## 依赖

M1-03；四目标夹具另依赖 M1-06。
