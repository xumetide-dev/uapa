# 验收 M1-05：Codex 目标

> 本文记录 M1-05 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M1-05](../workorders/M1-05-codex-target.md) |
| 覆盖功能点 | `F-06-01`、`F-06-02`、`F-06-03`、`F-06-04`、`F-06-05`（取自总览「工单构成」表） |
| 验收日期 | 2026-10-14 |
| 验收结论 | 有条件通过（在 Codex 中安装产物的确认未做，转 M1-08；合并布局中没有 hooks 的 Codex 会读取同目录的 `hooks/hooks.json`，转 M1-06，见 §7） |
| 判断范围 | 夹具与单元测试 |
| commit | 6661075 |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | 守卫抛错、stdin 不是 JSON、缺少 `session_id`、`tool_name`、`tool_input`、`tool_input.command` 或 `prompt` 时以退出码 2 拒绝且 stderr 非空（`test/runtime/codex-subprocess.test.ts` 前三个用例）；Codex 在 hook 出错时放行，构建报告为三个检查各写一条“缺少 Node ≥ 22 或入口无法启动时，……不生效（宿主在 hook 出错时放行）”，另写未信任的 hooks 被静默跳过 |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | `test/targets/codex.test.ts` 的构建用例以 `importsOf` 解析 `hooks/uapa-codex.mjs`，全部导入以 `node:` 开头；容器内单次构建列出的导入为 `node:fs`、`node:path` |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | 容器内单次构建后源项目中的文件为 `dist/codex/` 下 4 个、`dist/uapa-report.json` 与原有的 `guard.ts`、`skills/review/SKILL.md`；`src/targets/codex/` 不导入 `node:fs`；`--check` 尚未开放（M1-06） |
| V4 | 能力数据含无出处的宿主行为 | 否 | `src/capabilities/codex-subprocess.ts` 的每项取值对应 [Codex hooks 源码核对记录](../research/coding-agent-plugin-manifests/codex-source-review.md)（rust-v0.162.1，含上游测试名）或 [Codex](../research/coding-agent-plugin-manifests/codex-plugins.md) 的官方文档来源；`test/capabilities/capabilities.test.ts`（TA-09）通过 |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：守卫不静默失效 | 入口用例：守卫抛错与输入无法解析时以退出码 2 拒绝，stderr 非空；残余风险写明 `$PLUGIN_ROOT` 未展开时 Codex 按失败放行（实测结论前） | 守卫抛错时 stderr 为 `uapa: 守卫出错: boom`，缺少 `session_id` 时为 `uapa: 无法解析宿主输入: session_id`，退出码均为 2。`$PLUGIN_ROOT` 未展开的残余风险不再适用：源码核对确认命令经 shell 执行，命令改用 Codex 在执行前替换的 `${PLUGIN_ROOT}`；改为写明未信任的 hooks 被静默跳过 | `test/runtime/codex-subprocess.test.ts`「stdin 字段缺失」「拒绝与守卫出错」；`test/targets/codex.test.ts`「子进程入口的打包请求与残余风险」 | ✅ |
| 2 | 硬约束：产物零依赖 | 打包后的 `hooks/uapa-codex.mjs` 只含 `node:` 导入 | `hooks/uapa-codex.mjs` 的导入为 `node:fs`、`node:path` | `test/targets/codex.test.ts` 构建用例的 `importsOf` 断言；容器内单次构建 | ✅ |
| 3 | 硬约束：不在运行时推断宿主 | 入口只读 `PLUGIN_DATA`；设置 `CLAUDE_PLUGIN_DATA` 时输出不变 | 设置 `CLAUDE_PLUGIN_DATA` 而不设 `PLUGIN_DATA` 时停机前与执行前检查的输出与未设置时逐字一致，`CLAUDE_PLUGIN_DATA` 指向的目录为空；入口只读取 `PLUGIN_DATA` | `test/runtime/codex-subprocess.test.ts`「只读取 PLUGIN_DATA」 | ✅ |
| 4 | 硬约束：确定性输出 | 生成文件与期望文本逐字比对 | `.codex-plugin/plugin.json` 与 `hooks/hooks.json` 与期望文本逐字一致（含 `conflictHint`） | `test/targets/codex.test.ts`「没有 hooks 时 manifest……」「hooks/hooks.json 按 checks 生成条目」 | ✅ |
| 5 | 硬约束：不越权写入 | 停机计数只写入 `PLUGIN_DATA` 所指目录 | `PLUGIN_DATA` 指向不存在的目录时由入口创建，停机两次后数据目录中只有 `demo-local/uapa-stop-s1.json` | `test/targets/codex.test.ts` 构建用例的 `listFiles(data)`；`test/runtime/codex-subprocess.test.ts`「停机继续」 | ✅ |
| 6 | 硬约束：能力数据有出处 | 数据模块写 0.162.1、核对日期与出处；未实测的 `promptGate` 记为不支持 | `host` 为 `{ name: 'codex', version: '0.162.1', checked: '2026-10-14', source: 'codex-plugins.md' }`，注释指向「源码核对（rust-v0.162.1）」。`promptGate` 记为支持：源码核对确认退出码 2 拦下提示且不调用模型（上游测试 `exit_code_two_blocks_processing`），TA-15 已允许开源宿主以源码核对得出结论，见 §5 | `src/capabilities/codex-subprocess.ts`；`test/capabilities/capabilities.test.ts` | ✅ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-06-01` | `codex:subprocess` 的能力数据 | 宿主版本 0.162.1，写明核对日期与出处；取值与 hooks 适配第 4、6、7、8 节一致，工具名见[跨平台对比「工具名差异」](../research/coding-agent-plugin-manifests/cross-platform-comparison.md#工具名差异)；`rewriteInput`、`stopGate`、`promptGate`、`withholdOutput` 为支持，`replaceOutput` 为不支持；`failureDefault` 三项均为 `{ error: 'allow', timeout: 'allow' }`；`hookTimeoutSeconds` 为 30，`defaultTimeoutSeconds` 为 600；依据 [Codex hooks 源码核对记录](../research/coding-agent-plugin-manifests/codex-source-review.md)（TA-15） | ✅ | `src/capabilities/codex-subprocess.ts` 取值与 hooks 适配第 4、6、7、8 节的 Codex 行一致（第 4 节提示提交前检查表与第 7 节超时已随本单更新）；工具名 4 项与跨平台对比 Codex 0.162.1 列一致；`src/capabilities/index.ts` 登记 |
| `F-06-02` | 生成 `.codex-plugin/plugin.json` | 写兼容 manifest（0.162.1 不为带 `$schema` 的根 `plugin.json` 加载任何 hooks，见源码核对记录）：依次写 `name`、`version`、`description`，配置有值时写 `keywords`；有 hooks 时写 `hooks`，值为以 `./` 开头的 hooks 文件路径（如 `./hooks/hooks.json`）；`hosts.codex.interface` 写入 `interface`；不写 `author`（宿主不读取）；名称不是 kebab-case 时生成失败；该路径与其他宿主的 manifest 不同，不需合并 | ✅ | `test/targets/codex.test.ts`：没有 hooks 时 manifest 逐字为 name、version、description，不写 author；键序为 name、version、description、keywords、hooks、interface；3 个不合规名称各返回一条错误且不打包；容器内构建的 `.codex-plugin/plugin.json` 含 `"hooks": "./hooks/hooks.json"` |
| `F-06-03` | 生成 hooks 配置 | 默认写 `hooks/hooks.json`，结构为 `{ "hooks": { <事件>: [{ "hooks": [<处理器>] }] } }`（根对象出现其他键时宿主不加载整份文件）；宿主选项 `hooksFile` 可改为独立文件（相对插件目录，由 F-01-03 校验；与本宿主其他产物同路径时生成失败），路径同时写入 manifest 的 `hooks`；未设 `hooksFile` 时，`hooks/hooks.json` 的 `conflictHint` 为“设置 hosts.codex.hooksFile 改用独立的 hooks 文件”（SD-07）；按 `TargetPlan.checks` 生成条目：`beforeTool` → `PreToolUse`，`beforePrompt` → `UserPromptSubmit`，`beforeStop` → `Stop`；不写 matcher（省略时匹配全部工具）；处理器依次写 `type: "command"`、`command`、`timeout`（取能力数据的 `hookTimeoutSeconds`，单位秒）；`command` 为 `node "${PLUGIN_ROOT}/hooks/uapa-codex.mjs" <检查名>`（命令经 shell 执行，`${PLUGIN_ROOT}` 由宿主在执行前替换）；残余风险写明：Codex 只运行已信任的 hooks，安装后或 hooks 配置改动后须在 `/hooks` 中信任，未信任的 hook 被静默跳过；含 hooks 的插件不能进入公开插件目录 | ✅ | `test/targets/codex.test.ts`：三个事件的 `hooks/hooks.json` 逐字比对（无 matcher、`timeout` 30、命令引用 `${PLUGIN_ROOT}`、`conflictHint`）；`hookTimeoutSeconds` 为 `null` 时不写 `timeout`；`hooksFile` 为 `hooks/codex.json` 与 `./hooks/codex.json` 时写到该路径、manifest 的 `hooks` 同步且无 `conflictHint`，与 manifest 或入口同路径时失败；两条残余风险逐字比对；`test/config/validate.test.ts` 的 `hooksFile` 用例（9 个无效值、3 个有效值） |
| `F-06-04` | 子进程入口的决策输出 | `generate` 以 `input.bundle`（`entry: 'codex-subprocess'`、`external: 'node'`）打包入口并输出为 `hooks/uapa-codex.mjs`。`codex-subprocess.ts` 实现 `SubprocessProtocol`：会话 id 取 stdin `session_id`，工具名取 `tool_name`，入参取 `tool_input`，`Bash` 的命令为 `tool_input.command`，提示文本取 `prompt`；放行以退出码 0 结束、不输出；拒绝与提示阻断以退出码 2 结束并在 stderr 写非空原因；改写输出 `hookSpecificOutput` 的 `hookEventName: "PreToolUse"`、`permissionDecision: "allow"` 与 `updatedInput`（原入参换入新命令）；停机继续输出 `decision: "block"` 与 `reason`；数据目录取 `PLUGIN_DATA`（宿主不预先创建，由公共部分创建）；字段名与输出写法依据源码核对记录，写在协议实现中并注明出处 | ✅ | `test/runtime/codex-subprocess.test.ts` 7 个用例：字段路径、工具名换算（`Bash`、`apply_patch`、MCP 工具）、放行无输出、拒绝退出码 2、改写输出 `permissionDecision: "allow"` 与 `updatedInput`、提示阻断、停机继续与 `PLUGIN_DATA` 目录创建；构建用例以 `process.execPath` 运行放行、拒绝、改写、提示阻断、停机继续与结束 |
| `F-06-05` | 字段白名单检查 | `.codex-plugin/plugin.json` 只含兼容 manifest 的字段 `name`、`version`、`description`、`keywords`、`skills`、`mcpServers`、`apps`、`hooks`、`interface`，`interface` 的子字段不超出源码核对记录列出的字段；hooks 配置的根对象只含 `description`、`hooks`，`hooks` 的键只含宿主的 12 个事件名，分组只含 `matcher`、`hooks`，处理器只含 `type`、`command`、`timeout`；超出时生成失败 | ✅ | `test/targets/codex.test.ts`「字段白名单」10 个失败用例：manifest 的 `author`、`interface` 额外字段与非对象、hooks 根对象的 `modules`、`hooks` 非对象、未知事件、事件非数组、分组额外字段、`hooks` 非数组、处理器的 `async`，每例一条错误；`websiteURL` 别名通过 |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
pnpm check
node --test test/targets/codex.test.ts
```

