# 施工单 M1-04：agy 目标

> 构建 `agy:subprocess`：能力数据、根 `plugin.json`、根 `hooks.json`、子进程入口与字段白名单检查
> （功能模块 11）。入口前提与失败默认已于 agy 1.3.4 实测，本工单不等待宿主实测。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M1-00](M1-00-v0-1-0-three-host-build.md) |
| 覆盖功能点 | `F-11-01`、`F-11-02`、`F-11-03`、`F-11-04`、`F-11-05` |
| 依赖工单 | [M1-03](M1-03-claude-code-command-hooks-guard.md) |
| 关联 issue | 无 |
| 验收文件 | [M1-04](../acceptance/M1-04-agy-target.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 完全没有：`src/targets/agy/`、`src/capabilities/agy-subprocess.ts`、
  `src/runtime/entries/agy-subprocess.ts`；`agy:subprocess` 与 `agy` 未在
  `src/config/targets.ts` 登记。
- 已有（M1-03）：`runSubprocessEntry`、`bundle`、能力检查与 `claude-code` 宿主模块，可作为
  宿主模块与协议实现的参照。
- 宿主事实：[agy](../research/coding-agent-plugin-manifests/agy-plugins.md)。stdin 为 camelCase，
  会话 id 为 `conversationId`，工具为 `toolCall.name`、`toolCall.args`，shell 命令字段为
  `CommandLine`；`PreToolUse` 的 stdout 必须是含 `decision` 的 JSON，否则阻断。

## ⚠️ 关键落地约束（必须先验证）

- 放行输出与公共部分的约定不同（入口与打包接口第 3 节的 agy 例外）：`allow` 由协议实现返回
  stdout，公共部分不得假定放行时 stdout 为空。实现前确认 M1-03 的 `runSubprocessEntry` 原样输出
  协议返回的 `ProcessOutput`。
- 停机计数目录为系统临时目录下的 `uapa-<插件名>/`（SD-06），测试以 `TMPDIR` 指定。
- 产物可选做一次宿主实测：把 `full` 形态的守卫构建为 agy 插件，安装后用打印模式让代理执行
  一条被拒绝的命令，确认原因出现在输出中，然后卸载。插件安装在用户级目录、对该用户的全部
  agy 会话生效，实测前确认本机没有其他 agy 会话在运行。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 是 | 入口用例：守卫抛错、缺少 `conversationId`、缺少 `toolCall.args.CommandLine` 时执行前检查输出 `decision: "deny"` |
| 产物零依赖 | 是 | 打包后的 `hooks/uapa-agy.mjs` 只含 `node:` 导入 |
| 不在运行时推断宿主 | 是 | 入口不读 `ANTIGRAVITY_CONVERSATION_ID` 与其他宿主的变量；设置这些变量时输出不变 |
| 确定性输出 | 是 | 生成的 `plugin.json`、`hooks.json` 与期望文本逐字比对 |
| 不越权写入 | 是 | 停机计数只写入 `TMPDIR` 下的 `uapa-<插件名>/` |
| 安装不运行脚本 | 否 | |
| 能力数据有出处 | 是 | 数据模块写 1.3.4、核对日期 2026-10-14 与出处 `agy-plugins.md`；未实测的 `Stop` 超时注明“未实测” |

## 任务

### 1. 目标登记与能力数据（`src/config/`、`src/capabilities/`）

- `src/config/targets.ts` 登记 `agy:subprocess` 与 `agy`；`src/config/types.ts` 的 `hosts` 加
  `agy`（只有 `dir`）。
- 能力数据 `src/capabilities/agy-subprocess.ts`（F-11-01），在 `src/capabilities/index.ts` 登记。

### 2. 宿主模块（`src/targets/agy/`）

- 根 `plugin.json`（F-11-02）、根 `hooks.json`（F-11-03）、字段白名单检查（F-11-05）；在
  `src/targets/index.ts` 登记。

### 3. 子进程入口（`src/runtime/entries/agy-subprocess.ts`）

- 协议实现与入口（F-11-04）：`parse`、`allow`、`deny`、`rewriteShell`、`continueStop`、`dataDir`。

### 不改的地方（红线）

- M1-02、M1-03 的夹具与期望产物不变。
- `src/runtime/entries/subprocess.ts` 的公共部分不为 agy 增加宿主分支；差异只写在协议实现中。

### 测试

- 单元：协议的 `parse`、`allow`（执行前与停机前两种输出）、`deny`、`rewriteShell`、
  `continueStop`、`dataDir`；`plugin.json` 的名称检查；白名单检查对每类额外字段失败。
- 构建：以临时源项目只配置 `agy:subprocess`，断言产物文件集合为 `plugin.json`、`hooks.json`、
  `hooks/uapa-agy.mjs` 与 `skills/`，并以 `process.execPath` 运行入口的放行、拒绝、改写、停机继续
  四个用例。

## 验收

```bash
pnpm check
node --test test/targets/agy.test.ts
```

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 最终实现方案、关键技术决策及其验证依据；
3. 主要改动点与涉及模块清单；
4. 测试覆盖、宿主实测结果、判断范围（夹具与单元测试 / 宿主实测）和已知限制；
5. 如适用，附生成的 manifest、hooks 配置或入口的输入输出示例。

## 边界

- 允许新增与修改：上述文件与 `test/`。
- 禁止修改：`claude-code` 宿主模块与公共部分的行为。

## 依赖

M1-03。
