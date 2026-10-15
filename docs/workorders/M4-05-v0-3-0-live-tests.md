# 施工单 M4-05：v0.3.0 产物的宿主实测

> 在测试容器中以宿主加载 `rules-commands` 与 `guard-options` 的产物，确认 rules、commands 与
> 守卫选项在会话中按调研结论生效（TA-24）。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M4-00](M4-00-v0-3-0-rules-commands-guard-options.md) |
| 覆盖功能点 | 无（TA-24） |
| 依赖工单 | [M4-02](M4-02-rules-and-commands.md)、[M4-04](M4-04-guard-options.md) |
| 关联 issue | 无 |
| 验收文件 | [M4-05](../acceptance/M4-05-v0-3-0-live-tests.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 已有且够用：容器 `shell` 中有 Claude Code 2.1.296 与 agy 1.3.5，认证方式见
  [容器测试「认证」](../../test/container/README.md#认证)；以产物副本做会话实测的先例见
  [Claude Code「UAPA 夹具产物」](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#uapa-夹具产物)
  与 [agy「UAPA 夹具产物（1.3.5，容器）」](../research/coding-agent-plugin-manifests/agy-plugins.md#uapa-夹具产物135容器)。
- 完全没有：v0.3.0 产物（agy 的 rules、Claude Code 的 commands 与 `userConfig`）在宿主会话中的
  记录。
- 宿主事实：调研时的探测插件为手写，本单以 UAPA 的产物复测。

## ⚠️ 关键落地约束（必须先验证）

- **只在容器 `shell` 中安装与运行**：每次 `run.sh shell` 是新容器，安装不保留；不删除认证卷
  `uapa-test-auth`。会话的提示只要求回复探测词或运行标记命令（`echo uapa-deny-probe` 一类）。
- **产物取自夹具的期望树**：复制 `test/fixtures/<夹具>/expected/tree/` 中的插件目录，不在会话中
  重新构建；`guard-options` 的守卫只拒绝标记命令。
- **用户设置取值走 marketplace 安装**：`--plugin-dir` 加载读不到保存的取值（已实测），设置取值的
  用例以本地 marketplace 安装产物副本。
- 结论与调研不一致时，先更新调研文档，再判断是否修改能力数据或生成逻辑；需要修改实现时停在
  本单并报告。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 是 | 宿主实测：设置取值前后的会话中，标记命令都被拒绝，原因中的取值分别为默认值与设置的值 |
| 产物零依赖 | 否 | 不改产物 |
| 不在运行时推断宿主 | 否 | 不改入口 |
| 确定性输出 | 否 | 不改构建 |
| 不越权写入 | 否 | 不改构建 |
| 安装不运行脚本 | 否 | 不改 `package.json` |
| 能力数据有出处 | 是 | 实测结论写入调研文档后，能力数据的出处注释指向该小节 |

## 任务

### 1. agy（容器）

- 安装 `rules-commands` 的 agy 插件目录，按调研的做法提问：`always` 的规则直接生效；`model` 的
  规则在允许读文件时生效；`glob` 的规则在读取匹配两个模式之一的文件后生效。

### 2. Claude Code（容器）

- `--plugin-dir` 加载 `rules-commands` 的 Claude Code 插件目录，调用两个命令。
- 对 `guard-options` 的 Claude Code 插件目录运行 `claude plugin validate --strict`；以本地
  marketplace 安装，设置取值前后各运行一次会话，要求运行标记命令；两种形态分别测（副本去掉
  `modules` 时只有命令 hooks）。

### 3. 记录

- 结果写入 [agy 调研](../research/coding-agent-plugin-manifests/agy-plugins.md) 与
  [Claude Code 本地实测记录](../research/coding-agent-plugin-manifests/claude-code-local-tests.md)
  的「UAPA 夹具产物」小节；能力数据的出处注释按需更新。

### 不改的地方（红线）

- 不改 `src/` 的生成逻辑；实测结论要求修改时停下报告。
- 会话中只运行标记命令。

### 测试

- 宿主实测：上文三项，记录宿主版本、日期、做法与结果。

## 验收

```bash
test/container/run.sh check
```

宿主实测（需要容器中的 Claude 令牌与 agy 登录）：

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

- 允许新增与修改：调研文档的实测小节、能力数据的出处注释。
- 禁止修改：生成逻辑、夹具的期望产物。

## 依赖

M4-02、M4-04 的产物；容器中的 Claude 令牌与 agy 登录（由用户准备，已在 Sprint M3 中可用）。
