# Claude Code 双形态去重

本文是 [UAPA hooks 适配](uapa-hook-adapters.md) 第 5 节的子页，状态与核对日期随该文：
同一个 Claude Code 插件同时声明 hooks 模块与命令 hooks 时的文件布局，以及两种形态在同一
事件上都执行时的去重做法。

## 文件布局

两种形态写在同一个 `hooks/hooks.json` 中：

```json
{
  "hooks": {
    "PreToolUse": [{
      "hooks": [{
        "type": "command",
        "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/uapa-claude-code.mjs\" before-tool",
        "timeout": 30
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

## 去重

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
// 以下运行与模块相同的守卫逻辑，按 hooks 适配第 4 节输出命令 hooks 协议
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
- 实测覆盖的是 `UserPromptSubmit` 与 `Stop`
  （[双形态去重的会话实测](claude-code-local-tests.md#双形态去重的会话实测)）。
  `SessionStart` 事件上的命令 hook 能否看到同一会话模块写入的变量，取决于调用顺序，未实测；
  该事件不要依赖去重。
- hooks 模块运行在没有 Node `process` 的独立环境中，与 hook 子进程不共享内存，不能用
  `globalThis` 标志或进程 id 判断模块是否生效。
- 在 DSH 中，`$.env` 是进程级、所有会话共享的，上述做法不成立。同一插件不要同时挂载
  `@deepseek-ai/dsh-experimental-claude-code-mods` 与 `@deepseek-ai/dsh-hooks-claude-code`。
- CodeBuddy 遇到含 `modules` 的 `hooks.json` 时也会按 Mods 通道加载该目录；两种形态是否都
  执行、`$.env` 是否可用均未核实。`codebuddy:subprocess` 因此只写 `"hooks"` 键。

## 来源

- [H1] Claude Code 插件排障：
  <https://code.claude.com/docs/en/plugins/troubleshooting#failed-to-load-hooks-from-and-hooks-that-dont-fire>
- [H2] anthropics/claude-code#94402：<https://github.com/anthropics/claude-code/issues/94402>
- [H3] anthropics/claude-code#31763：<https://github.com/anthropics/claude-code/issues/31763>
- [H4] anthropics/claude-code#76451：<https://github.com/anthropics/claude-code/issues/76451>
