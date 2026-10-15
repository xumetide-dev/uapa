# Claude Code Mods 开发指南：hooks 模块

本文说明 Claude Code 插件中 hooks 模块（function hooks，官方亦称 mod）的运行环境、
文件布局、常用事件与返回值、失败处理、状态与界面接口，以及验证与测试方法。
插件 manifest 与命令 hooks 的语义见 [Claude Code 插件](claude-code-plugins.md)。

核对基准：官方 Mods 文档 [M1][M2][M4][M5][M6] 与 Claude Code 2.1.296 的
`claude plugin validate` / `claude plugin test` / `claude -p` 本地实测（见
[本地实测记录](claude-code-local-tests.md)），核对日期 2026-10-13，静态分析与 `$.state` 用法
2026-10-14 补充。Mods 处于 early access，接口可能随版本变化；以所用版本随附的类型声明
（下称“类型声明”）为准。

## 定位与运行环境

- hooks 模块在 `hooks/hooks.json` 的 `modules` 中声明，只写一个相对该文件的路径。
  CHANGELOG 记载 v2.1.287 加入 Claude Mods，终端版自该版本起默认启用 [M3]。
- 模块导出 `register(on, options)`。`on(event, matcher?, hook)` 注册钩子；`options` 为
  manifest `userConfig` 中各字段的取值。
- 每个钩子形如 `($, e, next)`：`$` 是引擎接口，`e` 是事件输入（只读的普通值），
  `next(e)` 继续执行下层插件与引擎自身行为，并返回事件结果。不调用 `next` 即由该钩子
  直接作答；`next({ ...e, x })` 改写下层看到的输入。
- 模块运行在宿主提供的独立环境中：**没有 DOM，也没有 Node**，没有 `require`，含
  `import()` 的模块不加载。模块只能以 `import` 声明引入本插件内的相对路径文件与
  `'claude-code'`；`import 'node:fs'` 在 `validate` 阶段即报错（本地实测）。文件系统、
  进程、环境变量、存储、时钟、模型调用等均通过 `$` 访问。
- 可用后缀：`.ts`、`.tsx`、`.jsx`、`.js`、`.mjs`、`.cjs`、`.mts`、`.cts`，一律按 ES module 处理。
  JSX 以全局 `h`、`Fragment` 编译；`Box`、`Text`、`Button` 等元素不是全局变量，
  由 `$.ui.resolve(e)` 按绘制面返回。
- 每个钩子在一次分发内有自己的时间预算（等待 `next` 或 `$` 调用的时间不计入）；
  `next.signal` 在分发被放弃时中止。需要跨分发持续的工作从 `session.start` 启动，
  用 `$.clock.every` / `$.clock.after` 维持 [M2]。

宿主内部如何转译与隔离模块不属于公开契约，本文不作描述。

## 文件布局

```text
command-guard/
├── .claude-plugin/plugin.json   # name、version、description、types、userConfig
├── hooks/hooks.json             # { "modules": ["./register.ts"] }
├── hooks/register.ts            # export const register: Register = (on, options) => { ... }
├── types/index.d.ts             # 类型契约：声明 $.state 中的值（使用 $.state 时必需）
└── tests/guard.test.ts          # claude plugin test 运行的测试
```