施工单「验收」节另列宿主实测“安装构建出的插件，确认拒绝的命令不执行且原因可见”，本单未做，见 §7 第 1 行。

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `pnpm check` | ✅ 两次 `tsc` 通过；Biome 检查 114 个文件无问题；130 pass / 0 fail；功能清单关系检查通过（93 个功能） | 无（容器内运行） |
| `node --test test/targets/codex.test.ts` | ✅ 10 pass / 0 fail | 无（容器内运行） |

## 4. 交付物

- 目标登记：`src/config/targets.ts` 登记 `codex` 与 `codex:subprocess`，宿主顺序为 claude-code、
  codex、agy；`src/config/types.ts` 与 `src/config/validate.ts` 加入 `hosts.codex` 的 `dir`、
  `interface`、`hooksFile`。
- 能力数据：`src/capabilities/codex-subprocess.ts`，在 `src/capabilities/index.ts` 登记。
- 宿主模块 `src/targets/codex/`：`manifest.ts`、`hooks.ts`、`fields.ts`、`index.ts`（不实现
  `verify`），在 `src/targets/index.ts` 登记。
- 子进程入口：`src/runtime/entries/codex-subprocess.ts`。
- 测试：`test/targets/codex.test.ts`（10 个）、`test/runtime/codex-subprocess.test.ts`（7 个）、
  `test/config/validate.test.ts` 加 1 个；`test/helpers/build.ts` 的 `deps()` 加入 Codex。
