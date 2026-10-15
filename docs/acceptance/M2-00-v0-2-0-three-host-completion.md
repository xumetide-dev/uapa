# Sprint 收口 M2-00：v0.2.0 三个宿主的组件补全与稳定

> v0.2.0 的执行后检查、agents 与 MCP 服务器已为 Claude Code（两种形态）、Codex 与 agy 构建，并在
> 三个宿主的会话中生效；`v0.2.0` 已在公共仓库发布，从 GitHub 以 pnpm 与 npm 12 安装核验通过。
> 欠两项：TA-11 的嵌套会话未在会话的 Bash 中启动；agy 根 `agents.json` 的格式未能确定。

| 项 | 内容 |
|---|---|
| 对应总览 | [M2-00](../workorders/M2-00-v0-2-0-three-host-completion.md) |
| 工单数 | 6 |
| 收口日期 | 2026-10-15 |
| 结论 | 有条件通过（TA-11 的嵌套会话未在会话的 Bash 中启动；agy 根 `agents.json` 的格式未能确定；M2-01～M2-05 的验收结论为有条件通过，见 §1 第 7 行与 §4） |
| 判断范围 | 夹具与单元测试 + 宿主实测 |
| commit | `f014728` |
| 完成判定 | 验了 7 条 / 共 7 条 |

> 结论只取 通过 / 有条件通过（<条件>）/ 不通过 / 待定；任一工单 §0 有「是」时只能是「不通过」。
> 判断范围按各工单如实汇总。commit 为收口文件本身的提交，回填单独一个提交。

## 1. Sprint 完成判定逐条

> 条目逐条复制自总览「Sprint 完成判定」表，不增不删不改写。⏳ 的条目「去向」必填。

