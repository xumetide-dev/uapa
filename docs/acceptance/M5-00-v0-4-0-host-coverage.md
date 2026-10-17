# Sprint 收口 M5-00：v0.4.0 三个宿主的承载补全

> rules 与 commands 的换算承载、共用文件 `files/`、MCP 环境变量声明 `envVars` 与目标限定 `targets`、
> Claude Code 与 Codex 的 marketplace 文件、Claude Code manifest 透传与 `onFailure: 'block'`、守卫
> 可靠性与残余风险补全、三宿主合并布局 `.antigravity-plugin/plugin.json`、命令 hooks 单条 `timeout`
> 以及子进程守卫 `ctx.cwd` 与 `node:fs`/`node:path` 导入均已实现，352 个单元与夹具测试通过；agy
> 1.3.5 会话实测与 Claude Code 2.1.296 严格校验及本地 marketplace 安装已通过。欠两项：Claude Code
> 夹具产物的 `claude -p` 会话复测与 2.1.300 升级复测、Codex CLI 会话实测（待订阅与维护者确认就绪后
> 补测）。本 Sprint 不发布。

| 项 | 内容 |
|---|---|
| 对应总览 | [M5-00](../workorders/M5-00-v0-4-0-host-coverage.md) |
| 工单数 | 8 |
| 收口日期 | 2026-10-17 |
| 结论 | 有条件通过（M5-07 中 Claude Code 夹具产物会话复测与 2.1.300 升级复测、Codex CLI 会话实测待订阅与维护者确认就绪后补测） |
| 判断范围 | 夹具与单元测试 + 宿主实测 |
| commit | `cb0ba4b` |
| 完成判定 | 验了 6 条 / 共 6 条 |

> 结论只取 通过 / 有条件通过（<条件>）/ 不通过 / 待定；任一工单 §0 有「是」时只能是「不通过」。
> 判断范围按各工单如实汇总。commit 为收口文件本身的提交，回填单独一个提交。

## 1. Sprint 完成判定逐条

> 条目逐条复制自总览「Sprint 完成判定」表，不增不删不改写。⏳ 的条目「去向」必填。

