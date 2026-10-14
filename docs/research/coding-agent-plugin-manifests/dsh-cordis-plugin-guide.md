# DSH Cordis 插件开发指南

本文说明如何为 DeepSeek Harness（DSH）编写 Cordis 插件：模块导出、服务与依赖注入、
生命周期与副作用回收、工具拦截与停机门禁，以及运行 Claude Code mods 与命令 hooks 的兼容包。
bundle、profile、`cordis.patch.yml` 与配置分层见 [DSH 插件](dsh-plugins.md)。

事实依据为 `deepseek-ai/deepseek-harness` master 提交 `d743267388`（2026-10-09，
DSH 0.2.1-alpha.2，Cordis 4.0.5-alpha.1）的文档与源码，核对日期 2026-10-13；
`path:line` 均相对仓库根目录。标为“示意写法”的代码未经编译验证。

## 插件模块

插件是导出 `apply` 的 ESM 模块。`name` 为插件名，`inject` 列出依赖的服务，
`Config` 是配置 schema（`@deepseek-ai/schemastery`，满足 Standard Schema 接口），
加载时 Cordis 用它校验配置并填充默认值 [P1]。

```ts
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

export const name = 'my-plugin'
export const inject = ['tools']

export interface Config {
  maxRetries: number
}

export const Config: Schema<Config> = Schema.object({
  maxRetries: Schema.number().default(3),
})

export function apply(ctx: Context, config: Config) {
  // 在此注册监听器、工具或服务
}
```

- 不要把普通对象导出为 `Config`，它不满足 Standard Schema 接口 [P1]。
- 访问未在 `inject` 中声明的服务会抛出 `cannot get property "<name>" without inject`
  （`vendor/cordis/src/reflect.ts:144`）；声明了但服务未激活时，错误为
  `cannot get required service "<name>" in inactive context` [P5]。
- 需要可选依赖时用 `ctx.get(name)` 读取：不受 `inject` 约束，服务未提供时返回 `undefined`
  （`vendor/cordis/src/reflect.ts:224-235`）[P5]。

## 服务与依赖注入

长期存在、供其他插件调用的能力封装为 `Service`。构造函数签名为 `(ctx, name)`，
`name` 缺省时取类的静态字段 `provide`；服务在所属 fiber 卸载时自动注销
（`vendor/cordis/src/service.ts:36-62`）[P5]。

```ts
import { Context, Service } from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Context {
    audit: AuditService
  }
}

export class AuditService extends Service {
  static inject = ['logger']

  constructor(ctx: Context) {
    super(ctx, 'audit')
  }

  record(reason: string) {
    this.ctx.logger('audit').warn(reason)
  }
}
```

上例为示意写法。`declare module` 声明合并为 `ctx.audit` 提供类型，DSH 自身的服务
（如 `packages/core/tools/src/index.ts:138-141` 的 `tools`）采用同样写法 [P5]。

工具与环境相关的核心服务均已存在：`tools`、`sessions`、`logger`、`sandbox`、`sandboxPolicy`、
`workingDirectory`、`subprocess`、`systemPrompt`、`llm` [P5]。

## 生命周期与副作用回收

| 项目 | 事实 | 位置 |
|---|---|---|
| fiber 状态 | `PENDING`、`LOADING`、`ACTIVE`、`FAILED`、`DISPOSED`、`UNLOADING` | `vendor/cordis/src/fiber.ts:147-154` |
| `ctx.effect(execute)` | `execute` 立即执行；其产生的清理函数在调用返回的 disposer 或 fiber 卸载时按逆序串行执行；重复调用 disposer 无效果；fiber 已销毁时抛 `INACTIVE_EFFECT` | `fiber.ts:402-441` |
| fiber 卸载 | 逆序启动各 effect 的清理，但用 `Promise.all` 并发等待，不是严格串行 | `fiber.ts:675-676` |
| `ctx.on` | 经 `fiber.effect` 注册，卸载时自动注销 | `vendor/cordis/src/events.ts:254-259` |
| 定时器 | `ctx.timeout` / `ctx.interval`（`vendor/timer`）随 fiber 回收；`ctx.setTimeout` / `ctx.setInterval` 已标记弃用 | `vendor/timer/src/index.ts:12-28` |
| 热重载 | 每个注册都是一个 effect，仓库自带的 HMR 可直接卸载并重新应用插件 | [P2] |