| # | 判定条目 | 实际 | 证据 | 状态 | 去向 |
|---|---|---|---|---|---|
| 1 | `pnpm check` 通过：两套 `tsc` 配置、Biome、`node --test`、功能清单关系检查 | 两次 `tsc` 无错误，Biome 检查 182 个文件无问题，`node --test` 247 pass / 0 fail，“93 个功能，18 条用户故事，20 项技术验收，关系检查通过” | 收口时以 `test/container/run.sh check` 在容器中运行；[M2-06 验收 §3](M2-06-release-v0-2-0.md#3-自动化验证汇总可复跑) | ✅ | — |
| 2 | [夹具表](../feature-list/modules/10-repo-release.md#夹具) 的全部夹具（含本 Sprint 新增的夹具）比对与入口用例通过 | 夹具表的 18 个夹具（本 Sprint 新增 `after-tool` 与 `components`）都在 `test/fixtures/` 中，`fixtures.test.ts` 18 pass / 0 fail | 收口时以 `test/container/run.sh exec node --test test/fixtures/fixtures.test.ts` 运行 | ✅ | — |
| 3 | v0.2.0 的宿主事实在调研文档中有结论；能力数据的 `replaceOutput`、`withholdOutput` 与组件承载注明实测或源码出处 | Claude Code 于 2.1.296 实测，agy 于 1.3.5 实测，Codex 按 rust-v0.162.1 源码核对，结论写入各宿主调研文档；能力数据的注释指向 `claude-code-local-tests.md`「执行后检查」「MCP 服务器与 agents」、`codex-source-review.md` 的同名各节与 agy 的本地实测；M2-05 的宿主实测与能力数据一致，能力数据未改 | [M2-01 验收](M2-01-v0-2-0-host-facts.md)；`src/capabilities/*.ts` 的注释；[M2-05 验收 §1](M2-05-three-host-live-tests.md#1-验收要点逐条) 第 2 行 | ✅ | — |
| 4 | Sprint M1 收口 §4 第 2～4 行关闭：TA-11（嵌套会话与 `/clear`）、TA-12（`validate --strict` 与 `claude plugin test`）、在 Codex 中安装 `full` 产物并信任 hooks 后拒绝标记命令 | 第 2 行：`claude-both` 产物在容器与维护者机器（macOS）的 Claude Code 2.1.296 中通过 `validate --strict`，`claude plugin test` 5 pass。第 3 行：Codex 0.162.1 中安装 `full`、信任 hooks 后拒绝的标记命令不执行且原因可见，改写与停机继续同样生效。第 4 行：`--resume`、`--fork-session`、`/clear`、`/branch`、`/resume <id>` 之后同一事件只由模块执行（实测发现 `/branch` 与 `/resume` 之后去重变量仍为旧会话 id，`7bff5c2` 修复后复测）；嵌套会话只以父会话的变量值由脚本启动内层会话 | [M2-05 验收 §2](M2-05-three-host-live-tests.md#2-功能点逐条验收)（宿主实测） | ⚠️ 仅嵌套会话未在会话的 Bash 中启动 | §4 第 1 行 |
| 5 | v0.2.0 的产物在三个宿主的会话中生效：agents 与 MCP 服务器被加载，执行后检查扣留含标记的输出 | Claude Code 列出 `components:reviewer`，agy 列出 `agy-helper` 与 `reviewer`（Codex 的插件不承载 agents）；三个宿主加载生成的 MCP 服务器，被跳过的服务器不出现，Codex 与 agy 按插件目录解析 `./mcp/server.mjs`；Claude Code 两种形态与 Codex 中模型只读到扣留原因或替换文本（agy 不能扣留，不生成执行后检查） | [M2-05 验收 §2](M2-05-three-host-live-tests.md#2-功能点逐条验收)（宿主实测）；三份调研文档的实测小节 | ✅ | — |
| 6 | 发布脚本生成 `v0.2.0` tag，TA-14 与安装冒烟通过；推送后从 GitHub 以 pnpm 与 npm 12 各安装一次 | 公共仓库检出中运行发布脚本：TA-14 的 40 个入口用例（`throwing-guard` 11、`full` 15、`after-tool` 14）在 Node 22.0.0 与 24 上逐字一致，发布提交只新增 136 个 `dist/` 文件，安装冒烟通过；推送 tag 后 pnpm 12.11.2 与 npm 12.2.0 各从 GitHub 安装一次，`full` 的构建结果与期望一致 | [M2-06 验收 §3](M2-06-release-v0-2-0.md#3-自动化验证汇总可复跑) | ✅ | — |
| 7 | M2-01～M2-06 的验收结论均为通过，表头有 commit 号 | 6 张都有 commit 号；M2-06 为通过，M2-01～M2-05 为有条件通过。M2-02、M2-03、M2-04 的条件与 M2-01 §7 第 2 行已由 M2-05 的宿主实测关闭，M2-04 §7 第 3 行与 M2-05 §7 第 3 行由 M2-06 的 README 关闭；M2-01 §7 第 1 行（与 M2-05 §7 第 2 行为同一项）与 M2-05 §7 第 1 行未关闭 | 各验收文件表头与 §7 | ⚠️ 仅 M2-06 为通过 | §4 第 1、2 行 |

## 2. 工单一览

| 工单 | 名称 | 验收结论 | commit | 验收文件 |
|---|---|---|---|---|
| M2-01 | v0.2.0 宿主事实与接口定稿 | 有条件通过；§7 第 2 行由 M2-05 关闭，第 1 行部分关闭（§4 第 2 行） | `22a7b07` | [M2-01](M2-01-v0-2-0-host-facts.md) |
| M2-02 | 执行后检查端到端 | 有条件通过；§7 第 1 行由 M2-05 关闭 | `6c8d5c4`、`01e162f` | [M2-02](M2-02-after-tool-end-to-end.md) |
| M2-03 | agents | 有条件通过；§7 第 1 行由 M2-05 关闭 | `a73da25` | [M2-03](M2-03-agents-component.md) |
| M2-04 | MCP 服务器 | 有条件通过；§7 第 1、2 行由 M2-05、第 3 行由 M2-06 关闭 | `0fc93f1` | [M2-04](M2-04-mcp-servers.md) |
| M2-05 | 三个宿主的安装与会话实测 | 有条件通过；§7 第 3 行由 M2-06 关闭，第 1、2 行未关闭 | `7bff5c2`、`4910146`、`fca0d18` | [M2-05](M2-05-three-host-live-tests.md) |
| M2-06 | 发布 v0.2.0 | 通过 | `632242c` | [M2-06](M2-06-release-v0-2-0.md) |

## 3. 功能点汇总

> 总览声明的每个功能点在收口时的状态，取自各验收文件 §2；声明了却没有验收覆盖的功能点在此列出。

总览声明 11 个功能点，各验收文件 §2 合计 11 行，没有遗漏。`F-02-04`、`F-04-08`、`F-01-07`、
`F-01-08` 验收时为 ✅；下表列出验收时为 ⚠️ 的 7 个及其收口时的状态，另列 Sprint M1 中宿主实测
欠账在本 Sprint 关闭的功能点。

| 功能点 | 状态 | 出自工单 |
|---|---|---|
| `F-05-13` | ✅ Claude Code 两种形态的替换与扣留在 2.1.296 中生效（M2-05，宿主实测） | M2-02 |
| `F-06-07` | ✅ Codex 0.162.1 中扣留生效，替换降级为扣留（M2-05，宿主实测） | M2-02 |
| `F-05-11` | ✅ Claude Code 列出 `components:reviewer`（M2-05，宿主实测） | M2-03 |
| `F-11-07` | ✅ agy 1.3.5 列出 `agy-helper` 与 `reviewer`（M2-05，宿主实测） | M2-03 |
| `F-05-12` | ✅ Claude Code 加载生成的 MCP 服务器（M2-05，宿主实测） | M2-04 |
| `F-06-06` | ✅ Codex 加载生成的 MCP 服务器，`"cwd": "."` 按插件目录解析（M2-05，宿主实测） | M2-04 |
| `F-11-08` | ✅ agy 加载生成的 MCP 服务器，以插件目录为工作目录（M2-05，宿主实测） | M2-04 |
| `F-06-03`、`F-06-04` | ✅ Sprint M1 收口时为 ⚠️；Codex 中安装 `full` 并信任 hooks 后拒绝、改写与停机继续生效（M2-05，宿主实测） | M1-05 |
| `F-05-08` | ⚠️ Sprint M1 收口时为 ⚠️；`/clear`、`/resume`、`/branch` 之后的去重已实测并修复，嵌套会话未在会话的 Bash 中启动（§4 第 1 行） | M1-07 |

## 4. 技术债入账

> 各验收文件 §7 中尚未关闭、去向为后续 Sprint 或未定的条目在此汇总；不属于任何 Sprint 的记入
> [`tech-debt.md`](tech-debt.md)。一票否决项不入本表。

| # | 债 | 出自 | 去向 |
|---|---|---|---|
| 1 | TA-11 的嵌套会话在会话的 Bash 中启动：容器中 Bash 工具启动的 `claude -p` 没有以环境变量提供的令牌，未登录；其他继承的环境变量对命令 hooks 的影响未覆盖 | M2-05 §7 第 1 行 | 下一个 Sprint 排单时列入：在以钥匙串登录的维护者机器上运行，提示只要求运行标记命令 |
| 2 | agy 根 `agents.json` 的格式未能确定：与 `agents/*.md` 并存时后者照常加载，三种写法都未使其声明的子代理出现 | M2-01 §7 第 1 行、M2-05 §7 第 2 行 | agy 文档或源码给出格式后再测；UAPA 不生成该文件 |

## 5. 回流

- [x] `README.md` 验收索引已更新
- [x] 功能清单中受影响的功能条目、范围决策与技术验收的状态描述已同步（角色审计 P-04 的描述按
      M2-05 的 Codex 实测更新，仍为 RISK；P-01 中 Codex 的提示阻断仍未实测，描述不变；功能条目、
      SD 与 TA 的文本无需改动）
- [x] 各验收 §7 的去向已写入接手的施工单或 `tech-debt.md`（M2-01～M2-04 转出的条目已写入 M2-05、
      M2-06 并关闭；M2-05 的第 1、2 行没有后续工单，汇总于 §4）

## 6. 下一步

- v0.2.0 已发布。按 SD-28，四个目标稳定运行之前不新增目标；之后按社区反馈决定是否增加 DSH、
  Kimi Code、ZCode 等宿主。
- 下一个 Sprint 的候选：§4 的两项；Codex 中提示阻断（`promptGate`）与 hooks 出错、超时处理的
  宿主实测（P-01、P-04 的 RISK 来源）。
