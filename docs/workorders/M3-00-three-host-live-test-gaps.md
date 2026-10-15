# Sprint 总览 M3-00：三个宿主的遗留实测

> 本 Sprint 结束时，Sprint M2 收口 §4 的两项与角色审计 P-01、P-04 中未实测的宿主行为都有宿主
> 实测结论：Claude Code 在会话的 Bash 中启动的嵌套会话、agy 根 `agents.json` 与停机前检查的超时、
> Codex 的提示阻断与 hook 出错和超时时的处理。结论写入调研文档，能力数据与之一致。

| 项 | 内容 |
|---|---|
| Sprint 目标 | 三个宿主中尚未实测的宿主行为：TA-11 的嵌套会话；TA-15 中 agy 与 Codex 的剩余项；agy 根 `agents.json` |
| 范围来源 | [Sprint M2 收口](../acceptance/M2-00-v0-2-0-three-host-completion.md) §4；[角色审计](../feature-list/stories.md) P-01、P-04；SD-28 |
| 前置 | v0.2.0 已以 tag `v0.2.0` 发布；Sprint M2 收口为有条件通过 |
| 周期 | 2026-10-15 起，按工单顺序推进，不设截止日期 |
| 关联 issue | 无 |
| 收口文件 | `docs/acceptance/M3-00-three-host-live-test-gaps.md`（全部工单完成后建立） |

Sprint 编号 `M3` 与功能清单的里程碑 M1～M6 是两套编号；本目录提到功能清单里程碑时一律写
「里程碑 Mx」，工单编号写作 `M3-NN`。

## 目标与已定决策

- 目标仍只有 `claude-code:in-process`、`claude-code:subprocess`、`codex:subprocess`、
  `agy:subprocess`（SD-28），不新增功能点。
- 实测结论先写入调研文档。与能力数据一致时只改调研文档与能力数据的出处注释；不一致时按 M2-01
  的规则改能力数据与受影响的夹具，并在本表追加发布 v0.2.1 的工单。`src/` 只有注释改动时本
  Sprint 不发布。
- 真实会话在容器 `shell` 中运行；只有 M3-01 的嵌套会话在维护者机器上运行，原因与限制写在该单。
- 每张工单的验收结论下定后推送私有仓库的 `main`，并同步、推送公共仓库的 `main`。

## 现状（已定位）

2026-10-15 读出：

| 项 | 状态 |
|---|---|
| 检查 | `pnpm check`：Biome 182 个文件，`node --test` 247 pass / 0 fail；“93 个功能，18 条用户故事，20 项技术验收，关系检查通过” |
| 嵌套会话 | 已有但不够：容器中 Bash 工具启动的 `claude -p` 没有令牌。Claude Code 2.1.296 对子进程环境去掉一组凭据变量（含 `CLAUDE_CODE_OAUTH_TOKEN`），`CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=0` 时 Bash 工具中仍没有该变量（容器实测）；M2-05 改由脚本以父会话的变量值启动内层会话 |
| agy `agents.json` | 已有但不对：M2-05 试过的三种写法（数组、`{"agents": […]}`、字符串数组）都不是 agy 的格式。agy 1.3.5 内嵌文档写明 `skills.json`、`agents.json` 等共用一种格式：顶层 `entries` 与 `inherits`，条目为 `path` 加可选的 `include_only`、`exclude`，目录条目只扫描一层 |
| agy 停机前检查 | 出错时本轮照常结束（实测）；超时未实测，能力数据记为放行 |
| Codex | 执行前检查、改写、停机继续与执行后检查已于 0.162.1 实测（M2-05）；提示阻断（`UserPromptSubmit` 以退出码 2 阻断）与 hook 出错、超时时放行只有源码核对 |
| 宿主版本 | 容器与维护者机器：Claude Code 2.1.296；容器：codex-cli 0.162.1、agy 1.3.5 |

## 关键落地约束（必须先验证）

| 约束 | 验证方式 | 得不出结论时 |
|---|---|---|
| 维护者机器上的会话只运行无害命令 | M3-01 的外层与内层会话都以 `--permission-mode default` 与只含标记命令的 `--allowedTools` 运行，工作目录与插件副本在 `mkdtemp` 中 | 不运行，TA-11 的该项保持 ⚠️ |
| Codex 信任 hooks 之后，探测插件改模式文件不影响信任 | M3-03 探测插件的 hooks 配置信任一次，之后只改模式文件；先以正常模式确认 hooks 照常运行 | 改为每种模式各信任一次 |
| 故障入口不执行高危操作 | 出错入口只以非 0 退出，超时入口只等待；会话中只运行标记命令 | — |

## 工单构成

| 工单 | 名称 | 覆盖功能编号 | 依赖 | 可并行性 |
|---|---|---|---|---|
| [M3-01](M3-01-claude-code-nested-session.md) | Claude Code 嵌套会话 | 无（TA-11 的宿主实测） | 无 | 与 M3-02、M3-03 可并行 |
| [M3-02](M3-02-agy-agents-json-stop-timeout.md) | agy 根 `agents.json` 与停机前检查的超时 | 无（TA-15 与 agents 的宿主实测） | 无 | 与 M3-01、M3-03 可并行 |
| [M3-03](M3-03-codex-prompt-gate-hook-failures.md) | Codex 提示阻断与 hook 出错、超时 | 无（TA-15 的宿主实测） | 无 | 与 M3-01、M3-02 可并行 |

功能编号取自[功能清单](../feature-list/README.md)的模块文件。本表是本 Sprint 覆盖哪些功能、
工单之间如何依赖的权威源；工单表头与验收 §2 是它的副本，不一致时以本表为准。

## Sprint 完成判定

| # | 判定条目 | 证据形式 |
|---|---|---|
| 1 | `pnpm check` 通过：两套 `tsc` 配置、Biome、`node --test`、功能清单关系检查 | 命令输出与测试计数 |
| 2 | TA-11：在外层会话的 Bash 中启动的嵌套会话里，命令 hooks 不被误跳过，同一事件只处理一次 | 宿主实测记录 |
| 3 | agy：以 `entries` 格式写的根 `agents.json` 是否加载其声明的子代理、停机前检查超时时的处理，均有实测结论 | 宿主实测记录 |
| 4 | Codex：提示阻断不调用模型且原因可见；四个事件的 hook 出错与超时时的处理有实测结论 | 宿主实测记录 |
| 5 | 能力数据与实测结论一致，注释指向实测小节；有改动时 TA-09 与夹具比对通过 | 能力数据注释、`pnpm check` |
| 6 | M3-01～M3-03 的验收结论均为通过，表头有 commit 号 | 各验收文件 |

## 边界

- 不新增目标、组件与功能点；不改 v0.2.0 功能的语义。
- 不修改 `test/container/run.sh` 的隔离参数。
- 调研文档、能力数据与角色审计的改动随各单的实现提交，在验收 §5 写明。

## 依赖

- 维护者机器上已以钥匙串登录 Claude Code（M3-01）。
- 容器 `shell` 中的 Claude 令牌、agy 登录与 Codex provider 配置由用户准备。
