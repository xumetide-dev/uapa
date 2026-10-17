# 施工单 M3-03：Codex 提示阻断与 hook 出错、超时

> 在 Codex 中实测 UAPA 的提示提交前检查（`UserPromptSubmit` 以退出码 2 阻断），以及四个事件的
> hook 出错、超时与输出无法解析时的处理，关闭角色审计 P-01、P-04 中 Codex 只有源码核对的各项。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M3-00](M3-00-three-host-live-test-gaps.md) |
| 覆盖功能点 | 无（TA-15 的宿主实测） |
| 依赖工单 | 无 |
| 关联 issue | 无 |
| 验收文件 | [M3-03](../acceptance/M3-03-codex-prompt-gate-hook-failures.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 已有且够用：Codex 0.162.1 中安装 `full` 与 `after-tool` 产物、在 TUI 中信任 hooks 后，执行前
  检查、改写、停机继续与执行后检查生效，见
  [Codex「容器实测（0.162.1）」](../research/coding-agent-plugin-manifests/codex-local-tests.md#容器实测01621)。
- 已有但只有源码核对：`UserPromptSubmit` 以退出码 2 且 stderr 非空阻断、不调用模型；退出码 2 而
  stderr 为空、其他退出码、超时、启动失败按放行处理；`PostToolUse` 失败时原输出保留，见
  [Codex 源码核对](../research/coding-agent-plugin-manifests/codex-source-review.md)。
  `src/capabilities/codex-subprocess.ts` 的 `failureDefault` 四项都为放行，注释为“（TA-15）”。
- 构建报告：`full` 的 `codex:subprocess` 列出三条“缺少 Node ≥ 22 或入口无法启动时 … 不生效”的
  残余风险。

## ⚠️ 关键落地约束（必须先验证）

- **Codex CLI**：按[容器测试「认证」](../../test/container/README.md#codex)的 provider 配置运行，
  API key 只由 CLI 读取；信任 hooks 的 TUI 以 tmux 驱动，加 `--no-daemon`。
- **探测插件的 hooks 配置在信任后不变**：探测插件在 `PreToolUse`、`UserPromptSubmit`、
  `PostToolUse`、`Stop` 上运行同一个脚本（`timeout` 为 3），脚本按插件目录中的模式文件选择正常、
  以 1 退出、等待 10 秒或打印非 JSON 文本；只在 TUI 中信任一次，之后只改模式文件。改模式文件后
  hooks 不再运行时，改为每种模式各信任一次。
- **故障 hook 无害**：探测脚本只记录 stdin 与退出，会话中只运行 `echo uapa-deny-probe > deny.txt`
  这类标记命令。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 是 | 宿主实测：`full` 的提示阻断不调用模型且原因可见；hook 出错与超时时的处理与构建报告的残余风险一致 |
| 产物零依赖 | 否 | |
| 不在运行时推断宿主 | 否 | |
| 确定性输出 | 否 | |
| 不越权写入 | 否 | |
| 安装不运行脚本 | 否 | |
| 能力数据有出处 | 是 | `codex-subprocess.ts` 的 `promptGate` 与 `failureDefault` 注释指向本单的实测小节；取值改动时重跑 TA-09 与夹具比对 |

## 任务

### 1. 提示阻断（`codex-plugins.md`）

- 安装 `full` 的 Codex 产物并信任 hooks，以 `codex exec` 提交含 `API_KEY=uapa-prompt-probe` 的
  提示：记录提示是否被拦下、原因是否可见、是否产生模型回复；另提交不含标记的提示作对照。

### 2. hook 出错、超时与无效输出（`codex-plugins.md`）

- 以探测插件按模式各运行一次 `codex exec`，提示要求运行 `echo uapa-deny-probe > deny.txt`：
  - 以 1 退出：命令是否执行（`deny.txt` 是否存在）、提示是否送达模型、本轮是否照常结束、
    工具输出是否保留。
  - 等待 10 秒（超过 `timeout`）：同上，另记录 hook 被终止的日志。
  - 打印非 JSON 文本：`PreToolUse` 与 `PostToolUse` 的处理。
- 结论写入调研文档「容器实测（0.162.1）」的表格。

### 3. 能力数据与角色审计

- 实测与能力数据一致时只改 `codex-subprocess.ts` 的注释；不一致时按 M2-01 的规则改取值与受影响的
  夹具，并在总览追加发布工单。
- 角色审计 P-01、P-04（`docs/feature-list/stories.md`）中 Codex 的描述按实测更新。

### 不改的地方（红线）

- 不修改夹具的源项目；能力数据取值不变时期望产物不变。
- 不修改 `test/container/run.sh` 的启动参数。

### 测试

- 宿主实测：任务 1、2 各项的输出写入调研文档。
- 能力数据有改动时：`pnpm check` 中 TA-09 与夹具比对通过。

## 验收

```bash
pnpm check
```

宿主实测（容器 `shell`，codex-cli 0.162.1）：按任务 1、2 运行，记录写入调研文档。

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 每项实测的命令、观察到的输出与结论；
3. 调研文档、能力数据与角色审计的改动；
4. 判断范围和已知限制。

## 边界

- 允许新增与修改：`docs/research/coding-agent-plugin-manifests/codex-plugins.md`、
  `src/capabilities/codex-subprocess.ts`、`docs/feature-list/stories.md`、实测要求时受影响夹具的期望
  产物、`docs/acceptance/`。
- 禁止修改：夹具的源项目；`test/container/run.sh`。

## 依赖

容器测试「认证」中 Codex 的 provider 配置与 API key 环境变量。
