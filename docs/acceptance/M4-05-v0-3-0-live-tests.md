# 验收 M4-05：v0.3.0 产物的宿主实测

> 本文记录 M4-05 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M4-05](../workorders/M4-05-v0-3-0-live-tests.md) |
| 覆盖功能点 | 无（TA-24）（取自总览「工单构成」表） |
| 验收日期 | 2026-10-15 |
| 验收结论 | 通过 |
| 判断范围 | 宿主实测 |
| commit | `0a8438e`、`fca03ad` |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | 四个守卫会话中标记命令都未执行，模型读到拒绝原因（§1 第 1 行） |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | 会话使用夹具期望树中的产物副本，容器中未安装 UAPA；导入检查见 `test/container/run.sh check` |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | 本单不改构建；会话在临时目录中进行 |
| V4 | 能力数据含无出处的宿主行为 | 否 | 能力数据只改出处注释，指向 agy-plugins.md「rules（1.3.5，容器）」「UAPA 夹具产物（1.3.5，容器）」与 claude-code-local-tests.md「UAPA 夹具产物」 |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：守卫不静默失效 | 宿主实测：设置取值前后的会话中，标记命令都被拒绝，原因中的取值分别为默认值与设置的值 | `guard-options` 以本地 marketplace 安装，4 个会话（命令 hooks、hooks 模块各在设置前后一次）中 `echo uapa-deny-probe` 都未执行；设置前原因为 `uapa-guard: 拒绝标记命令 uapa-deny-probe（maxLength=200，strict_mode=true）`，以 `claude plugin configure --values-stdin` 设置后为 `x y=z: …（maxLength=64，strict_mode=false）` | claude-code-local-tests.md「UAPA 夹具产物」（宿主实测，Claude Code 2.1.296） | ✅ |
| 2 | 硬约束：能力数据有出处 | 实测结论写入调研文档后，能力数据的出处注释指向该小节 | `agy-subprocess.ts` 的 rules 注释写明 `globs` 按绝对路径匹配并指向两个实测小节；两个 Claude Code 能力数据的 commands 注释指向「UAPA 夹具产物」；取值未改 | `src/capabilities/` 三个文件（`fca03ad`） | ✅ |
| 3 | TA-24：宿主实测 | 施工单任务 1、2 的各项在容器会话中有结果，写入调研文档的「UAPA 夹具产物」小节 | agy：`always_on`、`model_decision` 生效；`glob` 在修正后读取 `a.ts`、`src/ui/b.tsx` 都生效，对照不生效。Claude Code：两个命令以 `--plugin-dir` 加载并调用；`guard-options` 通过 `validate --strict`，两种形态在设置前后的原因见第 1 行 | agy-plugins.md「UAPA 夹具产物（1.3.5，容器）」；claude-code-local-tests.md「UAPA 夹具产物」（宿主实测） | ✅ |

## 2. 功能点逐条验收

本单在总览「工单构成」表中不挂功能点，本节没有条目；交付以 §1 与 §3 判定。

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
test/container/run.sh check
```

```bash
test/container/run.sh shell
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `test/container/run.sh check` | 两套 `tsc` 通过，Biome 检查 205 个文件无问题，`node --test` 296 pass / 0 fail（20 个夹具），功能清单检查通过 | Docker |
| `test/container/run.sh shell`（Claude Code） | 2.1.296：两个命令的会话、`validate --strict` 与 4 个守卫会话的结果见 §1；安装与配置在同一容器中完成，结束时卸载 | Docker；容器中的 Claude 令牌 |
| `test/container/run.sh shell`（agy） | 1.3.5，`gemini-3.8-flash-high`：修正前后各一轮 5 个会话，另以手写的探测插件运行 2 轮 `globs` 路径匹配（共 7 个会话） | Docker；容器中的 agy 登录 |

## 4. 交付物

- `docs/research/coding-agent-plugin-manifests/agy-plugins.md`：「rules（1.3.5，容器）」增加含目录
  的 `globs` 模式与按绝对路径匹配的结论；「UAPA 夹具产物（1.3.5，容器）」增加 4 行 rules 结果。
- `docs/research/coding-agent-plugin-manifests/claude-code-local-tests.md`：「UAPA 夹具产物」增加
  commands 与守卫选项 4 行，「使用的命令」增加 `claude plugin configure`。
- `src/capabilities/` 三个文件的出处注释；`docs/feature-list/stories.md` 的角色审计 P-01、P-04。

## 5. 与计划的偏差

- 施工单写明“需要修改实现时停在本单并报告”。agy 的 `glob` 规则对 `src/**/*.tsx` 不生效，需要
  改生成逻辑：本单先把结论写入调研文档（`0a8438e`），修正按“已有同一件事的单就补那张单”记在
  M4-02（`04328f0`），再以修正后的产物复测。本单没有修改 `src/` 的生成逻辑与夹具。
- `rules-commands` 的 agy 规则正文没有探测词，会话改为要求模型逐字引用适用的规则，以正文是否
  出现判断；`globs` 的路径匹配另以手写的探测插件（正文含 `uapa-rule-<标记>`）确定。
- 修正后读取 `src/ui/b.tsx` 的 agy 会话给出回复后进程未退出，在测试容器中结束该进程后脚本继续；
  回复内容已完整写出。

## 6. 技术决策

| 决策 | 依据 | 回填状态 |
|---|---|---|
| 两种形态以两份副本分别安装：去掉 `modules` 只剩命令 hooks，去掉 `hooks` 只剩 hooks 模块 | 两种形态并存时由模块处理、命令入口跳过，不能区分原因来自哪一侧 | claude-code-local-tests.md「UAPA 夹具产物」 |
| 守卫会话以 `--permission-mode default --allowedTools "Bash(echo uapa-deny-probe)"` 运行 | 会话中只允许运行标记命令（`AGENTS.md`「实测补充」） | 同上 |
| 以 6 + 6 条 `globs` 不同的规则确定匹配方式，并在另一个工作区目录中重跑 | 区分按文件名、按工作区相对路径与按绝对路径匹配三种假设；含工作区目录名的模式只在原目录生效，排除按相对路径匹配 | agy-plugins.md「rules（1.3.5，容器）」 |

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- `**/` 前缀使含目录的模式也匹配其他位置的同名目录，构建报告已写为残余风险。
- 下一步：Sprint M4 收口（M4-00）。