- [M1-02 验收 §7](M1-02-skills-end-to-end.md#7-已知限制与技术债) 第 2 行由本单交付：`hooksFile` 为
  绝对路径、含 `..`、反斜杠或空段时校验失败，字段为 `hosts.codex.hooksFile`。
- 文档：新增 [Codex hooks 源码核对记录](../research/coding-agent-plugin-manifests/codex-source-review.md)，
  `codex-plugins.md` 增加「源码核对（rust-v0.162.1）」一节；同步 F-06-01～F-06-05、F-06-08，TA-08、
  TA-15，SD-03、SD-22、SD-23，US-05，夹具说明，hooks 适配第 3、4、7 节，模块接口 §5，入口与打包接口
  §2，命令 hooks 声明 §3，调研索引与跨平台对比。

生成示例（容器内以执行前、提示提交前与停机前检查的最小守卫构建，插件名 `demo`）：

```text
.codex-plugin/plugin.json  {"name":"demo","version":"0.1.0","description":"测试用插件","hooks":"./hooks/hooks.json"}（两空格缩进）
hooks/hooks.json           PreToolUse、UserPromptSubmit、Stop 各一组，命令 node "${PLUGIN_ROOT}/hooks/uapa-codex.mjs" <检查名>，timeout 30
stdin  before-tool   {"session_id":"s1","tool_name":"Bash","tool_input":{"command":"echo uapa-deny-probe"}}
结果   退出码 2，stderr 拒绝标记命令 uapa-deny-probe
stdin  before-tool   {"session_id":"s1","tool_name":"Bash","tool_input":{"command":"ls"}}
结果   退出码 0，无输出
stdin  before-prompt {"session_id":"s1","prompt":"API_KEY=1"}
结果   退出码 2，stderr 提示中含疑似密钥
stdin  before-stop   {"session_id":"s1","stop_hook_active":false}，然后 stop_hook_active 为 true
结果   {"decision":"block","reason":"请先运行测试"}，然后退出码 0、无输出
```

## 5. 与计划的偏差

- TA-15 的 Codex 各项没有按施工单「关键落地约束」由维护者在桌面端实测，改为按 `openai/codex`
  tag `rust-v0.162.1` 的源码与上游单元测试核对（维护者决定：能由研究得出的结论不等待实测）。
  TA-15 的验收标准随之写明开源宿主可按对应 tag 的源码核对；判断范围仍为“夹具与单元测试”，
  在 Codex 中安装产物的确认见 §7 第 1 行。
- F-06-02 由“`$schema` 格式的根 `plugin.json`”改为兼容格式 `.codex-plugin/plugin.json`：源码核对
  发现 0.162.1 对 AgentPlugin 格式的插件不加载任何 hooks，按原写法生成的插件中守卫不会运行。
  F-06-01、F-06-03～F-06-05 与 F-06-08 的写法随之更新，本文件 §2 的验收要点取更新后的文本；
  `author` 不再写入（宿主不读取）。
- 命令由 `node "$PLUGIN_ROOT/…"` 改为 `node "${PLUGIN_ROOT}/…"`：占位符由 Codex 在交给 shell 前替换，
  不依赖 shell 展开环境变量。
- 修改范围超出施工单「边界」列出的 Codex 调研文档与 F-06-03、F-06-04：模块接口、入口与打包接口、
  命令 hooks 声明、SD-03、SD-22、SD-23、TA-08、TA-15、US-05、夹具说明、hooks 适配与调研索引中的
  Codex 写法一并更新，依据 TA-15 “结论改变产物时，在同一提交中更新受影响的功能条目”。SD-03 的状态
  在验收提交中由“待实测”改为“已定”。
- Codex 的 manifest 改到 `.codex-plugin/` 后不再与 agy 的根 `plugin.json` 冲突：US-05 删去该条，
  M1-06 施工单的「关键落地约束」同步。
- `test/config/validate.test.ts` 中以 `hosts.codex` 演示未知字段的断言改用尚未登记的 `copilot-cli`。

## 6. 技术决策

| 决策 | 依据 | 回填 |
|---|---|---|
| Codex 写 `.codex-plugin/plugin.json`，不写根 `plugin.json` | 0.162.1 的 `load_plugin` 对 AgentPlugin 格式返回空的 hook 列表 | F-06-02、模块接口 §5 已回填 |
| 有 hooks 时 manifest 总写 `hooks` 路径，含默认的 `./hooks/hooks.json` | manifest 写了 `hooks` 时 Codex 不读取默认文件，合并布局中只读本宿主的 hooks 配置 | F-06-02、F-06-03 已回填 |
| 命令写 `${PLUGIN_ROOT}` | Codex 对插件来源的命令按字面替换该占位符后交给 shell，sh、PowerShell、cmd 都能执行 | F-06-03、F-06-08、入口与打包接口 §2、命令 hooks 声明 §3 已回填 |
| 拒绝与提示阻断用退出码 2 与 stderr，不用 `permissionDecision: "deny"` | 退出码 2 不读 stdout，不受 stdout 严格解析影响；与 Claude Code 入口写法一致 | F-06-04 已回填 |
| 处理器写 `timeout: 30` | 字段名与单位已由源码核对；hooks 适配第 7 节“字段名已核实的目标写 30 秒” | F-06-03、hooks 适配第 7 节已回填 |
| `promptGate` 为支持 | 源码与上游测试确认退出码 2 拦下提示且不调用模型 | F-06-01、SD-03、hooks 适配第 4 节已回填 |
| `hooksFile` 只接受以 `/` 分隔、不含 `..`、`.`、空段与反斜杠的相对路径，可以以 `./` 开头 | 写出步骤拒绝含反斜杠或 `..` 的路径，提前在配置校验中报出字段 | 模块接口 §2 原文已覆盖 |

架构与接口文档中不再有 Codex 的“待 TA-15”项（以 `grep -rn "待 TA-15" docs/architecture` 核对）。

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|
| 1 | 未在 Codex 中安装产物运行：施工单「验收」节的宿主实测（拒绝的命令不执行且原因可见）未做；结论来自源码核对，桌面端写入 hook 信任的方式只有社区记录 | `F-06-03`、`F-06-04` 的宿主行为未经宿主实测 | M1-08 发布前确认（已写入 M1-08 施工单「关键落地约束」） |
| 2 | 合并布局中 Codex 没有 hooks 时 manifest 不写 `hooks`，Codex 会读取同目录中其他宿主写出的 `hooks/hooks.json` | 与 Claude Code 共用目录且只有 Claude Code 生成 hooks 时，Codex 运行 Claude Code 的入口 | M1-06 实现 F-03-06 时处理并测试（已写入 M1-06 施工单「测试」节） |

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- 源码核对只覆盖 rust-v0.162.1；Codex 升级后需按新 tag 重核源码核对记录中的各项，尤其是
  AgentPlugin 格式是否开始加载 hooks。
- Codex 静默跳过未信任的 hooks，且安装插件不自动信任：用户安装后不在 `/hooks` 中信任时守卫不生效，
  构建报告已写明。
- Codex 在 hook 出错、超时或输出无效时一律放行；改写依赖 stdout 中的单个 JSON 对象，shell 的启动
  脚本向 stdout 输出内容时改写不生效、命令按原样执行（只在取不到会话 shell、回退到 `-lc` 时可能出现）。
- 下一步：M1-06（合并布局、覆盖目录、比对与命令 hooks，承接本单 §7 第 2 行）。
