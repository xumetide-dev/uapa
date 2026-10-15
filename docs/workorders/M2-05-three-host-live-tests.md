# 施工单 M2-05：三个宿主的安装与会话实测

> 在 Claude Code、Codex 与 agy 中安装夹具产物并运行会话，关闭 Sprint M1 收口 §4 第 2～4 行的
> 宿主实测欠账（TA-11、TA-12、Codex 安装），并确认 v0.2.0 的 agents、MCP 服务器与执行后检查
> 在三个宿主中生效。结果写入调研文档的实测小节。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M2-00](M2-00-v0-2-0-three-host-completion.md) |
| 覆盖功能点 | 无（TA-11、TA-12 与 v0.2.0 产物的宿主实测；功能由 M2-02～M2-04 实现） |
| 依赖工单 | [M2-02](M2-02-after-tool-end-to-end.md)、[M2-04](M2-04-mcp-servers.md) |
| 关联 issue | 无 |
| 验收文件 | [M2-05](../acceptance/M2-05-three-host-live-tests.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 已有且够用：
  - 容器 `shell` 中 Claude Code 2.1.296 以 `claude setup-token` 的令牌完成 `claude -p`，
    codex-cli 0.162.1 以 API key 的 provider 完成 `codex exec`，agy 1.3.5 使用认证卷中的登录，
    见[容器测试「认证」](../../test/container/README.md#认证)。
  - TA-11 已在容器中覆盖同一会话的去重，见
    [双形态去重的会话实测](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#双形态去重的会话实测)。
  - 7 个 Claude Code 插件目录在容器中通过 `validate --strict`，见
    [M1-07 验收 §3](../acceptance/M1-07-claude-code-hooks-module.md#3-自动化验证汇总可复跑)。
- 已有但不对：TA-12 要求的 `overrides/claude-code/hooks/*.test.ts` 不在任何夹具中，
  `claude plugin test` 没有可运行的测试，见
  [M1-07 验收 §7](../acceptance/M1-07-claude-code-hooks-module.md#7-已知限制与技术债) 第 2 行。
- 完全没有：嵌套会话与 `/clear`、`/resume`、`/branch` 之后的去重实测；在 Codex 中安装插件、
  信任 hooks 后的会话；agy 中安装 `full` 产物后的会话；v0.2.0 产物在三个宿主中的实测。

## ⚠️ 关键落地约束（必须先验证）

- **真实会话只在容器中运行**：`test/container/run.sh shell <命令>` 非交互地运行；`claude -p`
  同时写 `--permission-mode default` 与 `--allowedTools`，停机实测限制工具。提示只要求模型运行
  标记命令（如 `echo uapa-deny-probe`）；守卫的拒绝与改写只匹配标记命令。
- **交互式步骤**（`/clear`、`/resume`、`/branch`，在 Codex 的 `/hooks` 中信任）：先在容器中以
  tmux 驱动交互式会话；无法驱动时停在该步，由维护者在本机操作并回报结果。
- **Codex CLI**：每次使用前请维护者确认（`AGENTS.md`）；未确认时 Codex 的各项保持未实测，本单
  结论不能为「通过」。
- **agy 的插件安装**：只在容器中进行，安装前确认没有并发的 agy 会话，结束后卸载；不删除认证卷
  `uapa-test-auth`。
- **MCP 服务器**：实测用的服务器为夹具中的最小 stdio 服务器，只响应初始化与工具列表，不执行
  命令；远程服务器指向不存在的本地地址，只核对配置是否被读取。
- **TA-12 的本机运行**：`claude plugin validate --strict` 与 `claude plugin test` 不启动会话，在
  维护者机器上对 `mkdtemp` 中的产物副本运行。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 是 | 宿主实测：三个宿主中拒绝的标记命令不执行且原因可见；执行后检查扣留含标记的输出，模型读不到原文 |
| 产物零依赖 | 否 | |
| 不在运行时推断宿主 | 否 | |
| 确定性输出 | 否 | |
| 不越权写入 | 否 | |
| 安装不运行脚本 | 否 | |
| 能力数据有出处 | 是 | 实测结论写入调研文档后，能力数据的注释指向该小节；结论与能力数据不一致时先改调研文档再改能力数据，并重跑 TA-09 |

## 任务

### 1. Claude Code（`claude-code-local-tests.md`）

- TA-11：在会话的 Bash 中启动嵌套会话，确认嵌套会话的命令 hooks 不被误跳过；`/clear`、
  `/resume`、`/branch` 之后同一事件仍只由模块执行。
- TA-12：`claude-both` 夹具加入 `overrides/claude-code/hooks/` 下的 `*.test.ts`（拒绝、放行、
  停机继续与提示阻断各一例）；对 Claude Code 夹具产物运行 `claude plugin validate --strict` 与
  `claude plugin test`，容器与维护者机器各一次。
- v0.2.0：加载 `after-tool` 产物，确认两种形态的扣留与替换生效；加载 `components` 产物，会话的
  初始化信息列出 agents 与 MCP 服务器。

### 2. Codex（`codex-plugins.md`）

- 承接 Sprint M1 收口 §4 第 3 行：安装 `full` 的 Codex 产物，在 `/hooks` 中信任后运行最小会话，
  确认拒绝的标记命令不执行且原因可见。
- v0.2.0：`after-tool` 的扣留生效；`components` 的 MCP 服务器被加载。
- 承接 [M2-01 验收 §7](../acceptance/M2-01-v0-2-0-host-facts.md#7-已知限制与技术债) 第 2 行：
  manifest 写 `"mcpServers": {}` 且插件目录中另有 `.mcp.json` 时，Codex 不加载其中的服务器。

### 3. agy（`agy-plugins.md`）

- 安装 `full` 的 agy 产物，确认拒绝、改写与停机继续的标记命令按 F-11-04 生效。
- v0.2.0：`components` 的 agents 与 MCP 服务器被加载；被列为跳过的服务器不出现。
- 承接 [M2-01 验收 §7](../acceptance/M2-01-v0-2-0-host-facts.md#7-已知限制与技术债) 第 1 行：
  根 `agents.json` 与 `agents/*.md` 同时存在时加载哪些子代理。

### 4. 能力数据与文档

- 实测结论与能力数据或接口文档不一致时，先改调研文档，再按 M2-01 的规则改能力数据与受影响的
  夹具，写入验收 §5。

### 不改的地方（红线）

- 除 `claude-both` 加入 TA-12 的测试文件外，不改夹具的源项目；该夹具的期望产物只增加覆盖文件
  与报告的 `overridden` 条目。
- 不修改 `test/container/run.sh` 的启动参数，不挂载宿主目录。
- 不在宿主机上运行真实代理会话。

### 测试

- 宿主实测：上述各项的命令、宿主版本与结论写入调研文档；拒绝与改写只用标记命令。
- 夹具：`claude-both` 的比对与入口用例在加入测试文件后通过。

## 验收

```bash
pnpm check
node --test test/fixtures/fixtures.test.ts
```

宿主实测（容器 `shell`，Claude Code 2.1.296、codex-cli 0.162.1、agy 1.3.5）：按任务第 1～3 项
运行，记录写入调研文档。维护者机器：对 `claude-both` 的 Claude Code 产物运行
`claude plugin validate --strict` 与 `claude plugin test`。

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 每项宿主实测的步骤、宿主版本、观察到的输出与结论；
3. 调研文档、能力数据与夹具的改动清单；
4. 判断范围（夹具与单元测试 + 宿主实测）和仍未实测的项。

## 边界

- 允许新增与修改：`docs/research/coding-agent-plugin-manifests/`、`test/fixtures/claude-both/`、
  实测需要时的 `src/capabilities/` 取值与受影响夹具。
- 禁止修改：`test/container/run.sh` 的隔离参数；其他夹具的源项目。

## 依赖

M2-02、M2-04 的产物；维护者确认 Codex CLI 的使用；交互式步骤无法在容器中驱动时由维护者操作。
