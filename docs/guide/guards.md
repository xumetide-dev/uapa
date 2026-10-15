# 编写守卫

守卫让插件在宿主事件上做判断：工具执行前放行、拒绝或改写，提示提交前拦截，工具执行后替换或
扣留输出，停机前要求继续。本文说明守卫文件的写法、各检查的决策、宿主缺少能力时的处理与测试
方法。公共类型的权威定义在
[hooks 适配 §2](../research/coding-agent-plugin-manifests/uapa-hook-adapters.md#2-公共类型)，
各决策在宿主中的输出见同文 §4。

## 守卫文件

配置的 `guard` 指向一个 TypeScript 文件，默认导出 `GuardPlugin`：

```ts
interface GuardPlugin {
  readonly name: string
  readonly requires: readonly Capability[] // 必需的能力，见下文「能力缺失时的处理」
  beforeTool?(call: ToolCall): BeforeTool | Promise<BeforeTool>
  beforePrompt?(p: PromptSubmit): BeforePrompt | Promise<BeforePrompt>
  afterTool?(call: ToolCall, output: string): AfterTool | Promise<AfterTool>
  beforeStop?(s: { sessionId: string; continuations: number }): BeforeStop | Promise<BeforeStop>
}
```

- 只为实现了的方法生成 hooks；四个方法都不写时不生成守卫 hooks 与入口。
- 类型从 `'uapa'` 导入：`GuardPlugin`、`ToolCall`、`BeforeTool`、`PromptSubmit`、
  `BeforePrompt`、`AfterTool`、`BeforeStop`、`Capability`。
- 构建时 UAPA 导入守卫文件，读取 `name`、`requires` 与已实现的方法，再把它打包进各目标的入口；
  模块顶层的代码在构建时也会运行。

## 约束

同一份守卫代码要在 Claude Code 的 hooks 模块（没有 Node）与各宿主的子进程入口中运行，因此：

- 只用公共类型与语言内置对象，不导入 Node、Bun 或宿主 API，不做文件、网络与进程 I/O。
- 相对导入的 `.ts` 文件随守卫一起打包；导入写 `.ts` 扩展名。
- 不用 Node 类型剥离不支持的语法：`enum`、`namespace`、参数属性。
- 判断应在远低于 30 秒内返回：子进程目标的 hooks 超时为 30 秒，超时后的处理见
  [失败处理](#失败处理)。

## 示例

下例实现了四种检查（在 [快速上手](getting-started.md) 的守卫上增加执行后与停机前检查）：

```ts
import type { AfterTool, BeforeTool, GuardPlugin } from 'uapa'

const MAX_OUTPUT = 20_000

function checkShell(command: string): BeforeTool {
  if (command.includes('--no-verify')) {
    return { kind: 'deny', reason: '不要跳过 git hooks：去掉 --no-verify 后重试' }
  }
  if (command.startsWith('npm install')) {
    return {
      kind: 'rewrite',
      input: { command: command.replace('npm install', 'pnpm install') },
      fallbackReason: '本仓库使用 pnpm：请改用 pnpm install',
    }
  }
  return { kind: 'allow' }
}

function checkOutput(output: string): AfterTool {
  if (output.includes('PRIVATE KEY-----')) {
    return { kind: 'withhold', reason: '输出中含私钥，已扣留' }
  }
  if (output.length > MAX_OUTPUT) {
    return { kind: 'replace', text: `${output.slice(0, MAX_OUTPUT)}\n（输出过长，已截断）` }
  }
  return { kind: 'keep' }
}

const guard: GuardPlugin = {
  name: 'team-rules',
  requires: [],
  beforeTool: call =>
    call.tool === 'shell' ? checkShell(String(call.input.command)) : { kind: 'allow' },
  beforePrompt: p =>
    p.prompt.includes('PRIVATE KEY-----')
      ? { kind: 'block', reason: '提示中含私钥，已拦下' }
      : { kind: 'allow' },
  afterTool: (_call, output) => checkOutput(output),
  beforeStop: s =>
    s.continuations === 0
      ? { kind: 'continue', reason: '结束前运行 pnpm test 并报告结果' }
      : { kind: 'stop' },
}

export default guard
```

## 执行前检查 `beforeTool`

`ToolCall` 含 `sessionId`、`tool` 与 `input`。`tool` 是换算后的规范名，生成的 hooks 不按工具
筛选，每次工具调用都进入 `beforeTool`，筛选写在方法中：

| 规范名 | Claude Code | Codex | agy |
|---|---|---|---|
| `shell` | `Bash`、`PowerShell` | `Bash` | `run_command` |
| `read_file` | `Read` | — | `view_file` |
| `edit_file` | `Edit` | `apply_patch` | `replace_file_content`、`multi_replace_file_content` |
| `write_file` | `Write` | — | `write_to_file` |
| `glob`、`grep` | `Glob`、`Grep` | — | `find_by_name`、`grep_search` |
| `web_fetch`、`web_search` | `WebFetch`、`WebSearch` | — | `read_url_content`、`search_web` |
| `subagent` | `Agent` | `spawn_agent` | `invoke_subagent` |
| `todo` | `TaskCreate` 等、`TodoWrite` | `update_plan` | — |

- 表中没有的工具以 `host:<原名>` 传入，如 `host:NotebookEdit`。
- Codex 把编辑与新建合为 `apply_patch`，换算为 `edit_file`；检查文件写入时同时覆盖 `edit_file`
  与 `write_file`。
- `shell` 的入参换算为 `{ command }`；其他工具的入参是宿主原样的字段，字段名因宿主而异。

| 决策 | 效果 |
|---|---|
| `{ kind: 'allow' }` | 放行 |
| `{ kind: 'deny', reason }` | 拒绝，代理读到 `reason` |
| `{ kind: 'rewrite', input, fallbackReason }` | 以新入参执行；目前只对 `shell` 的 `command` 做反向换算 |

宿主不能改写入参时，`rewrite` 按 `fallbackReason` 拒绝，构建报告记为降级。v0.2.0 的三个宿主
都能改写入参。

## 提示提交前检查 `beforePrompt`

`PromptSubmit` 含 `sessionId` 与 `prompt`（用户提交的原文）。返回 `{ kind: 'allow' }` 或
`{ kind: 'block', reason }`。

- Claude Code 与 Codex 拦下提示后不调用模型（Claude Code 2.1.296 本地实测，codex-cli 0.162.1
  容器实测）。Codex 的 TUI 显示 `reason`，`codex exec` 只显示 `Blocked`。
- agy 没有提示提交事件：不生成该 hook，构建报告写残余风险“提示不受检查”。

## 执行后检查 `afterTool`

`output` 是工具输出的文本形式。返回 `{ kind: 'keep' }`、`{ kind: 'replace', text }` 或
`{ kind: 'withhold', reason }`。

| 宿主 | 处理 |
|---|---|
| Claude Code | 只能替换 Bash、Read 这类形状可替换的输出；其他工具上的决策按构建报告列出的残余风险处理 |
| Codex | 不能替换输出：`replace` 按扣留写出，`text` 作为扣留说明，记为降级；只对执行成功的调用触发 |
| agy | 不能替换也不能扣留：不生成执行后 hook，记为残余风险 |

## 停机前检查 `beforeStop`

返回 `{ kind: 'stop' }` 结束本轮，或 `{ kind: 'continue', reason }` 让代理继续并读到 `reason`。
`continuations` 是连续返回 `continue` 的次数，返回 `stop` 时清零；用它给强制继续设上限，否则
代理可能一直无法结束。上例每轮最多继续一次。

- 宿主自身的上限：Claude Code 为连续 8 次；Codex 与 agy 的文档未写明。
- agy 没有插件数据目录，计数存放在系统临时目录下的 `uapa-<插件名>/`，该目录被清理时计数归零。

## 能力缺失时的处理

| 能力 | 含义 | 缺少的目标（v0.2.0） | 未列入 `requires` 时 |
|---|---|---|---|
| `rewriteInput` | 改写工具入参 | 无 | `rewrite` 按 `fallbackReason` 拒绝，记为降级 |
| `replaceOutput` | 替换工具输出 | `codex:subprocess`、`agy:subprocess` | `replace` 按扣留写出，记为降级 |
| `withholdOutput` | 扣留工具输出 | `agy:subprocess` | 不生成执行后 hook，记为残余风险 |
| `stopGate` | 阻止停机 | 无 | 不生成停机 hook，记为残余风险 |
| `promptGate` | 拦截提示 | `agy:subprocess` | 不生成提示 hook，记为残余风险 |

在 `requires` 中列出的能力是硬要求：缺少该能力的目标构建失败，其余目标照常生成，退出码为 1。

```text
uapa: agy:subprocess: 守卫的 requires 声明了 promptGate，本目标缺少该能力
```

## 失败处理

- 守卫抛错或返回无效决策（如 `deny` 的 `reason` 为空）时，入口收口：执行前与提示提交前检查
  按拒绝处理，停机前检查不阻止结束，执行后检查扣留输出。
- 入口无法启动（如宿主机器缺少 Node ≥ 22）、崩溃或超时时，由宿主的默认行为决定：Claude Code
  与 Codex 放行；agy 的执行前检查阻断，停机前检查照常结束。构建报告把“放行”的情况列为残余风险。

出处与宿主版本见
[hooks 适配 §7](../research/coding-agent-plugin-manifests/uapa-hook-adapters.md#7-失败处理)。

## 测试守卫

守卫是普通的 TypeScript 对象，可以不经宿主直接做单元测试。`guard.test.ts`：

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import guard from './guard.ts'

const shell = (command: string) => ({ sessionId: 't', tool: 'shell', input: { command } })

test('拒绝 --no-verify', async () => {
  const decision = await guard.beforeTool?.(shell('git commit --no-verify -m x'))
  assert.equal(decision?.kind, 'deny')
})

test('把 npm install 改写为 pnpm install', async () => {
  const decision = await guard.beforeTool?.(shell('npm install zod'))
  assert.deepEqual(decision, {
    kind: 'rewrite',
    input: { command: 'pnpm install zod' },
    fallbackReason: '本仓库使用 pnpm：请改用 pnpm install',
  })
})
```

```bash
node --test guard.test.ts
```

测试文件不在 `skills/`、`agents/` 与 `overrides/` 中，不会进入插件目录。宿主中的端到端效果在
安装后的会话中确认，见[安装与分发](install.md)。
