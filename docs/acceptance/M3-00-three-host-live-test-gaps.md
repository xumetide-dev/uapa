# Sprint 收口 M3-00：三个宿主的遗留实测

> Sprint M2 收口 §4 的两项与角色审计中只有源码核对的宿主行为都已实测：会话 Bash 中启动的嵌套
> 会话、agy 根 `agents.json` 与 `Stop` 的超时和无效输出、Codex 的提示阻断与 hook 出错和超时。
> 结论与能力数据一致，能力数据只更新出处注释，本 Sprint 不发布。

| 项 | 内容 |
|---|---|
| 对应总览 | [M3-00](../workorders/M3-00-three-host-live-test-gaps.md) |
| 工单数 | 3 |
| 收口日期 | 2026-10-15 |
| 结论 | 通过 |
| 判断范围 | 宿主实测 |
| commit | 待回填 |
| 完成判定 | 验了 6 条 / 共 6 条 |

> 结论只取 通过 / 有条件通过（<条件>）/ 不通过 / 待定；任一工单 §0 有「是」时只能是「不通过」。
> 判断范围按各工单如实汇总。commit 为收口文件本身的提交，回填单独一个提交。

## 1. Sprint 完成判定逐条

> 条目逐条复制自总览「Sprint 完成判定」表，不增不删不改写。⏳ 的条目「去向」必填。

| # | 判定条目 | 实际 | 证据 | 状态 | 去向 |
|---|---|---|---|---|---|
| 1 | `pnpm check` 通过：两套 `tsc` 配置、Biome、`node --test`、功能清单关系检查 | 两次 `tsc` 无错误，Biome 检查 182 个文件无问题，`node --test` 247 pass / 0 fail，“93 个功能，18 条用户故事，20 项技术验收，关系检查通过” | 以 `test/container/run.sh check` 在容器中运行（M3-03 提交后） | ✅ | — |
| 2 | TA-11：在外层会话的 Bash 中启动的嵌套会话里，命令 hooks 不被误跳过，同一事件只处理一次 | 内层会话继承外层会话 id 作为去重变量；只有命令 hooks 的内层会话由命令入口拒绝标记命令并写出本会话的计数文件；两种形态都加载的内层会话只由模块拒绝，没有命令入口的计数文件 | [M3-01 验收](M3-01-claude-code-nested-session.md)（宿主实测，维护者机器，Claude Code 2.1.296） | ✅ | — |
| 3 | agy：以 `entries` 格式写的根 `agents.json` 是否加载其声明的子代理、停机前检查超时时的处理，均有实测结论 | `entries` 中目录的子代理与 `agents/*.md` 一起加载，`include_only` 按子代理名或文件名过滤；`Stop` 超时与输出无法解析时本轮照常结束 | [M3-02 验收](M3-02-agy-agents-json-stop-timeout.md)（宿主实测，agy 1.3.5） | ✅ | — |
| 4 | Codex：提示阻断不调用模型且原因可见；四个事件的 hook 出错与超时时的处理有实测结论 | 含标记的提示被拦下，token 为 0，TUI 显示原因（exec 只显示 `Blocked`）；四个事件以 1 退出、超时时都放行，工具输出保留 | [M3-03 验收](M3-03-codex-prompt-gate-hook-failures.md)（宿主实测，codex-cli 0.162.1） | ✅ | — |
| 5 | 能力数据与实测结论一致，注释指向实测小节；有改动时 TA-09 与夹具比对通过 | 取值都未改；agy 的 `beforeStop`、Codex 的 `promptGate` 与 `failureDefault` 注释指向本 Sprint 的实测；TA-09 与夹具比对照常通过 | `src/capabilities/agy-subprocess.ts`、`codex-subprocess.ts`；`pnpm check` 247 pass | ✅ | — |
| 6 | M3-01～M3-03 的验收结论均为通过，表头有 commit 号 | 3 张都为通过，表头都有 commit 号 | 各验收文件表头 | ✅ | — |

## 2. 工单一览

| 工单 | 名称 | 验收结论 | commit | 验收文件 |
|---|---|---|---|---|
| M3-01 | Claude Code 嵌套会话 | 通过 | `c0672e8` | [M3-01](M3-01-claude-code-nested-session.md) |
| M3-02 | agy 根 `agents.json` 与停机前检查的超时 | 通过 | `a5a9a81` | [M3-02](M3-02-agy-agents-json-stop-timeout.md) |
| M3-03 | Codex 提示阻断与 hook 出错、超时 | 通过 | `671d4f6` | [M3-03](M3-03-codex-prompt-gate-hook-failures.md) |

## 3. 功能点汇总

> 总览声明的每个功能点在收口时的状态，取自各验收文件 §2；声明了却没有验收覆盖的功能点在此列出。

总览不声明功能点，三张单都是宿主实测。Sprint M2 收口中为 ⚠️ 的 `F-05-08` 由 M3-01 关闭：嵌套会话
与 `/clear`、`/resume`、`/branch` 之后的去重都已实测。

## 4. 技术债入账

> 各验收文件 §7 中尚未关闭、去向为后续 Sprint 或未定的条目在此汇总；不属于任何 Sprint 的记入
> [`tech-debt.md`](tech-debt.md)。一票否决项不入本表。

| # | 债 | 出自 | 去向 |
|---|---|---|---|
| — | 无 | — | — |

## 5. 回流

- [x] `README.md` 验收索引已更新
- [x] 功能清单中受影响的功能条目、范围决策与技术验收的状态描述已同步（F-11-01 的验收要点改为
      `beforeStop` 出错与超时都为本地实测；角色审计 P-01 改为 PASS，P-04 写明 TA-15 各项已实测）
- [x] 各验收 §7 的去向已写入接手的施工单或 `tech-debt.md`（三张单的 §7 都没有条目；Sprint M2 收口
      §4 的两行已关闭）

## 6. 下一步

- Sprint M3 没有留下欠账，`src/` 只有注释改动，不发布 v0.2.1。
