# 施工单 M1-05：Codex 目标

> 构建 `codex:subprocess`：能力数据、`$schema` 格式的根 `plugin.json`、hooks 配置、子进程入口与
> 字段白名单检查（功能模块 06）。入口依赖 Codex 插件 hooks 的宿主实测。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M1-00](M1-00-v0-1-0-three-host-build.md) |
| 覆盖功能点 | `F-06-01`、`F-06-02`、`F-06-03`、`F-06-04`、`F-06-05` |
| 依赖工单 | [M1-03](M1-03-claude-code-command-hooks-guard.md) |
| 关联 issue | 无 |
| 验收文件 | [M1-05](../acceptance/M1-05-codex-target.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 完全没有：`src/targets/codex/`、`src/capabilities/codex-subprocess.ts`、
  `src/runtime/entries/codex-subprocess.ts`；`codex:subprocess` 与 `codex` 未登记。
- 宿主事实：[Codex](../research/coding-agent-plugin-manifests/codex-plugins.md)。插件 hooks
  只对 Codex 桌面端手动安装的插件生效，运行前需要持久化的 hook 信任；失败默认放行。
- 未核实（TA-15）：stdin 中会话 id、工具入参与提示文本的字段名；决策 JSON 的层级；插件 hooks
  文件的 JSON 结构；命令是否经 shell 执行（决定 `$PLUGIN_ROOT` 能否展开）；省略 matcher 时是否
  匹配全部工具；超时字段名与处理器字段集合；含 `modules` 键的 `hooks/hooks.json` 的处理。

## ⚠️ 关键落地约束（必须先验证）

- **Codex 的 TA-15 各项**：需要维护者在 Codex 桌面端手动安装一个记录输入的插件并信任其 hooks，
  运行一次最小会话后把记录交回。记录插件与操作步骤在本工单开始时准备；结论写入 Codex 调研
  文档。入口前提没有结论时，本工单停在该步，F-06-03 与 F-06-04 不开始实现；F-06-01、F-06-02
  可以先实现。
- stdin 层面的字段（会话 id、工具入参、决策 JSON）也可经 Codex CLI 的内联 hooks 实测，但 CLI
  不加载插件 hooks，插件 hooks 文件的结构与 `$PLUGIN_ROOT` 仍需桌面端；是否用 CLI 实测由维护者
  决定。
- 实测结论改变 F-06-03、F-06-04 的写法时，在同一提交中更新功能条目与期望产物。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 是 | 入口用例：守卫抛错与输入无法解析时以退出码 2 拒绝，stderr 非空；残余风险写明 `$PLUGIN_ROOT` 未展开时 Codex 按失败放行（实测结论前） |
| 产物零依赖 | 是 | 打包后的 `hooks/uapa-codex.mjs` 只含 `node:` 导入 |
| 不在运行时推断宿主 | 是 | 入口只读 `PLUGIN_DATA`；设置 `CLAUDE_PLUGIN_DATA` 时输出不变 |
| 确定性输出 | 是 | 生成文件与期望文本逐字比对 |
| 不越权写入 | 是 | 停机计数只写入 `PLUGIN_DATA` 所指目录 |
| 安装不运行脚本 | 否 | |
| 能力数据有出处 | 是 | 数据模块写 0.162.1、核对日期与出处；未实测的 `promptGate` 记为不支持 |

## 任务

### 1. 目标登记与能力数据（`src/config/`、`src/capabilities/`）

- 登记 `codex:subprocess` 与 `codex`；`hosts.codex` 的 `interface`、`hooksFile`。
- 能力数据 `src/capabilities/codex-subprocess.ts`（F-06-01）。

### 2. 宿主模块（`src/targets/codex/`）

- 根 `plugin.json`（F-06-02，不标为可合并）；hooks 配置与 `conflictHint`（F-06-03）；字段白名单
  检查（F-06-05）。

### 3. 子进程入口（`src/runtime/entries/codex-subprocess.ts`）

- 协议实现与入口（F-06-04）；字段名与决策 JSON 层级按 TA-15 的实测结论。

### 不改的地方（红线）

- 已有夹具与期望产物不变；公共部分不为 Codex 增加宿主分支。
- 不实现命名空间合并（F-03-07 为预留）。

### 测试

- 单元：协议各方法；`plugin.json` 的顶层键序与 `extensions.com.openai`；`hooksFile` 改变路径时
  `extensions.com.openai.hooks` 同步；白名单检查对额外字段失败。
- 构建：临时源项目只配置 `codex:subprocess`，运行入口的放行、拒绝、改写、停机继续用例。

## 验收

```bash
pnpm check
node --test test/targets/codex.test.ts
```

宿主实测（维护者在 Codex 桌面端）：安装构建出的插件，确认拒绝的命令不执行且原因可见。

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 最终实现方案、关键技术决策及其验证依据；
3. 主要改动点与涉及模块清单；
4. 测试覆盖、宿主实测结果、判断范围（夹具与单元测试 / 宿主实测）和已知限制；
5. 如适用，附生成的 manifest、hooks 配置或入口的输入输出示例。

## 边界

- 允许新增与修改：上述文件、`test/`、Codex 调研文档的实测结论与 F-06-03、F-06-04 的写法。
- 禁止修改：其他宿主模块。

## 依赖

M1-03；维护者完成 Codex 桌面端的实测步骤。
