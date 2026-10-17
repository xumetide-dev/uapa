# UAPA hooks 适配

**状态：** 第 1、2、3、5 节，以及第 4、6、7、8 节中 v0.1.0 四个目标（Claude Code 两种形态、
Codex、agy）的行，是 v0.1.0 的实现依据，功能清单逐条引用；这四个目标的执行后检查（第 4 节的
替换与扣留列、第 6 节的 `replaceOutput` 与 `withholdOutput` 两行）是 v0.2.0 的实现依据
（SD-29）；Copilot CLI 与 Kimi Code 的行为预留（功能清单 SD-26、SD-27），其他目标的行是后续
版本的设计，尚未排期；第 9 节的测试分层以功能清单的技术验收为准。文件位置与数据结构以
[模块接口](../../architecture/module-interfaces.md) 为准，验收以
[功能清单](../../feature-list/README.md) 为准，冲突时的依据见
[开发 UAPA「文档冲突时的依据」](../../guide/developing-uapa.md#文档冲突时的依据)。
文中代码为示意写法，实现以 `src/` 为准。

本文与 [统一代理插件架构（UAPA）设计提案](unified-agent-plugin-architecture.md) 配套，
说明守卫逻辑（阻断危险命令、检查用户提交的提示、扣留含密钥的工具输出、停机前检查）的公共类型，以及它在各构建
目标上如何换算为宿主的 hooks 协议：工具名映射、决策输出、Claude Code 双形态去重、能力缺失
与失败处理、状态与测试。v0.1.0 目标见 [架构 §0](../../architecture/architecture.md#0-技术选型总览)，
写出规则见 [模块接口 §8](../../architecture/module-interfaces.md)；后续目标见设计提案第 5 节。
核对日期为 2026-10-13，agy 为 2026-10-14。

## 1. 守卫逻辑的约束

- 守卫逻辑只用第 2 节的公共类型与语言内置对象，不导入 Node、Bun 或宿主 API，不做 I/O。
  同一份代码要在 Claude Code hooks 模块（没有 Node）、OpenCode（Bun）、DSH（Node）与子进程
  入口中运行。
- 适配器只做协议转换，不含业务判断。
- Claude Code hooks 模块只能导入相对路径文件与 `'claude-code'`，构建时把守卫逻辑打包为模块
  旁的相对文件。
- 守卫逻辑以 `export default` 导出 `GuardPlugin`。执行前 hook 不按工具筛选，筛选写在
  `beforeTool` 中（第 3 节）。

## 2. 公共类型

```ts
export type Capability =
  'rewriteInput' | 'replaceOutput' | 'withholdOutput' | 'stopGate' | 'promptGate'

export interface ToolCall {
  readonly sessionId: string
  readonly tool: string // 适配器换算后的规范工具名，见第 3 节
  readonly input: Readonly<Record<string, unknown>>
}

export type BeforeTool =
  | { kind: 'allow' }
  | { kind: 'deny'; reason: string }
  // 宿主不能改写入参时，按 fallbackReason 拒绝，不放行原始入参
  | { kind: 'rewrite'; input: Record<string, unknown>; fallbackReason: string }

// v0.2.0（F-02-04）
export type AfterTool =
  | { kind: 'keep' }
  | { kind: 'replace'; text: string }
  | { kind: 'withhold'; reason: string }

export type BeforeStop = { kind: 'stop' } | { kind: 'continue'; reason: string }

export interface PromptSubmit {
  readonly sessionId: string
  readonly prompt: string // 用户提交的提示原文
}

export type BeforePrompt = { kind: 'allow' } | { kind: 'block'; reason: string }

// v0.3.0（F-02-05）：守卫选项；default 必填，类型与 type 一致
export type GuardOption =
  | { type: 'string'; title: string; description: string; default: string }
  | { type: 'number'; title: string; description: string; default: number }
  | { type: 'boolean'; title: string; description: string; default: boolean }

// v0.3.0：本次调用的选项取值，键为选项名；守卫没有声明选项时为空对象
export interface GuardContext {
  readonly options: Readonly<Record<string, string | number | boolean>>
}

export interface GuardPlugin {
  readonly name: string
  readonly requires: readonly Capability[]
  readonly options?: Readonly<Record<string, GuardOption>> // v0.3.0
  beforeTool?(call: ToolCall, ctx: GuardContext): BeforeTool | Promise<BeforeTool>
  beforePrompt?(p: PromptSubmit, ctx: GuardContext): BeforePrompt | Promise<BeforePrompt>
  // v0.2.0（F-02-04）
  afterTool?(call: ToolCall, output: string, ctx: GuardContext): AfterTool | Promise<AfterTool>
  // continuations 为连续强制继续的次数：返回 continue 时加 1，返回 stop 时清零；
  // 供插件自行设上限
  beforeStop?(
    s: { sessionId: string; continuations: number }, ctx: GuardContext,
  ): BeforeStop | Promise<BeforeStop>
}
```

v0.1.0 的 `GuardPlugin` 不含 `afterTool`，包入口不导出 `AfterTool`；`Capability` 在 v0.1.0 即含
全部五个取值，`requires` 含 `replaceOutput`、`withholdOutput` 时构建报输入错误（SD-20）。

`afterTool` 只接收文本形式的输出。需要结构化输出时，按目标单独设计，不放进公共类型。输出文本
的取法、`replace` 的 `text` 与 `withhold` 的 `reason` 的检查，以及两者在各目标上的写出，见
功能清单 SD-29 与[入口与打包接口](../../architecture/runtime-interfaces.md#4-守卫返回值与执行后输出)。

守卫选项（v0.3.0，SD-35）在默认导出中声明，包入口导出 `GuardOption` 与 `GuardContext`。`ctx` 为
各检查方法的最后一个参数，不使用选项的守卫可以不写，v0.2.0 的守卫逻辑无需修改。取值来源按目标
不同：Claude Code 为用户在插件设置中保存的取值，未设置时为 `default`；Codex 与 agy 总是
`default`。取值无效时按守卫出错处理，见
[入口与打包接口第 3 节](../../architecture/runtime-interfaces.md#3-子进程入口)。

## 3. 工具名映射

各宿主执行前 hook 收到的工具名不同，事实见
[跨平台对比](cross-platform-comparison.md#工具名差异)。适配器按目标能力数据中的 `toolNames`
把宿主工具名换算为规范名：

| 规范名 | 含义 |
|---|---|
| `shell` | 执行 shell 命令 |
| `read_file`、`edit_file`、`write_file` | 读文件、编辑文件、新建文件 |
| `glob`、`grep` | 按模式找文件、内容搜索 |
| `web_fetch`、`web_search` | 抓取网页、网络搜索 |
| `subagent`、`todo` | 启动子代理、待办列表 |

- 不在映射表中的工具以 `host:<原名>` 传入，例如 `host:NotebookEdit`、`host:MCP:query`。
- 宿主把编辑与新建合为一个工具时（Codex 的 `apply_patch`、Cursor 的 `Write`），换算为
  `edit_file`。守卫逻辑对文件写入的检查应同时覆盖 `edit_file` 与 `write_file`。
- `shell` 的入参由适配器换算为 `{ command }`；其余工具的入参原样传入。`rewrite` 目前只对
  `shell` 的 `command` 做反向换算。
- v0.1.0 的守卫接口不声明关心的工具，生成的 hooks 配置不写 matcher：每次工具调用都进入入口，
  由守卫按规范名判断。Claude Code 省略 matcher 时匹配全部工具（2.1.296，[本地实测](claude-code-local-tests.md#命令-hooks)），
  Codex 相同（rust-v0.162.1，[源码核对](codex-source-review.md)）；其余宿主列入功能清单 TA-15 实测。日后按
  工具筛选时注意：CodeBuddy 的 matcher 不自动锚定，`Write` 也会匹配 `NotebookWrite`，需写成
  `^Write$`。
- 宿主不提供工具名时（Kiro IDE 的命令 hook，#7375、#7500），工具以 `host:unknown` 传入，
  构建报告列为残余风险。

## 4. 决策到宿主输出的映射

| 目标 | `deny` | `rewrite` | `replace` / `withhold` | `continue`（停机门禁） |
|---|---|---|---|---|
| `claude-code:in-process` | 返回 `{ deny }` | `e.tool` 为 `Bash` 时 `next({ ...e, command })`，其他工具按 `fallbackReason` 返回 `{ deny }`（F-05-05） | `next` 之后：替换返回改动 `stdout` 或 `file.content` 后的 `{ ...ran, result }`，其他形状的输出以替换文本返回 `{ deny }`；扣留返回 `{ deny }`，对全部工具与报错的结果生效（2.1.296 实测） | `classic.Stop` 返回 `{ block }` |
| `claude-code:subprocess` | 退出码 2 或 `permissionDecision: "deny"` | `hookSpecificOutput.updatedInput`，整体替换入参，不需 `permissionDecision`（2.1.296 实测） | `PostToolUse` 返回 `updatedToolOutput`：复制 `tool_response` 后改动 `stdout` 或 `file.content`，扣留时写入说明文字；其他形状的输出只能以 `decision: "block"` 附加原因，模型仍读到原输出；工具报错时只触发 `PostToolUseFailure`，不能替换（2.1.296 实测） | `Stop` 返回 `decision: "block"` + `reason`，连续 8 次后强制结束 |
| `codex:subprocess` | 退出码 2（stderr 须非空）或 `permissionDecision: "deny"` | `updatedInput`（配合 `allow`） | 不能替换为正常输出；扣留用 `PostToolUse` 的 `decision: "block"` 与非空 `reason`，模型读到的是以 `reason` 为内容的失败调用；只对执行成功的调用触发（rust-v0.162.1 源码核对） | `Stop` 返回 `decision: "block"` + `reason` |
| `copilot-cli:subprocess` | 退出码 2 或 `permissionDecision: "deny"` + `permissionDecisionReason` | `modifiedArgs` | `modifiedResult` | `agentStop` 返回 `decision: "block"`，连续 8 次后结束 |
| `cursor:subprocess` | 退出码 2 或权限类 hook 返回 deny | `updated_input` | 只对 MCP 工具：`updated_mcp_tool_output` | 不支持 |
| `agy:subprocess` | stdout `{"decision":"deny","reason":...}` | `decision: "allow"` + `overwrite`（按键浅合并） | 不支持：`PostToolUse` 的 stdin 不含输出，只能返回 `{}` | `Stop` 返回 `decision: "continue"` + `reason` |
| `kimi:subprocess` | 退出码 2 或 `permissionDecision: "deny"` | 不支持 | 不支持 | `Stop` 退出码 2 |
| `kiro:workspace-hook` | 退出码 2 | 不支持 | 不支持 | 仅 CLI V3：退出码 1 或 `decision: "block"`；IDE 不支持 |
| `codebuddy:subprocess` | 退出码 2，原因写入 stdout | `modifiedInput` | `updatedToolOutput` | `continue: false` + `reason`，或退出码 2 |
| `opencode:in-process` | 在 `tool.execute.before` 中抛错 | 原地修改 `output.args` | 原地修改 `output.output` | 不支持 |
| `dsh:cordis` | `tools/pre-execute` 返回 `deny` | 不支持 | `tools/post-execute` 返回 `accept { content }`；扣留也可返回 `block { feedback }` | `agent/turn-stopping` 中调用 `agent.steer()` |

“扣留”在各目标上都实现为“以说明文字替换原输出”，原始命令已经执行，不能撤销。

### 提示提交前检查

| 目标 | 事件 | `block` 的输出 | 依据 |
|---|---|---|---|
| `claude-code:in-process` | `prompt.submit` | 返回 `{ drop: reason }` | [Mods 指南](claude-code-mods-guide.md) |
| `claude-code:subprocess` | `UserPromptSubmit` | 退出码 2，原因写入 stderr；或 stdout `decision: "block"` + `reason` | [本地实测](claude-code-local-tests.md#命令-hooks) |
| `codex:subprocess` | `UserPromptSubmit` | 退出码 2，原因写入 stderr；或 stdout `decision: "block"` + `reason` | [源码核对](codex-source-review.md) |
| `agy:subprocess` | 无 | 宿主没有提示提交事件，`promptGate` 为不支持 | [agy](agy-plugins.md#hooks) |
| `copilot-cli:subprocess` | `userPromptSubmitted` | 待 TA-15 | — |
| `kimi:subprocess` | `UserPromptSubmit` | 退出码 2，原因写入 stderr | [Kimi Code](kimi-code-plugins.md) |

提示文本在 stdin 中的字段名各宿主文档均未给出（含 Kimi Code；agy 没有该事件）。Claude Code
与 Codex 为 `prompt`（2.1.296 本地实测；Codex 为 rust-v0.162.1 源码核对）；其余宿主随 TA-15 写入调研文档与能力数据，确认前这些子进程
目标的 `promptGate` 记为不支持。

## 5. Claude Code 双形态去重

同一个 Claude Code 插件同时声明 hooks 模块与命令 hooks，让两者互为兜底：支持 hooks 模块的
版本用模块，较旧的版本用命令 hooks。

### 文件布局

两种形态写在同一个 `hooks/hooks.json` 中：

```json
{
  "hooks": {
    "PreToolUse": [{
      "hooks": [{
        "type": "command",
        "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/uapa-claude-code.mjs\" before-tool"
      }]
    }]
  },
  "modules": ["./register.ts"]
}
```

| Claude Code 版本 | 行为 | 依据 |
|---|---|---|
| v2.1.287 及以上 | 两种形态都加载，同一事件上都执行（2.1.296 实测） | [本地实测记录](claude-code-local-tests.md) |
| v2.1.271 至 v2.1.286 | `modules` 作为未知顶层键被提示“已忽略”，命令 hooks 照常加载（#94402 报告于 v2.1.271） | [H2] |
| v2.1.271 之前 | 未知顶层键的处理未核实；v2.1.71 上 `hooks` 键为必填，缺少时报 `expected record, received undefined` | [H3] |

- 不采用只含 `modules` 的 `hooks.json`：旧版本要求 `hooks` 键，校验失败按文件处理，该文件中的
  hooks 全部不加载，插件其余部分照常加载 [H1][H3]。
- 也可以拆成两个文件：`plugin.json` 的 `hooks` 字段指向只含命令 hooks 的文件，默认
  `hooks/hooks.json` 只含 `modules`。2.1.296 上两者都执行，但文档没有说明 `modules` 写在非默认
  文件中的行为，旧版本加载默认文件时还会报错，因此不作为默认布局。
- claude.ai 与 Desktop 的插件浏览界面可能隐藏 `hooks.json` 含未知顶层键的插件（#76451，已被
  stale 机器人关闭，未确认修复）；未实测 [H4]。

### 去重

两种形态在同一事件上都执行，需要去重：

1. 模块在 `session.start` 中把当前会话 id 写入一个环境变量。
2. 命令 hook 脚本读取 stdin JSON 的 `session_id`，与该环境变量比较；相等说明模块已在本会话
   生效，脚本立即以退出码 0 结束。

```ts
// src/runtime/entries/claude-code-in-process.ts（示意写法）
// __UAPA_MODULE_SESSION_ENV__ 在打包时替换为由插件名派生的字面量（F-05-08），
// 插件名为 command-guard 时为 'UAPA_MODULE_SESSION_COMMAND_GUARD'
import type { Register } from 'claude-code'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.env.set(__UAPA_MODULE_SESSION_ENV__, await $.session.id())
    return next(e)
  })
  // tool.call、classic.Stop 等守卫 hook 见 Mods 指南的示例
}
```

```js
// 打包后的 hooks/uapa-claude-code.mjs 的效果（示意写法；源码中由 skip 实现）
const input = JSON.parse(await readStdin())
if (process.env.UAPA_MODULE_SESSION_COMMAND_GUARD === input.session_id) process.exit(0)
// 以下运行与模块相同的守卫逻辑，按第 4 节输出命令 hooks 协议
```

- 生成的 `hooks/register.ts` 只引入打包后的 `hooks/uapa-guard.mjs`（F-05-05），写作
  `export const register: Register = (on, options) => guard(on, options)`（v0.3.0 起传入
  `options`，F-05-18；v0.2.0 为 `on => guard(on)`）：`validate` 不跟踪转导出的 `register`
  （[本地实测](claude-code-local-tests.md#hooks-模块的静态校验)）。去重代码位于入口源码中。
- `/clear`、`/resume`、`/branch` 之后 `session.start` 不再触发（[Mods 指南](claude-code-mods-guide.md#state-与-store)）。
  会话 id 若随之改变，变量与 stdin 的 `session_id` 不再相等，命令 hook 不被跳过，守卫执行两次；
  模块因此在 `classic.SessionStart`（`source` 为 `clear`、`resume`、`fork`）上再写一次变量，
  值取事件的 `session_id`：`/branch` 与 `/resume` 之后该事件中的 `$.session.id()` 仍为切换前的
  会话 id（[本地实测](claude-code-local-tests.md#双形态去重的会话实测)）。
- 比较会话 id 而不是只判断变量是否存在：在某个会话的 Bash 工具中启动的嵌套 Claude Code
  会话会继承父会话的环境变量，只判断存在会让嵌套会话错误地跳过命令 hook。
- 实测覆盖的是 `UserPromptSubmit` 与 `Stop`（[双形态去重的会话实测](claude-code-local-tests.md#双形态去重的会话实测)）。`SessionStart` 事件上的命令 hook 能否看到同一会话
  模块写入的变量，取决于调用顺序，未实测；该事件不要依赖去重。
- hooks 模块运行在没有 Node `process` 的独立环境中，与 hook 子进程不共享内存，不能用
  `globalThis` 标志或进程 id 判断模块是否生效。
- 在 DSH 中，`$.env` 是进程级、所有会话共享的，上述做法不成立。同一插件不要同时挂载
  `@deepseek-ai/dsh-experimental-claude-code-mods` 与 `@deepseek-ai/dsh-hooks-claude-code`。
- CodeBuddy 遇到含 `modules` 的 `hooks.json` 时也会按 Mods 通道加载该目录；两种形态是否都
  执行、`$.env` 是否可用均未核实。`codebuddy:subprocess` 因此只写 `"hooks"` 键。

## 6. 能力缺失时的处理

构建时按下表检查。“构建失败”指插件在 `requires` 中声明了该能力时，该目标不产出。

| 缺失能力 | 受影响目标 | 处理 |
|---|---|---|
| `rewriteInput` | Kimi、Kiro、DSH | 声明需要时构建失败；否则 `rewrite` 按 `fallbackReason` 拒绝，在原因中写出纠正后的写法，并在构建报告中记为降级 |
| `replaceOutput` | Codex、Cursor（非 MCP 工具）、Kimi、Kiro | 声明需要时构建失败；否则 `replace` 按扣留写出，替换文本作为扣留的说明文字，在构建报告中记为降级（SD-29） |
| `withholdOutput` | agy、Cursor（非 MCP 工具）、Kimi、Kiro | 声明需要时构建失败；否则不生成执行后 hook，并在构建报告中写明残余风险：执行后检查不生效，模型能读到原始输出 |
| `stopGate` | Cursor、OpenCode、Kiro IDE | 声明需要时构建失败；否则不生成停机事件的 hook，并在构建报告中写明残余风险：停机不受检查 |
| `promptGate` | 能力数据记为不支持的目标（见第 4 节提示提交前检查表） | 声明需要时构建失败；否则不生成提示事件的 hook，并在构建报告中写明残余风险：提示不受检查 |

停机门禁没有统一的次数上限：Claude Code 与 Copilot CLI 为连续 8 次，DSH 与 CodeBuddy 没有，
Codex、Kimi Code 与 agy 的文档未写明。`continuations` 由适配器按会话保存，`beforeStop` 返回
`continue` 时加 1、返回 `stop` 时清零；插件据此自行设上限。

## 7. 失败处理

守卫逻辑出错时由入口收口：

- 子进程入口的异常收口以[入口与打包接口](../../architecture/runtime-interfaces.md#3-子进程入口)
  为准：执行前与提示提交前检查按该目标的拒绝写法输出（第 4 节；Copilot CLI 为
  `permissionDecision: "deny"`，其余为退出码 2 并在 stderr 写原因），停机前检查不阻止结束，
  执行后检查（v0.2.0）输出扣留。Codex 把 stderr 为空的退出码 2 记为 hook 失败并放行，因此原因
  不能省略。执行后 hook 进程出错或超时时，Claude Code 与 Codex 都保留原输出（2.1.296 实测；
  rust-v0.162.1 源码核对），即下表的放行。
- hooks 模块用 `.catch` 收口：执行前检查写作
  `.catch(($, e, next) => next.called ? next(e) : { deny: '...' })`，提示提交前检查写作
  `.catch(($, e, next) => next.called ? next(e) : { drop: '...' })`，执行后检查返回 `{ deny }`。
  未写 `.catch` 时，失败的 hook 被跳过，等同放行。

hook 进程未能启动、崩溃或超时时，由宿主的默认行为决定：

| 目标 | 默认行为 | 默认超时 |
|---|---|---|
| `claude-code:subprocess` | 放行；处理器写 `onFailure: "block"`（2.1.295 起）时 `PreToolUse` 与 `UserPromptSubmit` 改为阻断；2.1.299 起 Windows 上未设 `shell` 且缺少 Git for Windows 的 `PreToolUse` 阻断 | 600 秒 |
| `codex:subprocess` | 放行：非 0 非 2 退出码、超时、启动失败、非法 JSON 均放行 | 600 秒 |
| `copilot-cli:subprocess` | `preToolUse` 非零退出码拒绝；超时对所有事件放行 | 30 秒 |
| `cursor:subprocess` | 放行；生成的配置设 `failClosed: true`，崩溃、超时、无输出均阻断 | 未核实 |
| `agy:subprocess` | `PreToolUse` 出错、超时或 stdout 不是 JSON 时阻断；`Stop` 出错时照常结束（1.3.4 本地实测） | 30 秒 |
| `kimi:subprocess` | 放行 | 30 秒 |
| `kiro:workspace-hook` | CLI 放行；IDE 文档矛盾；超时后的行为未说明 | IDE 60 秒（忽略 hook 的 `timeout`）；CLI 文档写 30 秒或 60 秒 |
| `codebuddy:subprocess` | 放行 | 60 秒 |
| `opencode:in-process`、`dsh:cordis` | 抛错即阻断 | 不适用 |

- 超时只在字段名已核实的目标上写出，取 30 秒（agy、Copilot CLI 与 Kimi Code 的默认值）：
  agy 为 `timeout`（秒，1.3.4 实测生效），Copilot CLI 为 `timeoutSec`，Kimi Code 为
  `timeout`（秒，1～600），Claude Code 为 `timeout`（秒，2.1.296 实测生效，超时放行）。
  Codex 为 `timeout`（秒，rust-v0.162.1 源码核对）。
  守卫逻辑的耗时应远低于 30 秒。
- 在默认放行的目标上，守卫在入口无法启动时失效（例如缺少解释器），构建报告列为残余风险。
  子进程入口以 Node 运行，打包为 ES2022 ESM 单文件，见
  [ARCH-001](../../architecture/ARCH-001-agent-plugin-build-tool.md)。
- Claude Code 的 `onFailure: "block"` 把入口无法启动、非 0 非 2 退出码、超时与无效输出都按退出码 2
  处理，对 `Stop` 与 async hooks 无效（2.1.296 容器实测入口缺失时阻断，见
  [Claude Code hooks](claude-code-hooks.md#失败处理与-onfailure)）。缺少 Node 时它会阻断每次工具调用
  与提示，即使 hooks 模块已生效，因此只能作为插件作者显式选择的选项。

## 8. 状态与存储

| 目标 | 会话内状态 | 跨会话存储 |
|---|---|---|
| `claude-code:in-process` | `$.state`，键为 `{ plugin, key }` 字面量，类型在 `types/index.d.ts` 中声明 | `$.store`，每个插件一个 JSON，上限 4 MiB |
| `claude-code:subprocess`、`codebuddy:subprocess`、`codex:subprocess`、`copilot-cli:subprocess` | 插件数据目录下以 `session_id` 命名的文件，先写临时文件再重命名 | 插件数据目录：`CLAUDE_PLUGIN_DATA`、`CODEBUDDY_PLUGIN_DATA`、`PLUGIN_DATA`、`COPILOT_PLUGIN_DATA` |
| `agy:subprocess`、`kimi:subprocess` | 宿主没有插件数据目录；系统临时目录下 `uapa-<插件名>/` 中以会话 id 命名的文件，先写临时文件再重命名，临时目录被清理时计数归零（功能清单 SD-06） | 不提供 |
| `cursor:subprocess`、`kiro:workspace-hook` | 宿主没有插件数据目录，待定 | 不提供 |
| `opencode:in-process` | 插件闭包内以会话 id 为键的 `Map` | v1 无约定 |
| `dsh:cordis` | 以 agent 为键的 `Map`，在 `agent/disposed` 时清理 | `ctx.storageDomain`，json 后端位于 `$DSH_HOME/storages` |

会话结束时只清理会话内状态，不删除跨会话存储。

## 9. 测试

| 层级 | 内容 |
|---|---|
| 守卫逻辑 | 对 `beforeTool`、`beforePrompt`、`afterTool`、`beforeStop` 做单元测试，不涉及宿主 |
| 工具名映射 | 每个目标按能力数据中的 `toolNames` 构造宿主工具名，断言换算结果 |
| `claude-code:in-process` | `claude plugin validate` 与 `claude plugin test`（`*.test.ts`），见 [Mods 指南](claude-code-mods-guide.md#验证测试与调试) |
| 子进程目标 | 按各宿主文档的输入字段构造 stdin JSON（如 Claude Code 的 `tool_response`），断言退出码、stdout JSON 与 stderr |
| 双形态去重 | 同一插件同时声明两种形态，断言模块生效时命令 hook 提前退出（第 5 节） |
| `dsh:cordis` | DSH 仓库的 `packages/test-support/` 为内部支持包，没有面向第三方的稳定测试 API，测试方式待定 |

存在文档内部不一致的项（Kiro 的退出码与超时、CodeBuddy 的子代理工具名、Kiro CLI 2.x 的待办
工具名），在目标版本上挂一个记录输入的 hook 实测后再写入能力数据。

## 来源

- [H1] Claude Code 插件排障：
  <https://code.claude.com/docs/en/plugins/troubleshooting#failed-to-load-hooks-from-and-hooks-that-dont-fire>
- [H2] anthropics/claude-code#94402：<https://github.com/anthropics/claude-code/issues/94402>
- [H3] anthropics/claude-code#31763：<https://github.com/anthropics/claude-code/issues/31763>
- [H4] anthropics/claude-code#76451：<https://github.com/anthropics/claude-code/issues/76451>
