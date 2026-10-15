# 施工单 M3-01：Claude Code 嵌套会话

> 在外层会话的 Bash 中启动嵌套会话，确认嵌套会话的命令 hooks 不被误跳过、同一事件只处理一次，
> 关闭 TA-11 的最后一项（[Sprint M2 收口 §4][m2-debt] 第 1 行）。

[m2-debt]: ../acceptance/M2-00-v0-2-0-three-host-completion.md#4-技术债入账

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M3-00](M3-00-three-host-live-test-gaps.md) |
| 覆盖功能点 | 无（TA-11 的宿主实测） |
| 依赖工单 | 无 |
| 关联 issue | 无 |
| 验收文件 | [M3-01](../acceptance/M3-01-claude-code-nested-session.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 已有且够用：
  - 模块在 `session.start` 与 `classic.SessionStart` 中把 `UAPA_MODULE_SESSION_BOTH_GUARD` 写为
    当前会话 id，命令入口在该变量等于 stdin 的 `session_id` 时跳过（`claude-both` 夹具的入口用例）。
  - `/clear`、`/resume`、`/branch`、`--resume`、`--fork-session` 之后的去重已实测，见
    [双形态去重的会话实测](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#双形态去重的会话实测)。
- 已有但不够：嵌套会话只以父会话的变量值由脚本启动；在会话的 Bash 中启动的 `claude -p` 在容器中
  未登录。Claude Code 2.1.296 对子进程环境去掉一组凭据变量（含 `CLAUDE_CODE_OAUTH_TOKEN`），
  `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=0` 时 Bash 工具中仍没有该变量（容器实测）。
- 宿主事实：维护者机器的 Claude Code 2.1.296 以钥匙串登录，嵌套会话不依赖环境变量中的令牌。

## ⚠️ 关键落地约束（必须先验证）

- **在维护者机器上运行**：容器中嵌套会话无法登录，本单的会话在维护者机器上运行（`AGENTS.md`
  「宿主机上」）。外层与内层会话都写 `--permission-mode default`、只含标记命令的
  `--allowedTools`、`--setting-sources project` 与 `--strict-mcp-config`（不加载用户级设置、
  插件与 MCP 服务器）；工作目录、插件副本与脚本在 `mkdtemp` 中；提示只要求运行
  `bash nested.sh` 与 `echo uapa-deny-probe`。
- **宿主写入的位置**：Claude Code 照常在用户目录下写会话记录与插件数据目录；本单不删除这些文件
  （宿主机上不删除测试临时目录以外的文件），在调研文档中写明位置。
- 内层会话未登录或外层会话没有运行 `bash nested.sh` 时停在该步，TA-11 的该项保持 ⚠️。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 是 | 宿主实测：嵌套会话中拒绝的标记命令不执行；只加载命令 hooks 的内层会话由命令入口拒绝并写出本会话的停机计数文件 |
| 产物零依赖 | 否 | |
| 不在运行时推断宿主 | 否 | |
| 确定性输出 | 否 | |
| 不越权写入 | 否 | |
| 安装不运行脚本 | 否 | |
| 能力数据有出处 | 是 | 结论写入 `claude-code-local-tests.md` 的去重实测小节；与能力数据或入口行为不一致时先改调研文档，再改入口并重跑夹具 |

## 任务

### 1. 嵌套会话（`claude-code-local-tests.md`）

- 以 `claude-both` 夹具的 Claude Code 产物在 `mkdtemp` 中建两份副本：两种形态都有的副本 A；删去
  `hooks/register.ts` 的副本 B（只剩命令 hooks，模拟内层会话中模块未生效）。
- 外层会话加载副本 A，以 Bash 工具运行 `bash nested.sh`。脚本记录 Bash 工具环境中的
  `UAPA_MODULE_SESSION_BOTH_GUARD`，再依次启动两个内层会话，都要求运行 `echo uapa-deny-probe`：
  - 内层加载副本 B：命令入口拒绝该命令，插件数据目录中有内层会话 id 的停机计数文件（不被误跳过）。
  - 内层加载副本 A：模块拒绝该命令，插件数据目录中没有内层会话 id 的命令入口计数文件（只处理
    一次）。
- 结果写入调研文档的去重实测小节，替换“嵌套会话的登录”与“嵌套会话的命令 hooks”两行。

### 2. 功能清单与验收回流

- TA-11 的两项都有宿主实测后，关闭
  [M2-05 验收 §7](../acceptance/M2-05-three-host-live-tests.md#7-已知限制与技术债) 第 1 行与
  Sprint M2 收口 §4 第 1 行的去向。

### 不改的地方（红线）

- 不改 `src/` 与夹具；实测发现入口缺陷时另立工单。
- 宿主机上不运行标记命令以外的命令，不安装插件到用户级配置。

### 测试

- 宿主实测：两个内层会话的输出与插件数据目录中的计数文件按任务 1 的预期出现。

## 验收

```bash
pnpm check
```

宿主实测（维护者机器，Claude Code 2.1.296，钥匙串登录）：按任务 1 运行，记录写入调研文档。

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 外层与内层会话的命令、观察到的输出与计数文件；
3. 调研文档的改动；
4. 判断范围和已知限制。

## 边界

- 允许新增与修改：`docs/research/coding-agent-plugin-manifests/claude-code-local-tests.md`、
  `docs/acceptance/`。
- 禁止修改：`src/`、`test/`。

## 依赖

维护者机器上已以钥匙串登录 Claude Code 2.1.296。
