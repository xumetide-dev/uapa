# UAPA hooks 适配设计提案

**状态：设计提案，未实现。** 仓库中没有对应代码，文中代码均为示意写法。

本文是 [统一代理插件架构（UAPA）设计提案](unified-agent-plugin-architecture.md) 的一部分，
说明守卫逻辑（阻断危险命令、扣留含密钥的工具输出、结束前检查）的公共类型，以及它在各构建
目标上如何换算为宿主的 hooks 协议：工具名映射、决策输出、Claude Code 双形态去重、能力缺失
与失败处理、状态与测试。目标列表与产物布局见设计提案第 5、9 节。核对日期为 2026-10-13。

## 1. 守卫逻辑的约束

- 守卫逻辑只用第 2 节的公共类型与语言内置对象，不导入 Node、Bun 或宿主 API，不做 I/O。
  同一份代码要在 Claude Code hooks 模块（没有 Node）、OpenCode（Bun）、DSH（Node）与子进程
  入口中运行。
- 适配器只做协议转换，不含业务判断。
- Claude Code hooks 模块只能导入相对路径文件与 `'claude-code'`，构建时把守卫逻辑打包为模块
  旁的相对文件。

## 2. 公共类型

```ts
export type Capability = 'rewriteInput' | 'replaceOutput' | 'withholdOutput' | 'stopGate'

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

export type AfterTool =
  | { kind: 'keep' }
  | { kind: 'replace'; text: string }
  | { kind: 'withhold'; reason: string }

export type BeforeStop = { kind: 'stop' } | { kind: 'continue'; reason: string }

export interface GuardPlugin {
  readonly name: string
  readonly requires: readonly Capability[]
  beforeTool?(call: ToolCall): BeforeTool | Promise<BeforeTool>
  afterTool?(call: ToolCall, output: string): AfterTool | Promise<AfterTool>
  // continuations 为本回合已强制继续的次数，供插件自行设上限
  beforeStop?(s: { sessionId: string; continuations: number }): BeforeStop | Promise<BeforeStop>
}
```

`afterTool` 只接收文本形式的输出。需要结构化输出时，按目标单独设计，不放进公共类型。

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
- 生成 hooks 配置时，matcher 按宿主写法生成：Copilot CLI 原生格式按 `^(?:PATTERN)$` 全匹配；
  CodeBuddy 不自动锚定，`Write` 也会匹配 `NotebookWrite`，需写成 `^Write$`。
- 宿主不提供工具名时（Kiro IDE 的命令 hook，#7375、#7500），工具以 `host:unknown` 传入，
  构建报告列为残余风险。

## 4. 决策到宿主输出的映射

| 目标 | `deny` | `rewrite` | `replace` / `withhold` | `continue`（停机门禁） |
|---|---|---|---|---|
| `claude-code:in-process` | 返回 `{ deny }` | `next({ ...e, ...input })` | `next` 之后返回 `{ result }`（须符合该工具的输出 schema）；扣留可返回 `{ deny }` | `classic.Stop` 返回 `{ block }` |
| `claude-code:subprocess` | 退出码 2 或 `permissionDecision: "deny"` | `hookSpecificOutput.updatedInput` | `updatedToolOutput`（v2.1.121+）；退出码 2 不能扣留 | `Stop` 返回 `decision: "block"` + `reason`，连续 8 次后强制结束 |
| `codex:subprocess` | 退出码 2（stderr 须非空）或 `permissionDecision: "deny"` | `updatedInput`（配合 `allow`） | 不能替换；扣留用 `PostToolUse` 的 `decision: "block"` 以反馈替换结果 | `Stop` 返回 `decision: "block"` + `reason` |
| `copilot-cli:subprocess` | 退出码 2 或 `permissionDecision: "deny"` + `permissionDecisionReason` | `modifiedArgs` | `modifiedResult` | `agentStop` 返回 `decision: "block"`，连续 8 次后结束 |
| `cursor:subprocess` | 退出码 2 或权限类 hook 返回 deny | `updated_input` | 只对 MCP 工具：`updated_mcp_tool_output` | 不支持 |
| `kimi:subprocess` | 退出码 2 或 `permissionDecision: "deny"` | 不支持 | 不支持 | `Stop` 退出码 2 |
| `kiro:workspace-hook` | 退出码 2 | 不支持 | 不支持 | 仅 CLI V3：退出码 1 或 `decision: "block"`；IDE 不支持 |
| `codebuddy:subprocess` | 退出码 2，原因写入 stdout | `modifiedInput` | `updatedToolOutput` | `continue: false` + `reason`，或退出码 2 |
| `opencode:in-process` | 在 `tool.execute.before` 中抛错 | 原地修改 `output.args` | 原地修改 `output.output` | 不支持 |
| `dsh:cordis` | `tools/pre-execute` 返回 `deny` | 不支持 | `tools/post-execute` 返回 `accept { content }`；扣留也可返回 `block { feedback }` | `agent/turn-stopping` 中调用 `agent.steer()` |

“扣留”在各目标上都实现为“以说明文字替换原输出”，原始命令已经执行，不能撤销。

## 5. Claude Code 双形态去重

同一个 Claude Code 插件同时声明 hooks 模块与命令 hooks，让两者互为兜底：支持 hooks 模块的
版本用模块，较旧的版本用命令 hooks。

### 文件布局