```ts
export function apply(ctx: Context) {
  ctx.effect(() => {
    const handle = startWatcher()
    return () => handle.close()
  })
}
```

上例为示意写法，`startWatcher` 代表任意需要关闭的资源。

`apply` 在插件加载时执行一次，而一个 DSH 进程可承载多个 agent 与会话。按会话变化的状态
不要放在 `apply` 的闭包变量里，应以 agent 或会话为键保存，并在 `agent/disposed` 时清理
（`agent/created` 为 serial，`agent/disposed` 为 emit，见
`packages/core/agent/src/runtime-types.ts:261,270`）[P5]。

## 事件原语

Cordis 提供 `emit`、`parallel`、`serial`、`bail`、`waterfall` 五种分发方式，以及 `on` / `once`
注册（`vendor/cordis/src/events.ts:183-234`）。没有 `broadcast`、`pipeline` 或 `ctx.fork`；
需要隔离服务实例时用 `ctx.isolate(name, label?)`（`vendor/cordis/src/context.ts:121-124`）[P5]。

## 拦截工具调用

工具调用依次经过 `tools/pre-execute`、`tools/execute`、`tools/post-execute` 三个 waterfall，
最后由 `tools/result` 只读观察（`packages/core/tools/src/index.ts:144-177`）[P5]。

| 扩展点 | 用途 |
|---|---|
| `tools/pre-execute` | 返回 `allow`、`deny { reason }`、`cancel` 或 `ask`；`next()` 等同 `allow` |
| `ctx.tools.guard()` | 需要单调的最终拒绝时使用 |
| `tools/execute` | 包裹分发做超时、重试、指标；只能替换 `exec.signal` |
| `tools/post-execute` | 返回 `accept`（可替换 `content` 或 `value`，可附 `additionalContexts`）或 `block { feedback }` |
| `tools/result` | 观察不可变的最终结果，用于审计与指标 |

执行前拦截，取自官方 cookbook [P2]：

```ts
import type { Context } from '@deepseek-ai/cordis'
import type { PreToolDecision, ToolExecution } from '@deepseek-ai/dsh-tools'

declare function isAllowed(exec: ToolExecution): Promise<boolean>

export const name = 'permission-gate'

export function apply(ctx: Context) {
  ctx.on('tools/pre-execute', async (exec, next): Promise<PreToolDecision> => {
    if (!(await isAllowed(exec))) {
      return { kind: 'deny', reason: 'Denied by policy.' }
    }
    return next()
  })
}
```

执行后替换输出（示意写法，结构参照 `packages/experimental/hooks-claude-code/src/index.ts:253-271`）：

```ts
const SECRET = /\bsk-[A-Za-z0-9_-]{32,}/g

ctx.on('tools/post-execute', async (exec, result, next): Promise<PostToolDecision> => {
  const downstream = await next()
  if (downstream.kind === 'block' || result.isError) return downstream
  const text = result.content.map(block => (block.type === 'text' ? block.text : '')).join('')
  const redacted = text.replace(SECRET, '[REDACTED]')
  if (redacted === text) return downstream
  return {
    kind: 'accept',
    content: [{ type: 'text', text: redacted }],
    ...(downstream.additionalContexts ? { additionalContexts: downstream.additionalContexts } : {}),
  }
})
```

**不能改写工具入参。** `exec.arguments` 在策略执行前已记录并深度冻结，`PreToolDecision`
不含改写选项；源码注释说明了原因："Input rewriting is excluded because arguments are already
logged"（`packages/core/tools/src/index.ts:599-607`）。仓库中有一份入参改写的提案说明，
状态为提案，未实现 [P5]。需要纠正命令时，返回 `deny` 并在 `reason` 中给出正确写法。

**监听器抛错时按拒绝处理。** `tools/pre-execute` 的监听器抛错时，工具不会执行，调用以
`Error: <message>` 的错误结果结束；`tools/post-execute` 的监听器抛错时，原输出被同样的错误
结果替换，模型读不到原输出（`packages/core/tools/src/index.ts:1542-1543,1655-1663`）[P5]。

## 停机门禁