| # | 判定条目 | 实际 | 证据 | 状态 | 去向 |
|---|---|---|---|---|---|
| 1 | `pnpm check` 通过：两套 `tsc` 配置、Biome、`node --test`、功能清单关系检查 | 两套 `tsc` 配置无错误，Biome 检查无问题，`node --test` 352 pass / 0 fail，“136 个功能，28 条用户故事，27 项技术验收，关系检查通过” | 以 `test/container/run.sh check` 在容器中运行（`776b444` 之后） | ✅ | — |
| 2 | [夹具表](../feature-list/modules/10-repo-release.md#夹具) 的全部夹具（含新增的 `host-coverage`，以及更新后的 `rules-commands`、`command-hooks`、`merged`）比对与入口用例通过 | 21 个夹具（含 `host-coverage`、`rules-commands`、`command-hooks`、`merged`）逐字节比对、导入检查与入口用例全部通过（21 pass / 0 fail） | `test/container/run.sh check`；[M5-08 验收](M5-08-merged-manifest-timeout-mcp-cwd.md) §3 | ✅ | — |
| 3 | TA-25 的结论写入调研文档；SD-38～SD-41、SD-43、SD-47～SD-50 的状态不再是待实测 | TA-25 结论已写入 `claude-code-local-tests.md`、`agy-local-tests.md`、`codex-source-review.md` 与 `uapa-hook-adapters.md`；SD-38～SD-41、SD-43、SD-47～SD-50 均已填入实测或源码核对结论（agy `PLUGIN_DATA` 不存在另立 SD-46 并将 F-11-13 改为预留） | [M5-01 验收](M5-01-v0-4-0-host-facts-and-interfaces.md)、[M5-08 验收](M5-08-merged-manifest-timeout-mcp-cwd.md)、[范围决策](../feature-list/scope-decisions.md) | ✅ | — |
| 4 | 能力数据的 `converted` 承载、新增的工具名与 agy 的宿主版本注明实测或源码核对出处 | Claude Code 与 Codex 的 `rules: 'converted'`、agy 的 `commands: 'package'`、`host.version: '1.3.5'`、Claude Code 的 `Monitor: 'shell'` 与 `NotebookEdit: 'edit_file'` 均带调研文档或源码出处注释 | `src/capabilities/` 四个文件 | ✅ | — |
| 5 | TA-27：换算的规则与命令、共用文件、marketplace 安装、`onFailure`、agy 的 `.antigravity-plugin/plugin.json` 合并布局与守卫 `ctx.cwd` 在宿主会话中按调研结论生效 | agy 1.3.5 会话中：`rules-commands` 的 `/rules-commands:review`、`host-coverage` 的 `files/scripts/server.mjs` 启动、MCP `args` 字面传递、环境继承与守卫 `ctx.cwd`、`merged` 的 `.antigravity-plugin/plugin.json` 三宿主合并布局与 `node:fs` + `ctx.cwd` 读取 `marker.txt` 均实测通过；Claude Code 2.1.296 中：`host-coverage`、`rules-commands`（三种换算规则）与 `merged` 的 `validate --strict` 及本地 marketplace 添加/安装通过；Claude Code 夹具产物会话复测、2.1.300 升级复测与 Codex CLI 会话实测待订阅与维护者确认就绪后补测 | [M5-07 验收](M5-07-v0-4-0-live-tests.md)（宿主实测，Claude Code 2.1.296、agy 1.3.5） | ⚠️ 部分（agy 会话与 Claude Code 校验/安装已实测；Claude Code 与 Codex 会话复测见 §4） | §4 第 1、2 项 |
| 6 | M5-01～M5-08 的验收结论均为通过（或有条件通过且条件写明去向），表头有 commit 号 | M5-01～M5-06、M5-08 共 7 张为通过，M5-07 为有条件通过（§7 两项去向见本文 §4）；8 张表头均有 commit 号 | 各验收文件表头与 §7 | ✅ | — |

## 2. 工单一览

| 工单 | 名称 | 验收结论 | commit | 验收文件 |
|---|---|---|---|---|
| M5-01 | v0.4.0 宿主事实与接口定稿 | 通过 | `0cbe6cb`、`745ab8e` | [M5-01](M5-01-v0-4-0-host-facts-and-interfaces.md) |
| M5-02 | 共用文件与 Claude Code 的配置字段 | 通过 | `25daca5` | [M5-02](M5-02-shared-files-and-claude-code-config.md) |
| M5-03 | rules 与 commands 的换算承载 | 通过 | `15afb6e`、`92264a1` | [M5-03](M5-03-converted-rules-and-commands.md) |
| M5-04 | MCP 服务器的环境变量与插件根 | 通过 | `2a1f79a` | [M5-04](M5-04-mcp-server-environment.md) |
| M5-05 | 守卫可靠性与残余风险 | 通过 | `1f2c616` | [M5-05](M5-05-guard-reliability-and-risks.md) |
| M5-06 | marketplace 文件 | 通过 | `ae73911` | [M5-06](M5-06-marketplace-files.md) |
| M5-08 | 合并布局 manifest、命令超时、MCP 目标过滤与守卫工作目录 | 通过 | `c116268` | [M5-08](M5-08-merged-manifest-timeout-mcp-cwd.md) |
| M5-07 | v0.4.0 产物的宿主实测 | 有条件通过（Claude Code 夹具产物会话复测与 2.1.300 升级复测、Codex CLI 会话实测待订阅与维护者确认就绪后补测） | `776b444` | [M5-07](M5-07-v0-4-0-live-tests.md) |

## 3. 功能点汇总

> 总览声明的每个功能点在收口时的状态，取自各验收文件 §2；声明了却没有验收覆盖的功能点在此列出。

| 功能点 | 状态 | 出自工单 |
|---|---|---|
| `F-01-12` 读取共用文件 | ✅ | M5-02 |
| `F-01-14` 校验 v0.4.0 的配置字段 | ✅ | M5-02 |
| `F-03-17` 放置共用文件 | ✅（agy 1.3.5 容器会话实测） | M5-02、M5-07 |
| `F-05-20` manifest 透传字段 | ✅（Claude Code 2.1.296 `validate --strict` 与安装实测） | M5-02、M5-07 |
| `F-05-25` 插件名按段检查保留词 | ✅ | M5-02 |
| `F-03-19` 换算承载的组件 | ✅ | M5-03 |
| `F-05-19` rules 的换算承载（Claude Code） | ✅（探测插件会话实测 + 夹具产物 `validate --strict`） | M5-03、M5-07 |
| `F-06-11` rules 的换算承载（Codex） | ✅（源码核对与入口用例） | M5-03 |
| `F-06-13` 逐个检查 commands 的转换 | ✅ | M5-03 |
| `F-11-11` commands 的承载（agy） | ✅（agy 1.3.5 容器会话实测） | M5-03、M5-07 |
| `F-01-13` 读取 MCP 服务器的环境变量声明 | ✅ | M5-04 |
| `F-05-26` MCP 服务器的环境变量声明（Claude Code） | ✅（探测插件会话实测 + 夹具产物 `validate --strict`） | M5-04、M5-07 |
| `F-06-12` MCP 服务器的环境变量与占位符（Codex） | ✅ | M5-04 |
| `F-11-12` MCP 服务器的插件根与环境变量（agy） | ✅（agy 1.3.5 容器会话实测） | M5-04、M5-07 |
| `F-05-21` 守卫条目的 `onFailure` | ✅（探测插件会话实测 + 夹具产物 `validate --strict`） | M5-05、M5-07 |
| `F-05-22` 换算 `Monitor` 与 `NotebookEdit` | ✅（探测插件会话实测 + 夹具入口用例） | M5-05 |
| `F-05-23` 补全 Claude Code 的残余风险 | ✅ | M5-05 |
| `F-06-14` `SessionEnd` 命令 hook 的超时上限 | ✅ | M5-05 |
| `F-06-16` 补全 Codex 的残余风险与技能名检查 | ✅ | M5-05 |
| `F-11-14` 更新 agy 的宿主版本并补全残余风险 | ✅ | M5-05 |
| `F-03-18` 写出 marketplace 文件 | ✅ | M5-06 |
| `F-05-24` 生成 `marketplace.json`（Claude Code） | ✅（Claude Code 2.1.296 `validate --strict`、`marketplace add` 与 `install` 实测） | M5-06、M5-07 |
| `F-06-15` 生成 `marketplace.json`（Codex） | ✅（源码核对与单元/夹具测试） | M5-06 |
| `F-01-15` 单条命令超时、MCP 服务器目标限定与 agy 清单路径 | ✅ | M5-08 |
| `F-02-06` 守卫上下文的工作目录字段 | ✅ | M5-08 |
| `F-03-20` 按目标筛选 MCP 服务器与根目录同名规则保护 | ✅ | M5-08 |
| `F-04-10` 子进程入口传入工作目录并放行文件与路径内置模块 | ✅（agy 1.3.5 容器会话实测） | M5-08、M5-07 |
| `F-05-27` 单条命令超时、MCP 用户配置占位符校验与工作目录提取（Claude Code） | ✅（Claude Code 2.1.296 `validate --strict` 与入口测试） | M5-08、M5-07 |
| `F-06-17` 单条命令超时、MCP 用户配置变量衔接与工作目录提取（Codex） | ✅ | M5-08 |
| `F-11-15` 合并布局清单路径、单条命令超时、MCP 用户配置剥离与工作目录提取（agy） | ✅（agy 1.3.5 容器会话实测） | M5-08、M5-07 |
| `F-11-13` 停机计数目录（M5-01 按实测改为预留，SD-46） | 预留 | M5-01 |

## 4. 技术债入账

> 各验收文件 §7 中尚未关闭、去向为后续 Sprint 或未定的条目在此汇总；不属于任何 Sprint 的记入
> [`tech-debt.md`](tech-debt.md)。一票否决项不入本表。

| # | 债 | 出自 | 去向 |
|---|---|---|---|
| 1 | Claude Code 夹具产物的 `claude -p` 会话复测（`rules-commands` 的三种换算规则、`host-coverage` 的 `Monitor` 拒绝与 `onFailure: "block"` 入口失败阻断）及容器内升级到 2.1.300 后的双形态去重会话复测尚未执行 | M5-03 §7 第 3 项、M5-05 §7 第 1 项、M5-07 §7 第 1 项 | 待 Claude Code 订阅与维护者升级确认就绪后在测试容器中补测（认证见[容器测试「认证」](../../test/container/README.md#认证)），补测后关闭本条与 M5-07 的条件 |
| 2 | Codex CLI 中经 `.agents/plugins/marketplace.json` 安装、信任 hooks、`always` 规则注入、规则技能调用与 `env_vars` 传递的会话实测尚未执行 | M5-03 §7 第 2 项、M5-04 §7 第 2 项、M5-06 §7 第 1 项、M5-07 §7 第 2 项 | 待 Codex 订阅与维护者确认使用 Codex CLI（`AGENTS.md`：逐次确认）后在测试容器中补测，补测后关闭本条与 M5-07 的条件 |

## 5. 回流

- [x] `README.md` 验收索引已更新
- [x] 功能清单中受影响的功能条目、范围决策与技术验收的状态描述已同步（SD-38～SD-50、
      F-01-12～F-01-15 等 30 个 v0.4.0 功能与预留的 F-11-13、角色审计 P-01/P-02/P-04）
- [x] 各验收 §7 的去向已写入接手的施工单或本文 §4（M5-02 §7 已由 M5-05/M5-06 关闭；M5-03
      §7 第 4 项与 M5-05 §7 第 2 项已由 M5-05/M5-08 关闭；M5-03/M5-04/M5-06 中 agy 会话与
      Claude Code 安装项已由 M5-07 关闭；其余待订阅补测项汇总于本文 §4）

## 6. 下一步

- 待 Claude Code 与 Codex 订阅及维护者确认就绪后，在测试容器中补跑 §4 两项会话复测并关闭收口条件。
- v0.4.0 是否发布由维护者决定：发布时一并更新 `README.md` 的宿主矩阵与版本路线图，创建与推送
  tag 各需维护者确认。
