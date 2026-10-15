# 验收 M1-04：agy 目标

> 本文记录 M1-04 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M1-04](../workorders/M1-04-agy-target.md) |
| 覆盖功能点 | `F-11-01`、`F-11-02`、`F-11-03`、`F-11-04`、`F-11-05`（取自总览「工单构成」表） |
| 验收日期 | 2026-10-14 |
| 验收结论 | 有条件通过（F-11-03 中与 Claude Code 共用插件目录时的残余风险待 M1-06 实现合并布局后写出，见 §7） |
| 判断范围 | 夹具与单元测试 |
| commit | dba16fa |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | 守卫抛错、stdin 不是 JSON、缺少 `conversationId`、`toolCall`、`toolCall.name`、`toolCall.args` 或 `CommandLine` 时执行前检查以退出码 0 输出 `decision: "deny"`（`test/runtime/agy-subprocess.test.ts` 前三个用例）；入口无法启动时宿主阻断执行前调用（能力数据 `failureDefault.beforeTool` 为 `deny`，出处为 agy「本地实测」）；停机前检查在 hook 出错时放行，构建报告写明“缺少 Node ≥ 22 或入口无法启动时，停机前检查不生效（宿主在 hook 出错时放行）” |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | `test/targets/agy.test.ts` 的构建用例以 `importsOf` 解析 `hooks/uapa-agy.mjs`，全部导入以 `node:` 开头；容器内单次构建列出的导入为 `node:fs`、`node:os`、`node:path` |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | 容器内单次构建后源项目中的文件为 `dist/agy/` 下 4 个、`dist/uapa-report.json` 与原有的 `guard.ts`、`skills/review/SKILL.md`；`src/targets/agy/` 不导入 `node:fs`；`--check` 尚未开放（M1-06） |
| V4 | 能力数据含无出处的宿主行为 | 否 | `src/capabilities/agy-subprocess.ts` 的每项取值对应 [agy](../research/coding-agent-plugin-manifests/agy-plugins.md)「Hooks」「本地实测」与 [hooks 适配](../research/coding-agent-plugin-manifests/uapa-hook-adapters.md)第 4、6、7、8 节的 agy 行；`Stop` 超时注明“未实测”；`test/capabilities/capabilities.test.ts`（TA-09）通过 |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：守卫不静默失效 | 入口用例：守卫抛错、缺少 `conversationId`、缺少 `toolCall.args.CommandLine` 时执行前检查输出 `decision: "deny"` | 守卫抛错时 stdout 为 `{"decision":"deny","reason":"uapa: 守卫出错: boom"}`；缺少 `conversationId` 时 reason 为 `uapa: 无法解析宿主输入: conversationId`，缺少 `CommandLine` 时为 `uapa: 无法解析宿主输入: tool.command`；退出码均为 0 | `test/runtime/agy-subprocess.test.ts`「stdin 字段缺失或类型不符」「拒绝与守卫出错」 | ✅ |
| 2 | 硬约束：产物零依赖 | 打包后的 `hooks/uapa-agy.mjs` 只含 `node:` 导入 | `hooks/uapa-agy.mjs` 的导入为 `node:fs`、`node:os`、`node:path` | `test/targets/agy.test.ts`「只配置 agy:subprocess 时……入口可运行」的 `importsOf` 断言；容器内单次构建 | ✅ |
| 3 | 硬约束：不在运行时推断宿主 | 入口不读 `ANTIGRAVITY_CONVERSATION_ID` 与其他宿主的变量；设置这些变量时输出不变 | 设置 `ANTIGRAVITY_CONVERSATION_ID`、`CLAUDE_PLUGIN_DATA`、`PLUGIN_DATA` 时执行前检查的输出与未设置时逐字一致，停机计数仍只写入 `TMPDIR/uapa-demo/`，另两个变量指向的目录为空；入口源码不读取 `process.env` | `test/runtime/agy-subprocess.test.ts`「不读取宿主变量」 | ✅ |
| 4 | 硬约束：确定性输出 | 生成的 `plugin.json`、`hooks.json` 与期望文本逐字比对 | `plugin.json` 与 `hooks.json` 与手写期望文本逐字一致（`hooks.json` 含 `beforeTool`、`beforeStop` 两个事件） | `test/targets/agy.test.ts`「plugin.json 只写 name 与 description」「hooks.json 顶层键为插件名」 | ✅ |
| 5 | 硬约束：不越权写入 | 停机计数只写入 `TMPDIR` 下的 `uapa-<插件名>/` | 停机两次后 `TMPDIR` 下只有 `uapa-demo/uapa-stop-c1.json`；会话 id `c/1` 的计数文件为 `uapa-stop-c%2F1.json` | `test/targets/agy.test.ts` 构建用例的 `listFiles(temp)`；`test/runtime/agy-subprocess.test.ts`「停机继续」 | ✅ |
| 6 | 硬约束：能力数据有出处 | 数据模块写 1.3.4、核对日期 2026-10-14 与出处 `agy-plugins.md`；未实测的 `Stop` 超时注明“未实测” | `host` 为 `{ name: 'agy', version: '1.3.4', checked: '2026-10-14', source: 'agy-plugins.md' }`；`beforeStop` 注释写“超时未实测” | `src/capabilities/agy-subprocess.ts`；`test/capabilities/capabilities.test.ts` | ✅ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-11-01` | `agy:subprocess` 的能力数据 | 宿主版本 1.3.4，写明核对日期与出处；取值与 hooks 适配第 4、6、7、8 节一致，工具名见[跨平台对比「工具名差异」](../research/coding-agent-plugin-manifests/cross-platform-comparison.md#工具名差异)；`rewriteInput`、`stopGate` 为支持，`promptGate`、`replaceOutput`、`withholdOutput` 为不支持（宿主没有提示提交事件，`PostToolUse` 不能替换输出）；`failureDefault.beforeTool` 为 `{ error: 'deny', timeout: 'deny' }`（本地实测），`beforeStop` 为 `{ error: 'allow', timeout: 'allow' }`（出错为本地实测，超时注明“未实测”），`beforePrompt` 为 `{ error: 'allow', timeout: 'allow' }` 并注明“宿主没有该事件”；`hookTimeoutSeconds` 与 `defaultTimeoutSeconds` 为 30；在登记处加入本目标（M4） | ✅ | `src/capabilities/agy-subprocess.ts` 取值与 hooks 适配第 4、6、7、8 节的 agy 行一致，工具名 10 项与跨平台对比 agy 1.3.4 列一致（待办为未查到，不列入）；`src/capabilities/index.ts` 登记；`test/capabilities/capabilities.test.ts` 2 个登记与出处用例覆盖本目标 |
| `F-11-02` | 生成根 `plugin.json` | 只写 `name` 与 `description`（宿主 schema 不允许其他字段），不写 `$schema`（文档给出的地址返回 404）；不写 `skills` 字段，宿主加载 `skills/` 下的全部 skill；名称不匹配 `^[a-zA-Z0-9_-]+$` 时生成失败；该文件不标为可合并，`conflictHint` 为“agy 的根 plugin.json 只允许 name 与 description，不能与其他宿主的根 plugin.json 合并；为 hosts.agy.dir 设置单独的目录”；在宿主模块登记处加入本宿主（M4） | ✅ | `test/targets/agy.test.ts`：`plugin.json` 逐字为 name 与 description，`keywords`、`author` 不写入；4 个不合规名称各返回一条错误且不打包，`Demo_1-x` 通过；`conflictHint` 逐字一致；`src/targets/index.ts` 登记 `agy` |
| `F-11-03` | 生成 `hooks.json` | 写入插件根目录的 `hooks.json`，顶层只有一个键，为配置的 `name`；其值按 `TargetPlan.checks` 写事件：`beforeTool` → `PreToolUse`，元素为 `{ "matcher": "", "hooks": [<处理器>] }`（`""` 匹配全部工具，本地实测）；`beforeStop` → `Stop`，元素直接为处理器；处理器依次写 `type: "command"`、`command`、`timeout`（取能力数据的 `hookTimeoutSeconds`，即 30）；`command` 为 `node hooks/uapa-agy.mjs <检查名>`（hook 以插件目录为工作目录，本地实测）；不写 `enabled`；与 Claude Code 共用插件目录时，残余风险写明安装命令是否把含 `.claude-plugin/` 的目录按 Claude Code 插件转换未实测 | ⚠️ 仅与 Claude Code 共用插件目录时的残余风险未实现 | `test/targets/agy.test.ts`：`hooks.json` 逐字比对（空 matcher、`Stop` 直接为处理器、`timeout` 30、无 `enabled`），`hookTimeoutSeconds` 为 `null` 时不写 `timeout`，`beforePrompt` 抛错。共用插件目录属于合并布局，`src/build/write.ts` 遇合并布局抛出“合并布局尚未实现（F-03-06）”，残余风险无法写出，见 §7 第 1 行 |
| `F-11-04` | 子进程入口的决策输出 | `generate` 以 `input.bundle`（`entry: 'agy-subprocess'`、`external: 'node'`）打包入口并输出为 `hooks/uapa-agy.mjs`。`agy-subprocess.ts` 实现 `SubprocessProtocol`：会话 id 取 stdin `conversationId`，工具名取 `toolCall.name`，入参取 `toolCall.args`，命令字段为 `CommandLine`；`PreToolUse` 的 stdout 不是含 `decision` 的 JSON 时宿主阻断（本地实测），因此执行前检查的放行输出 `{"decision":"allow"}`，停机前检查的放行输出 `{}`；拒绝输出 `{"decision":"deny","reason":<原因>}`，退出码 0；改写输出 `{"decision":"allow","overwrite":{"CommandLine":<命令>}}`（宿主按键浅合并）；停机继续输出 `{"decision":"continue","reason":<原因>}`；`dataDir` 返回 `path.join(os.tmpdir(), 'uapa-' + encodeURIComponent(插件名))`（宿主没有插件数据目录变量，SD-06）；有停机前检查时残余风险写明系统临时目录被清理时停机计数归零 | ✅ | `test/targets/agy.test.ts`「子进程入口的打包请求」断言 `entry: 'agy-subprocess'`、`external: 'node'`；`test/runtime/agy-subprocess.test.ts` 8 个用例：放行 `{"decision":"allow"}`、停机放行 `{}`、拒绝退出码 0、改写只写 `overwrite.CommandLine`、停机继续、计数位于 `TMPDIR/uapa-demo/`；构建用例以 `process.execPath` 运行放行、拒绝、改写、停机继续四例；有停机前检查时报告写停机计数归零的残余风险 |
| `F-11-05` | 字段白名单检查 | `plugin.json` 只含 `name`、`description`；`hooks.json` 顶层只有一个键，其值只含 `SessionStart`、`PreToolUse`、`PostToolUse`、`Stop`；`PreToolUse`、`PostToolUse` 的元素只含 `matcher`、`hooks`；处理器只含 `type`、`command`、`timeout`；超出时生成失败 | ✅ | `test/targets/agy.test.ts`「字段白名单」11 个失败用例：`plugin.json` 额外字段、顶层键 0 个与 2 个、未知事件、`PreToolUse` 元素额外字段、`PostToolUse` 的 `hooks` 不是数组、处理器额外字段、`SessionStart` 处理器带 `matcher` 与非对象元素，每例一条错误 |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
pnpm check
node --test test/targets/agy.test.ts
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `pnpm check` | ✅ 两次 `tsc` 通过；Biome 检查 106 个文件无问题；112 pass / 0 fail；功能清单关系检查通过（93 个功能） | 无（容器内运行） |
| `node --test test/targets/agy.test.ts` | ✅ 9 pass / 0 fail | 无（容器内运行） |

## 4. 交付物

- 目标登记：`src/config/targets.ts` 登记 `agy` 与 `agy:subprocess`；`src/config/types.ts` 与
  `src/config/validate.ts` 加入 `hosts.agy`（只有 `dir`）。
- 能力数据：`src/capabilities/agy-subprocess.ts`，在 `src/capabilities/index.ts` 登记。
- 宿主模块 `src/targets/agy/`：`manifest.ts`（根 `plugin.json` 与名称检查）、`hooks.ts`（根
  `hooks.json`）、`fields.ts`（字段白名单检查）、`index.ts`（`generate`，不实现 `verify`），在
  `src/targets/index.ts` 登记。
- 子进程入口：`src/runtime/entries/agy-subprocess.ts`。
- 测试：`test/targets/agy.test.ts`（9 个）、`test/runtime/agy-subprocess.test.ts`（8 个）；
  `test/config/validate.test.ts` 加 2 个、`test/build/build.test.ts` 加 1 个；`test/helpers/build.ts`
  的 `deps()` 加入 agy 宿主模块与能力数据。
- [M1-02 验收 §7](M1-02-skills-end-to-end.md#7-已知限制与技术债) 第 1 行的三个分支由本单补上用例：
  `hosts` 中出现未配置目标的宿主（字段 `hosts.agy`、`hosts.claude-code`）、插件目录包含另一宿主的插件
  目录（两个方向）、一个宿主失败时另一宿主仍写出（两个方向，含宿主模块抛错）。

生成示例（容器内以只含执行前与停机前检查的最小守卫构建，插件名 `demo`）：

```text
plugin.json   {"name":"demo","description":"测试用插件"}（两空格缩进）
stdin  before-tool {"conversationId":"c1","toolCall":{"name":"run_command","args":{"CommandLine":"echo uapa-deny-probe"}}}
stdout {"decision":"deny","reason":"拒绝标记命令 uapa-deny-probe"}            退出码 0
stdin  before-tool {"conversationId":"c1","toolCall":{"name":"run_command","args":{"CommandLine":"ls"}}}
stdout {"decision":"allow"}                                                   退出码 0
stdin  before-tool {"toolCall":{}}
stdout {"decision":"deny","reason":"uapa: 无法解析宿主输入: conversationId"}   退出码 0
stdin  before-stop {"conversationId":"c1"}（两次）
stdout {"decision":"continue","reason":"请先运行测试"}，然后 {}
```

## 5. 与计划的偏差

- M1-02 验收 §7 第 1 行列出的“插件目录等于另一宿主的插件目录”不是可构造的失败分支：解析为同一路径
  的宿主合为一个目录，按合并布局处理（F-03-06），不做默认布局的路径检查。本单补上“包含”的两个方向，
  并断言两个宿主目录相同时校验不报错；合并布局的写出与冲突由 M1-06 实现与测试。
- `test/build/build.test.ts` 与 `test/config/validate.test.ts` 不在施工单「任务」点名的文件中，属于
  「测试」节承接 M1-02 §7 第 1 行的用例，在「边界」允许的 `test/` 范围内。
- 可选的 agy 宿主实测未做，判断范围为“夹具与单元测试”；入口的字段名与输出格式依据 agy 1.3.4 的
  已有本地实测记录。

## 6. 技术决策

| 决策 | 依据 | 回填 |
|---|---|---|
| agy 宿主模块不实现 `verify`，`hostValidation` 为 `none`；字段白名单检查在 `generate` 中执行，失败时为每个目标返回同一组错误 | `agy plugin validate` 对结构错误也输出 `[ok]`（agy「安装与管理」，本地实测） | 功能清单模块 11 已写明，无需回填 |
| 名称检查先于白名单检查：名称不合规时不生成 hooks、不打包 | 名称同时是 `hooks.json` 的顶层键，不合规时后续产物无意义 | 无需回填（实现细节） |
| `run_command` 缺少 `CommandLine` 时由公共部分以 `tool.command` 报告无法解析，协议实现不另设字段名 | 公共部分 `toToolCall` 的既有约定，与 Claude Code 入口一致；施工单红线禁止为 agy 改公共部分 | 无需回填 |
| 停机前检查的放行与无法解析时输出 `{}`，原因写到 stderr | F-11-04；公共部分在停机前检查无法解析时调用 `allow` 并附 stderr | 无需回填 |

架构与接口文档中没有本单定下而仍写“待定”“未核实”的 agy 项（`grep -n "未核实\|待定" docs/architecture/*.md`
中无 agy 相关行）。

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|
| 1 | 与 Claude Code 共用插件目录时，残余风险“安装命令是否把含 `.claude-plugin/` 的目录按 Claude Code 插件转换未实测”未写出：共用目录即合并布局，`writeOutputs` 遇合并布局抛错；`HostInput` 也不含插件目录布局，宿主模块无从判断是否共用 | `F-11-03` 部分交付 | M1-06 实现 F-03-06 时补实现与单元测试（已写入 M1-06 施工单「测试」节） |

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- 本单产物未在 agy 中安装运行；字段名、输出格式、失败默认与超时取自 agy 1.3.4 的本地实测记录，
  宿主升级后需重跑该记录中的各项并核对能力数据。
- agy 的用户级插件安装对该用户的全部 agy 会话生效，后续宿主实测前确认没有并发的 agy 会话。
- `Stop` 超时的处理未实测，能力数据按出错时的行为记为放行。
- 下一步：M1-05（Codex 目标，需维护者在桌面端实测）、M1-06（合并布局，承接本单 §7 第 1 行）、M1-07。