回合即将结束时触发 `agent/turn-stopping`（serial）。监听器若要求继续，调用
`agent.steer(message)`；引擎随后重新读取收件箱，有新的引导消息就再运行一步，没有就结束回合。
结果由数据决定，与监听器顺序无关（`packages/core/agent/src/runtime-types.ts:364-381`）[P5]。

```ts
ctx.on('agent/turn-stopping', async ({ agent, turn }) => {
  if (await checksPassed(agent)) return
  agent.steer(createUserMessage({
    content: [{ type: 'text', text: '检查未通过，请先修复再结束。' }],
    source: GATE_SOURCE,
  }))
})
```

上例为示意写法。`createUserMessage` 来自 `@deepseek-ai/dsh-llm`；`source` 需先在
`MessageSourceMap` 中经声明合并登记，写法见
`packages/experimental/hooks-claude-code/src/index.ts:19-23,93`。DSH 目前没有连续强制继续的
次数上限（同文件第 275 行的 TODO 注明由 hook 自行限制），门禁插件应自行计数并设上限 [P5]。

## 会话、存储与沙箱

| 项目 | 事实 | 依据 |
|---|---|---|
| 会话模型 | 事件溯源，`SessionEvent` 只追加；运行时会话在内存中的 `ctx.sessions` | `docs/subsystems/session.md` |
| 持久化 | 只发布 JSONL 后端，每个会话一个 `.jsonl.zstd` 文件；没有 SQLite 持久化后端 | `packages/session/session-persistence/README.md` |
| SQLite 用途 | 只用于 session-query 的 FTS5 派生索引 | `packages/session-query/session-query-sqlite/README.md` |
| 沙箱 | Linux 先用 bwrap 再用 Landlock；macOS 用 Seatbelt；Windows 用 ACL 受限令牌；没有 Docker 驱动；远程执行另有 e2b、ssh 包 | `packages/sandbox/sandbox-local/README.md` |
| Web 默认端口 | 3080 | `packages/bundle/web-app/cordis.patch.yml:184` |
| 插件持久数据 | `ctx.storageDomain`：用 `defineDomain({ name, version, tables })`（记录 schema 用 zod）声明领域，`await ctx.storageDomain.open(spec)` 打开；读取同步，写入落盘后才完成 | `packages/storage/storage-domain/README.md` |
| 存储后端 | `@deepseek-ai/dsh-base` 默认组合 `storage`、`storage-json`、`storage-domain`，JSON 文件位于 `$DSH_HOME/storages` | `packages/bundle/base/cordis.patch.yml:170-185` |
| 插件测试 | `packages/test-support/` 下的 `dsh-loader-smoke`、`dsh-llm-replay` 等用于仓库自身测试，README 称其为支持层；面向第三方插件的稳定测试接口未见文档 | `packages/test-support/README.md` |

领域句柄通常在 `ctx.effect` 的清理函数中关闭；插件卸载时，未关闭的领域也会被关闭 [P5]。

## Claude Code mods 兼容层

`@deepseek-ai/dsh-experimental-claude-code-mods`（`packages/experimental/claude-code-mods`）
在 DSH 扩展点上加载并运行 Claude Code hooks 模块。README 的表述是“A mod is a plugin”：
`defineMod` 把 mod 的 `register` 函数与身份信息包装成一个 Cordis 插件 [P3]。
该包由上游提交合入于 2026-10-03；提交信息中的 PR 编号 #5623 是上游内部编号，
与公开仓库的编号不对应。

```ts
import { defineMod, type ModOn } from '@deepseek-ai/dsh-experimental-claude-code-mods'

declare const register: (on: ModOn, options: Readonly<Record<string, unknown>>) => void

export default defineMod({ name: 'token-weather', version: '0.1.0', root: import.meta.dirname, register })
```

先挂载兼容包，再按链顺序挂载各 mod [P3]：

```yaml
- name: '@deepseek-ai/dsh-experimental-claude-code-mods'
- name: './mods/token-weather/index.ts'
```