两种形态写在同一个 `hooks/hooks.json` 中：

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/command-entry.mjs\"" }]
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
// hooks/register.ts（示意写法）
import type { Register } from 'claude-code'

const MODULE_SESSION_ENV = 'COMMAND_GUARD_MODULE_SESSION'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.env.set(MODULE_SESSION_ENV, await $.session.id())
    return next(e)
  })
  // tool.call、classic.Stop 等守卫 hook 见 Mods 指南的示例
}
```

```js
// hooks/command-entry.mjs（示意写法）
const input = JSON.parse(await readStdin())
if (process.env.COMMAND_GUARD_MODULE_SESSION === input.session_id) process.exit(0)
// 以下运行与模块相同的守卫逻辑，按第 4 节输出命令 hooks 协议
```

- 比较会话 id 而不是只判断变量是否存在：在某个会话的 Bash 工具中启动的嵌套 Claude Code
  会话会继承父会话的环境变量，只判断存在会让嵌套会话错误地跳过命令 hook。
- 实测覆盖的是 `UserPromptSubmit`。`SessionStart` 事件上的命令 hook 能否看到同一会话
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
| `rewriteInput` | Kimi、Kiro、DSH | `rewrite` 一律按 `fallbackReason` 拒绝，在原因中写出纠正后的写法 |
| `replaceOutput` | Codex、Cursor（非 MCP 工具）、Kimi、Kiro | 声明需要时构建失败 |
| `withholdOutput` | Cursor（非 MCP 工具）、Kimi、Kiro | 声明需要时构建失败；否则在构建报告中写明残余风险：模型能读到原始输出 |
| `stopGate` | Cursor、OpenCode、Kiro IDE | 声明需要时构建失败；否则省略 `beforeStop` 并在构建报告中告警 |

停机门禁没有统一的次数上限：Claude Code 与 Copilot CLI 为 8 次，DSH 与 CodeBuddy 没有。
`beforeStop` 收到的 `continuations` 由适配器按会话计数，插件据此自行设上限。

## 7. 失败处理

守卫逻辑出错时由入口收口：

- 子进程入口捕获守卫逻辑的全部异常：执行前检查输出拒绝（退出码 2，并在 stderr 写非空的
  原因），执行后检查输出扣留。Codex 把 stderr 为空的退出码 2 记为 hook 失败并放行，因此原因
  不能省略。
- hooks 模块用 `.catch` 收口：执行前检查写作
  `.catch(($, e, next) => next.called ? next(e) : { deny: '...' })`，执行后检查返回 `{ deny }`。
  未写 `.catch` 时，失败的 hook 被跳过，等同放行。

hook 进程未能启动、崩溃或超时时，由宿主的默认行为决定：

| 目标 | 默认行为 | 默认超时 |
|---|---|---|
| `claude-code:subprocess` | 放行 | 600 秒 |
| `codex:subprocess` | 放行：非 0 非 2 退出码、超时、启动失败、非法 JSON 均放行 | 600 秒 |
| `copilot-cli:subprocess` | `preToolUse` 非零退出码拒绝；超时对所有事件放行 | 30 秒 |
| `cursor:subprocess` | 放行；生成的配置设 `failClosed: true`，崩溃、超时、无输出均阻断 | 未核实 |
| `kimi:subprocess` | 放行 | 30 秒 |
| `kiro:workspace-hook` | CLI 放行；IDE 文档矛盾；超时后的行为未说明 | IDE 60 秒（忽略 hook 的 `timeout`）；CLI 文档写 30 秒或 60 秒 |
| `codebuddy:subprocess` | 放行 | 60 秒 |
| `opencode:in-process`、`dsh:cordis` | 抛错即阻断 | 不适用 |

- 生成器在宿主支持的位置显式写出超时，守卫逻辑的耗时应远低于目标中最小的超时。
- 在默认放行的目标上，守卫在入口无法启动时失效（例如缺少解释器），构建报告列为残余风险。
  子进程入口的运行时选择见设计提案第 10 节。

## 8. 状态与存储

| 目标 | 会话内状态 | 跨会话存储 |
|---|---|---|
| `claude-code:in-process` | `$.state`，键为 `{ plugin, key }` 字面量，类型在 `types/index.d.ts` 中声明 | `$.store`，每个插件一个 JSON，上限 4 MiB |
| `claude-code:subprocess`、`codebuddy:subprocess`、`codex:subprocess`、`copilot-cli:subprocess` | 插件数据目录下以 `session_id` 命名的文件，先写临时文件再重命名 | 插件数据目录：`CLAUDE_PLUGIN_DATA`、`CODEBUDDY_PLUGIN_DATA`、`PLUGIN_DATA`、`COPILOT_PLUGIN_DATA` |
| `cursor:subprocess`、`kimi:subprocess`、`kiro:workspace-hook` | 宿主没有插件数据目录，待定 | 不提供 |
| `opencode:in-process` | 插件闭包内以会话 id 为键的 `Map` | v1 无约定 |
| `dsh:cordis` | 以 agent 为键的 `Map`，在 `agent/disposed` 时清理 | `ctx.storageDomain`，json 后端位于 `$DSH_HOME/storages` |

会话结束时只清理会话内状态，不删除跨会话存储。

## 9. 测试

| 层级 | 内容 |
|---|---|
| 守卫逻辑 | 对 `beforeTool`、`afterTool`、`beforeStop` 做单元测试，不涉及宿主 |
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
