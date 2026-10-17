# 施工单 M3-02：agy 根 `agents.json` 与停机前检查的超时

> 以 agy 内嵌文档给出的格式重测插件根 `agents.json`，并实测 `Stop` hook 超时与输出无法解析时的
> 处理，关闭 [Sprint M2 收口 §4](../acceptance/M2-00-v0-2-0-three-host-completion.md#4-技术债入账)
> 第 2 行与能力数据中 agy `beforeStop` 超时的“未实测”。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M3-00](M3-00-three-host-live-test-gaps.md) |
| 覆盖功能点 | 无（TA-15 与 agents 的宿主实测） |
| 依赖工单 | 无 |
| 关联 issue | 无 |
| 验收文件 | [M3-02](../acceptance/M3-02-agy-agents-json-stop-timeout.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 已有且够用：`agents/*.md` 按 frontmatter 的 `name` 加载（M2-05，agy 1.3.5）；`PreToolUse` 的
  出错、超时与无效输出，`Stop` 的退出码 1 已实测，见
  [agy「本地实测」](../research/coding-agent-plugin-manifests/agy-local-tests.md#本地实测)。
- 已有但不对：M2-05 试过的三种 `agents.json` 写法（`[{"path": "extra"}]`、
  `{"agents": [{"path": "extra"}]}`、`["extra"]`）都不是 agy 的格式，结论记为“格式未能确定”。
  agy 1.3.5 内嵌文档写明 `skills.json`、`agents.json` 等共用一种格式：顶层 `entries` 与
  `inherits`，条目为 `path` 加可选的 `include_only`、`exclude`，目录条目只扫描一层。
- 完全没有：`Stop` 超时与输出无法解析的实测；`src/capabilities/agy-subprocess.ts` 的
  `beforeStop` 超时记为放行，注释为“超时未实测”。

## ⚠️ 关键落地约束（必须先验证）

- **只在容器 `shell` 中安装与运行**：每次 `run.sh shell` 是新容器，插件安装不保留；不删除认证卷
  `uapa-test-auth`。模型为 `gemini-3.8-flash-high`。
- **故障 hook 无害**：超时的 hook 只等待，输出无法解析的 hook 只打印非 JSON 文本；会话中只运行
  标记命令。
- `entries` 格式仍不加载其声明的子代理时，记录写法与 `agy plugin list --json` 的输出，结论写为
  “1.3.5 中插件根 `agents.json` 不加载子代理”，不再继续猜测格式。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 是 | 宿主实测：`Stop` 超时与输出无法解析时的处理写入调研文档；与能力数据的 `failureDefault.beforeStop` 一致，或按实测修改并使构建报告的残余风险随之更新 |
| 产物零依赖 | 否 | |
| 不在运行时推断宿主 | 否 | |
| 确定性输出 | 否 | |
| 不越权写入 | 否 | |
| 安装不运行脚本 | 否 | |
| 能力数据有出处 | 是 | `agy-subprocess.ts` 的 `beforeStop` 注释指向本单的实测小节；取值改动时重跑 TA-09 与夹具比对 |

## 任务

### 1. 根 `agents.json`（`agy-plugins.md`）

- 插件含 `agents/a.md` 与 `extra/b.md`，根 `agents.json` 写 `{"entries": [{"path": "extra"}]}`；另一
  副本写 `{"entries": [{"path": "extra", "include_only": ["b"]}]}`。安装后以打印模式询问可用的
  子代理，并运行 `agy plugin list --json`。
- 结论替换调研文档中 `agents.json` 并存一行与“格式未能确定”的说明。UAPA 不生成 `agents.json`，
  本单不改构建；`agents.json` 能加载时在调研文档写明覆盖文件可以提供它。

### 2. `Stop` 的超时与无效输出（`agy-plugins.md`）

- 临时插件的 `Stop` hook（`timeout` 为 3）分别运行等待 10 秒的脚本与打印非 JSON 文本的脚本；
  记录本轮是否结束、模型是否收到继续的原因、日志中的错误。
- 结论填入调研文档失败处理表的 `Stop` 列与「本地实测」的未测清单。

### 3. 能力数据（`src/capabilities/agy-subprocess.ts`）

- 实测与 `beforeStop: { error: 'allow', timeout: 'allow' }` 一致时只改注释；不一致时按 M2-01 的
  规则改取值与受影响的夹具，并在总览追加发布工单。

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

宿主实测（容器 `shell`，agy 1.3.5）：按任务 1、2 运行，记录写入调研文档。

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 每项实测的写法、命令、观察到的输出与结论；
3. 调研文档与能力数据的改动；
4. 判断范围和已知限制。

## 边界

- 允许新增与修改：`docs/research/coding-agent-plugin-manifests/agy-plugins.md`、
  `src/capabilities/agy-subprocess.ts`、实测要求时受影响夹具的期望产物、`docs/acceptance/`。
- 禁止修改：夹具的源项目；`test/container/run.sh`。

## 依赖

无。