| 兼容包配置 | 默认值 | 含义 |
|---|---|---|
| `hookTimeoutMs` | `10000` | 单个 hook 自身的运行时间；`next` 与 `$` 调用内的时间不计（`src/chain.ts:50` 的 `BudgetClock`） |
| `catchTimeoutMs` | `1000` | `.catch` 处理器的运行时间 |
| `processTimeoutMs` | `30000` | `$.process.run` 与 `$.http.fetch` 的默认超时 |
| `toolAliases` | — | Claude Code 工具名到 DSH 工具名的补充映射 |

事件映射 [P3]：

| mod 事件 | DSH 来源 |
|---|---|
| `session.start` / `session.end` | 根 agent 的 `agent/created` / `agent/disposed` |
| `prompt.submit`、`turn.start` | `agent/pre-step` |
| `tool.call` | 包裹 `tools/execute`，在 DSH 权限决定之后运行 |
| `turn.complete` | 会话事件 `turn/end` |
| `ui.render` | 只服务 `AbovePrompt` 横幅 |
| `command.run` | `$.command.register` 注册的命令 |

与 Claude Code 的主要差异 [P3]：

- `tool.call` 中改写入参或改道到其他工具的 hook 会被跳过并报告（`RewriteRefusedError`，
  `src/chain.ts:160`）；`{ deny }` 与 `{ result }` 可用。
- 不提供沙箱与静态检查：模块在 DSH 进程内运行，可使用 Node 全局对象，拥有进程的全部权限；
  `claude plugin validate`、类型生成、热重载均未实现。
- 一个进程承载多个会话：模块级变量与 `$.env.set` 由所有会话和插件共享，按会话的数据应放在
  `$.state`。
- `classic.*` 事件在 `register` 时被拒绝；其他未服务的事件可注册但不会触发，加载时告警。
- 只绘制 `AbovePrompt`；`$.ui.open` 返回 `{ isPlaced: false }`，`$.ui.toast` / `status`
  只写入宿主日志。
- 不读取 `plugin.json` 与 `hooks.json`；身份由 `defineMod` 给出。

测试工具 `createModTestKit` 位于子路径 `/testing`，接口形状与 `claude-code/testing` 一致 [P3]。

## 命令 hooks 兼容包

`@deepseek-ai/dsh-hooks-claude-code` 运行 Claude Code `hooks.json` 或 settings 中的命令 hooks，
`@deepseek-ai/dsh-hooks-codex` 运行 Codex hooks 配置。前者的事件对应关系 [P4]：

| Claude Code 事件 | DSH 扩展点 | 可用效果 |
|---|---|---|
| `SessionStart` | `agent/created` | 附加上下文 |
| `UserPromptSubmit` | `agent/pre-step` | 阻断提示词或附加上下文 |
| `PreToolUse` | `tools/pre-execute` | `deny`、`ask`；`updatedInput` 记录并警告但不应用 |
| `PostToolUse` | `tools/post-execute` | 带反馈阻断或附加上下文 |
| `Stop` | `agent/turn-stopping` | 经 `steer()` 再运行一步 |

默认超时 600000 ms，与 Claude Code 一致；配置无法读取时记录警告且不运行任何 hook；
hook 命令失败时记录后继续运行 [P4]。

## 常见错误

| 现象 | 原因 | 处理 |
|---|---|---|
| `cannot get property "x" without inject` | 使用了未声明的服务 | 把服务名加入 `inject`，或改用 `ctx.get('x')` |
| 后层 patch 后插件配置丢字段 | patch 按行替换 `config`，不做深合并 | 在后层写出完整的 `config` |
| 想用 `remove` 删除一行 patch | 不存在该关键字，会被当作普通字段 | 改用 `disabled: true` |
| 回合被反复强制继续 | `agent/turn-stopping` 没有次数上限 | 在插件内按回合计数并设上限 |
| mod 在 DSH 中改写入参无效 | 兼容层拒绝入参改写 | 改为 `{ deny }` 并给出纠正提示 |

## 来源

- [P1] 插件配置：
  <https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/config.md>
- [P2] Extension cookbook：
  <https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/extension-cookbook.md>
- [P3] Claude Code mods 兼容包 README：
  <https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/experimental/claude-code-mods/README.md>
- [P4] Claude Code hooks 兼容包 README：
  <https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/experimental/hooks-claude-code/README.md>
- [P5] 源码：`deepseek-ai/deepseek-harness` master 提交 `d743267388`，路径相对仓库根目录
