# 施工单 M5-07：v0.4.0 产物的宿主实测

> 在测试容器中，用 v0.4.0 的产物复测本 Sprint 的换算与新字段（TA-27）：
> - Claude Code：经生成的 marketplace 安装 `host-coverage`；复测共用文件、三种规则、`Monitor` 的
>   守卫与 `onFailure`。
> - agy：安装 `rules-commands` 并调用复制的命令。
> - Codex：同类实测须维护者确认后进行。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M5-00](M5-00-v0-4-0-host-coverage.md) |
| 覆盖功能点 | 无（TA-27） |
| 依赖工单 | [M5-02](M5-02-shared-files-and-claude-code-config.md)、[M5-03](M5-03-converted-rules-and-commands.md)、[M5-04](M5-04-mcp-server-environment.md)、[M5-05](M5-05-guard-reliability-and-risks.md)、[M5-06](M5-06-marketplace-files.md) |
| 关联 issue | 无 |
| 验收文件 | [M5-07](../acceptance/M5-07-v0-4-0-live-tests.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 已有且够用：
  - M4-05 的容器实测步骤：Claude Code 以 `--plugin-dir` 与本地 marketplace 加载，agy 以
    `agy plugin install` 安装。
  - `test/container/run.sh shell` 的认证卷。
- 已有但不对：无。
- 完全没有：v0.4.0 产物的会话实测。
- 宿主事实：以 M5-01 写入调研文档的 TA-25 结论为对照。

## ⚠️ 关键落地约束（必须先验证）

- **只用无害的探测**：
  - 守卫只匹配标记命令；`Monitor` 运行的也是标记命令。
  - 共用文件中的服务器只报告自身已启动，不读取环境变量的值。
  - `claude -p` 同时写 `--permission-mode default` 与 `--allowedTools`。
- **`onFailure` 的实测**：用覆盖目录把入口替换为以退出码 1 结束的脚本，只在容器中进行，提示
  只要求运行标记命令。
- **Codex**：使用 Codex CLI 须维护者确认；未确认时本单只记录 Claude Code 与 agy 的结果，Codex
  写明待确认。验收结论按实际覆盖的范围写判断范围。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 是 | 宿主实测：`Monitor` 运行的标记命令被拒绝；入口无法启动时 `onFailure` 阻断标记命令 |
| 产物零依赖 | 否 | 不改产物 |
| 不在运行时推断宿主 | 否 | 不改入口 |
| 确定性输出 | 否 | 不改生成逻辑 |
| 不越权写入 | 否 | 不改写出 |
| 安装不运行脚本 | 否 | 不改 `package.json` |
| 能力数据有出处 | 是 | 实测结论写入调研文档；与能力数据不符时先改调研文档再改数据，并在验收 §5 写明 |

## 任务

### 1. Claude Code（容器，2.1.296）

- 用生成的 `.claude-plugin/marketplace.json` 添加 marketplace 并安装 `host-coverage`。
- 确认 `files/` 中的服务器启动。
- 用 `rules-commands` 确认三种规则生效：
  - `always` 规则在首个回复中可见。
  - `glob` 规则在读取匹配文件后加载。
  - `model` 规则按描述加载。
- `Monitor` 运行标记命令时被拒绝。
- `onFailure` 在入口无法启动时阻断标记命令。

### 2. agy（容器，1.3.5）

- 安装 `rules-commands`，以 `/<插件名>:<命令名>` 调用复制的命令。

### 3. Codex（须维护者确认）

- 确认后：用生成的 `.agents/plugins/marketplace.json` 安装，信任 hooks，确认 `always` 规则注入、
  规则技能可调用、`env_vars` 中的变量传给服务器。

### 4. 回填

- 结论写入调研文档；与 TA-25 不一致时，更新功能条目、能力数据与受影响的夹具，在验收 §5 写明。

### 不改的地方（红线）

- 不改 `test/container/run.sh` 的启动参数，不在维护者机器上安装插件。
- 夹具的期望产物只在实测推翻 TA-25 的结论时更新。

### 测试

- 宿主实测：任务 1～3 的每一项写明命令、提示与输出摘要（不含令牌与环境变量的值）。

## 验收

```bash
test/container/run.sh check
```

宿主实测（前置：容器中有 Claude 令牌与 agy 登录；Codex 须维护者确认）：

```bash
test/container/run.sh shell
```

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 最终实现方案、关键技术决策及其验证依据；
3. 主要改动点与涉及模块清单；
4. 测试覆盖、宿主实测结果、判断范围和已知限制；
5. 如适用，附生成的产物或入口的输入输出示例。

## 边界

- 允许新增与修改：`docs/research/coding-agent-plugin-manifests/`；实测推翻结论时的能力数据、
  功能条目与夹具。
- 禁止修改：`test/container/run.sh` 的启动参数、用户级宿主配置（容器外）。

## 依赖

M5-02～M5-06 的产物；容器中的 Claude 令牌与 agy 登录；Codex 实测须维护者确认。