`hooks/hooks.json` 可同时保留 `"hooks"`（命令 hooks）。二者在同一事件上都会执行，
去重方法见 [UAPA hooks 适配 §5](uapa-hook-adapters.md#5-claude-code-双形态去重)。

### 类型契约

使用 `$.state` 的模块需要一个自包含的 `.d.ts`，在 `plugin.json` 中以
`"types": "./types/index.d.ts"` 声明：

```typescript
export type GuardCounts = { denied: number; withheld: number }

declare module 'claude-code' {
  interface PluginState {
    'command-guard': { counts: GuardCounts }
  }
}
```

- 契约文件不含任何 `import` 或 `reference`；模块从 `'../types'` 引入其中的类型。
- `claude plugin validate` 核对模块读写的每个 `$.state` 键都在契约中声明。
- 为 `$` 增加新接口（noun）的插件，同样在契约中以
  `interface EngineInterface { ... }` 声明，依赖它的插件通过 `dependencies` 获得类型。

### 编辑器类型与 tsconfig

引擎从被监视的目录加载 mod 时，会在 `<mod>/.claude-plugin/types/` 写入类型声明与一份
`tsconfig.json`，`tsc -p <mod>` 即可类型检查；其他情况使用类型声明文件头给出的配置：

```json
{
  "compilerOptions": {
    "target": "es2023", "lib": ["es2023"], "types": [],
    "module": "esnext", "moduleResolution": "bundler",
    "strict": true, "noUncheckedIndexedAccess": true,
    "noEmit": true, "skipLibCheck": true,
    "jsx": "react", "jsxFactory": "h", "jsxFragmentFactory": "Fragment"
  },
  "include": [".claude-plugin/types", "hooks", "types", "tests"]
}
```

`lib` 不含 `dom`：运行环境没有 DOM，且 DOM 的全局 `Text` 会遮蔽同名元素类型。

## 常用事件与返回值

完整事件清单与每个事件的输入、结果类型以类型声明为准。

| 事件（matcher） | `e` 的主要字段 | 改写 | 拒绝或直接作答 |
|---|---|---|---|
| `tool.call`（`{ tool }`） | `tool`、`tool_use_id`，以及工具入参字段（Bash 为 `e.command`，Edit 为 `e.file_path`） | `next({ ...e, command })` | 调用 `next` 前返回 `{ deny }` 拒绝执行；调用后返回 `{ deny }` 扣留已产生的结果；返回自有 `{ result }` 时须符合该工具的输出 schema |
| `prompt.submit` | `text`、`context`、`attachments` | `next({ ...e, text })`；`context` 中的条目只给模型看 | 返回 `{ drop: reason }` 丢弃本次输入 |
| `classic.<Event>`（如 `classic.Stop`） | 对应命令 hook 的 stdin 字段，如 `stop_hook_active` | — | `{ block: reason }` 等同命令 hook 的退出码 2 |
| `session.start` / `session.end` | `session.end` 带 `reason`（`/clear` 时为 `clear`） | — | `session.start` 在首个提示前被等待，适合注册命令与工具 |
| `turn.complete` | 本轮结束原因、用量 | — | 结果为 `{ text, usage? }` |
| `command.run`（`{ command }`） | 命令参数、`presentation` | — | 返回 `{ text, context? }` |
| `ui.render`（`{ component, requestId? }`） | `component`、`surface`、`props`、`viewport` | `next({ ...e, props })` | 返回元素树，或 `next(e)` 交给引擎绘制 |

要点：

- 不存在 `stop` 事件，`on('stop', ...)` 在 `validate` 中报错（本地实测）；停机门禁使用
  `classic.Stop`。classic 事件的调用链为：managed 设置 hooks → 各插件 hooks 模块 →
  其余设置 hooks。
- `tool.call` 的结果中，`text` 是模型读到的文本，`isError` 标记工具报错；钩子原样返回
  `next` 的结果时，引擎沿用自己生成的消息。
- 2.1.296 本地实测（[执行后检查](claude-code-local-tests.md#hooks-模块的-toolcall)）：`next` 的结果
  为 `{ ref, result, text, isReadOnly }`，`result` 与命令 hook 的 `tool_response` 同形；报错时另有
  `isError: true`，`result` 为字符串。替换输出要返回改动后的 `result`（如 Bash 的 `stdout`、
  Read 的 `file.content`），只改 `text` 无效；`next` 之后返回 `{ deny }` 对报错的结果同样生效。
  同一插件在 `tool.call` 上只能注册一个不带 matcher 的处理函数，第二个使模块校验失败。
- 斜杠命令以 `$.command.register({ name, description })`（在 `session.start` 中）注册，
  由 `command.run` 作答；返回的 `text` 写入对话记录，模型在后续轮次可读到。
- 模型可调用的工具以 `$.tool.register` 注册，名称为 `mcp__<plugin>__<name>`，默认置于
  ToolSearch 之后（`isDeferred: false` 可直接列出），由匹配该名称的 `tool.call` 钩子作答。

## 失败处理与 `.catch`

- 钩子抛错、返回形状不符或超出预算时，该钩子被跳过，链条继续，相当于该钩子放行；
  宿主会话不会因此退出 [M2]。
- 承担守卫职责的钩子应追加 `.catch`，在钩子失败时由处理器作答：

```typescript
on('tool.call', { tool: 'Bash' }, guard).catch(($, e, next) =>
  next.called ? next(e) : { deny: `${$.plugin.name}: 守卫异常，按拒绝处理` },
)
```

- `next.called` 为真表示钩子已调用过 `next`，此时 `next(e)` 重放已得到的结果，
  不会重复执行；为假时返回拒绝，即 fail-closed。
- 处理器也会在“重入”时被调用（`next.error.kind === 're-entry'`，另一钩子在本钩子的 `$`
  调用之下再次触发同一事件），此时处理器只能依据 `e` 判断，不能调用 `$`。
- `validate` 对缺少 `.catch` 的守卫钩子只输出一条事实说明
  （`gating hook without .catch`），不计为告警，`--strict` 也不会因此失败（本地实测）。
  是否添加由开发者决定。

## 状态、存储与界面

### `$.state` 与 `$.store`

| 接口 | 作用域 | 用法 |
|---|---|---|
| `$.state` | 本会话，由宿主持有；模块热重载后保留 | 键在类型契约中声明；以字面量引用 `{ plugin, key }` 访问；`$.state.get(ref)` 返回 `{ value, version }`；辅助函数 `atom`、`read`、`update`、`derive`、`memberOf` 从 `'claude-code'` 引入 |
| `$.store` | 跨会话，插件自有的键值 JSON 文件（位于用户 Claude Code 配置目录下） | `await $.store.get(key)` / `await $.store.set(key, value)`；值须为 JSON 数据，总量上限 4 MiB |

- 模块顶层变量在热重载时重置（`register` 重新执行，`session.start` 再次触发），需要保留的
  值放入 `$.state` 或 `$.store`。
- 用法：模块顶层以 `const a = atom({ plugin: '<插件名>', key: '<键>' }, <默认值>)` 定义，
  `await read($, a)` 读取，`await update($, a, v => ...)` 写入；`plugin` 与 `key` 须为字符串字面量，
  `atom` 的结果须由 `const` 持有 [M6]。模块中出现未在契约中声明的 `atom` 时，即使不读写也在
  `validate` 中报错（本地实测）。
- `/clear`、`/resume`、`/branch` 把 `$.state` 重置为默认值，`session.start` 不再触发；
  `classic.SessionStart` 在这三者之后触发，`e.source` 为 `clear`、`resume` 或 `fork`（`/branch`），
  可用 `{ source: [...] }` 筛选 [M6]。
- `$.state.get` 只接受字面量引用，传入字符串键（如 `$.state.get('badge')`）在 `validate`
  阶段报错（本地实测）。
- 绘制钩子读取 `$.state` 即订阅该值，之后的写入只重绘读取者；绘制过程中不得写入。
- 只有所有者插件写自己的值；其他插件需通过 `state.set` 事件改写。

### 界面接口

| 接口 | 说明 |
|---|---|
| `$.ui.status(text)` | 本插件在提示符下方的状态行，每插件一条；`undefined` 清除 |
| `$.ui.toast(text, { timeoutMs })` | 短暂提示，默认 4000 ms；只替换本插件自己的提示 |
| `$.ui.log(text)` / `$.ui.notify(text, { title })` | 日志行 / 系统通知（结果说明是否送达） |
| `$.ui.ask(question, options)` | 使用 AskUserQuestion 对话框提问；无人可问时（`-p`）拒绝 |
| `ui.render` + `{ component: 'AbovePrompt' }` | 提示符上方的条带；无内容时返回 `next(e)` |
| `$.ui.open({ id, title })` + `ui.render` + `{ component: 'Pane', requestId: id }` | 窗格；`$.ui.close(...)` 关闭 |
| `$.ui.invalidate('ui.render')` | 非状态驱动的重绘（如倒计时），每秒最多 10 次，终端中展示的窗格最多 30 次 |

- 条带与窗格的元素树按 `e.props.bodyColumns` 排版；终端是否以侧栏停靠窗格由
  `e.viewport.isFullscreen` 说明，不应假设固定的终端尺寸。
- 多个插件在同一 `AbovePrompt` 上注册时，返回元素树而不调用 `next` 的钩子会遮住其下的插件；
  无内容可显示时应返回 `next(e)`。各插件的独立状态信息优先使用 `$.ui.status`。
- 元素树校验失败时由引擎绘制默认内容，原因写入调试日志（`claude --debug`）。

## 验证、测试与调试

```bash
claude plugin validate ./command-guard --strict
```

```bash
claude plugin test ./command-guard
```

- `validate` 按引擎加载方式读取 manifest 与模块源码，列出模块注册的事件、调用的 `$` 接口、
  读写的环境变量与状态键、守卫钩子是否带 `.catch`，以及会被引擎拒绝的内容；`--json`
  输出同等信息的结构化报告（含 `gatingHooks[].hasCatch`）。
- 静态分析的写法要求 [M5]：`$` 的调用写全（`$.store.get(...)`），不把 `$` 或其命名空间赋给
  变量、解构或以计算属性访问；`$` 只可传给同一文件顶层声明的函数，以及从 `'claude-code'` 引入的
  `read`、`update`；`on` 的事件名为字符串字面量；只以相对路径引入插件目录内的文件，唯一允许的
  裸导入是 `'claude-code'`；不用动态 `import()`。
- `hooks.json` 列出的文件须自己以 const 函数（或函数声明）导出 `register`；从另一文件转导出
  （`export { register } from`、`export *`）或把引入的函数赋给 `register` 都报错，写成
  `export const register: Register = on => guard(on)` 时分析跟踪进被引入的文件（本地实测）。
- `claude plugin test` 运行目录下的 `*.test.ts` / `*.test.tsx`；测试从
  `'claude-code/testing'` 引入 `test`、`expect`、`mock`，测试中以 `on` 注册的钩子位于被测
  插件之下，代替引擎作答 [M4]。
- 开发期加载：`claude --plugin-dir <folder>`，或在无法传参的宿主中设置
  `CLAUDE_CODE_PLUGIN_DIRS`；交互会话会监视该目录并在保存后重载模块。已安装插件用
  `/reload-plugins` 重新读取。
- 分享：在仓库中提供 `.claude-plugin/marketplace.json`，使用者在终端会话中执行
  `/plugin install <mod> --marketplace <owner>/<repo>` 安装。

## 示例：Bash 命令与输出守卫

以下模块配合上文的类型契约使用：执行前拒绝破坏性命令，执行后扣留含疑似密钥的输出。
2.1.296 上 `validate`、`tsc` 与 3 个 `claude plugin test` 用例（拒绝、放行、扣留）均通过。

```typescript
import { atom, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { GuardCounts } from '../types'

const DESTRUCTIVE = /\brm\s+-rf\s+(\/|~|\.\.)(\s|$)/
const SECRET = /\bsk-[A-Za-z0-9_-]{32,}/
const ZERO: GuardCounts = { denied: 0, withheld: 0 }
const counts = atom({ plugin: 'command-guard', key: 'counts' } as const, ZERO)

export const register: Register = on => {
  // 执行前：命中破坏性命令即拒绝；守卫自身出错时同样拒绝（fail-closed）
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (!DESTRUCTIVE.test(e.command)) return next(e)
    await update($, counts, c => ({ ...(c ?? ZERO), denied: (c ?? ZERO).denied + 1 }))
    return { deny: `${$.plugin.name}: 拒绝执行破坏性命令` }
  }).catch(($, e, next) =>
    next.called ? next(e) : { deny: `${$.plugin.name}: 守卫异常，按拒绝处理` },
  )

  // 执行后：输出含疑似密钥时扣留结果，模型只收到扣留说明
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true) return ran
    if (!SECRET.test(ran.text ?? '')) return ran
    await update($, counts, c => ({ ...(c ?? ZERO), withheld: (c ?? ZERO).withheld + 1 }))
    $.ui.status('command-guard: 已扣留含疑似密钥的输出')
    return { deny: `${$.plugin.name}: 输出含疑似密钥，已扣留` }
  }).catch($ => ({ deny: `${$.plugin.name}: 守卫异常，输出按扣留处理` }))
}
```

扣留只阻止模型读到结果，不撤销命令已产生的副作用；正则仅为示例，实际脱敏规则应按数据
类型单独设计并测试。

## 常见错误

| 写法 | 结果 | 改为 |
|---|---|---|
| `import * as fs from 'node:fs'` | `validate` 报错，模块不加载 | `$.fs.read` / `$.fs.write` |
| `process.env.X = '1'` | 运行环境没有 `process` | `await $.env.set('X', '1')`（变量名须为字面量） |
| `const NAME = 'X'; $.env.set(NAME, v)` | `validate` 报错：变量名不是字面量 | 在调用处写字面量 |
| `export { register } from './impl.mjs'` | `validate` 报错：不跟踪转导出 | `export const register: Register = on => impl(on)` |
| `on('stop', ...)` | `validate` 报错：不是事件 | `on('classic.Stop', ...)`，返回 `{ block }` |
| `$.state.get('key')` | `validate` 报错 | 契约中声明，以 `{ plugin, key }` 字面量引用 |
| 返回 `{ action: 'block', permissionDecision: 'deny' }` | 不是 `tool.call` 的结果形状，钩子被跳过 | 返回 `{ deny: reason }` |
| 读取 `e.input.command`、`result.output` | 字段不存在 | 读取 `e.command`、`ran.text` |
| `$.ui.invalidate('AbovePrompt')` | 参数应为事件名 | `$.ui.invalidate('ui.render')`，或改由 `$.state` 驱动重绘 |
| 守卫钩子不加 `.catch` | 钩子失败时被跳过，相当于放行 | 按上文追加 fail-closed 处理器 |

## 来源

- [M1] Mods overview：<https://code.claude.com/docs/en/plugins/mods/overview>
- [M2] Mods reference：<https://code.claude.com/docs/en/plugins/mods/reference>
- [M3] Claude Code CHANGELOG（v2.1.287）：<https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md>
- [M4] Testing mods：<https://code.claude.com/docs/en/plugins/mods/test>
- [M5] Create a mod：<https://code.claude.com/docs/en/plugins/mods/create>
- [M6] Draw in the interface（Keep state）：<https://code.claude.com/docs/en/plugins/mods/interface>
- 本地实测：[Claude Code 本地实测记录](claude-code-local-tests.md)
