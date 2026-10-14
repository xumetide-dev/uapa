# 编码代理扩展形态与迁移指南

本文按扩展机制对编码代理插件分层，用一个守卫插件示例说明
[统一代理插件架构（UAPA）设计提案](unified-agent-plugin-architecture.md) 的写法与各宿主上的
结果，并给出现有插件迁移到该提案的步骤。UAPA 为设计提案，未实现；文中代码均为示意写法。
各宿主的事实见 [跨平台对比](cross-platform-comparison.md)。

## 1. 扩展形态分层

| 层 | 机制 | 能做什么 | 代表 |
|---|---|---|---|
| L1 | 静态清单与指令 | 分发 skills、rules、agents、命令等文本资产；不执行代码 | 各宿主的 manifest、`SKILL.md`、Cursor rules、Kiro steering |
| L2 | MCP 服务器 | 以独立进程或远程服务提供工具；不能拦截宿主内置工具 | 各宿主的 `mcp.json` / `.mcp.json` |
| L3 | 命令 hooks | 宿主在事件点启动子进程，经 stdin JSON、退出码与 stdout JSON 交换决定 | Claude Code、Codex、Copilot、Cursor、Kimi、Kiro、CodeBuddy |
| L4 | 进程内模块 | 在宿主进程或宿主提供的环境中常驻，以函数链处理事件 | Claude Code hooks 模块、CodeBuddy Mods（Beta）、OpenCode 插件、DSH Cordis 插件 |

- 分层描述机制，不是宿主的等级；一个宿主可同时提供多层，例如 Claude Code 同时有 L3 与 L4。
- L4 的运行环境不同：OpenCode 插件运行在 OpenCode 进程（Bun）内；DSH 插件运行在 DSH 的
  Node 进程内；Claude Code hooks 模块运行在没有 DOM、没有 Node 的独立环境中，只能经 `$`
  访问宿主能力，见 [Mods 指南](claude-code-mods-guide.md)。
- L3 每个事件都启动一个进程，没有常驻内存；会话内状态需写入文件。
- 各层的控制能力（阻断、改写入参、替换输出、停机门禁）逐宿主不同，见
  [跨平台对比](cross-platform-comparison.md#hooks-控制能力)。

## 2. 示例：工具调用守卫

以下插件拒绝破坏性命令，把 `npm install` 改写为 `pnpm add`，并扣留含疑似密钥的工具输出。

```ts
import type { GuardPlugin } from './uapa-types' // 公共类型，见 UAPA hooks 适配第 2 节

const DESTRUCTIVE = /\brm\s+-rf\s+(\/|~|\.\.)(\s|$)/
const NPM_INSTALL = /^\s*npm\s+install\b/
const SENSITIVE = /\bsk-[A-Za-z0-9_-]{32,}/

export const guard: GuardPlugin = {
  name: 'command-guard',
  requires: ['withholdOutput'],
  beforeTool(call) {
    if (call.tool !== 'shell') return { kind: 'allow' }
    const command = String(call.input.command ?? '')
    if (DESTRUCTIVE.test(command)) {
      return { kind: 'deny', reason: '拒绝执行破坏性命令' }
    }
    if (NPM_INSTALL.test(command)) {
      const rewritten = command.replace(NPM_INSTALL, 'pnpm add')
      return {
        kind: 'rewrite',
        input: { ...call.input, command: rewritten },
        fallbackReason: `本仓库使用 pnpm，请改为：${rewritten}`,
      }
    }
    return { kind: 'allow' }
  },
  afterTool(call, output) {
    if (!SENSITIVE.test(output)) return { kind: 'keep' }
    return { kind: 'withhold', reason: '输出含疑似密钥，已扣留' }
  },
}
```

- `shell` 是适配器换算后的规范工具名，各宿主的原始名称由适配器映射。
- `SENSITIVE` 不带 `g` 标志：带 `g` 的正则在 `test()` 之间保留 `lastIndex`，会漏检。
- 示例没有 `beforeStop`。需要停机门禁时，插件在 `requires` 中加入 `stopGate`。

### 各目标上的结果

按 [UAPA hooks 适配](uapa-hook-adapters.md) 第 4、6 节推导，未实测：

| 目标 | 拒绝 | 改写 `npm install` | 扣留输出 |
|---|---|---|---|
| `claude-code:in-process`、`claude-code:subprocess` | 生效 | 生效 | 生效 |
| `codex:subprocess` | 生效 | 生效 | 生效：以反馈替换结果 |
| `copilot-cli:subprocess`、`codebuddy:subprocess`、`opencode:in-process` | 生效 | 生效 | 生效 |
| `dsh:cordis` | 生效 | 按 `fallbackReason` 拒绝 | 生效 |
| `cursor:subprocess`、`kimi:subprocess`、`kiro:workspace-hook` | — | — | 不产出：缺少 `withholdOutput` |

扣留发生在命令执行之后，命令的副作用不会撤销。需要在执行前拦下可能输出密钥的命令时，
在 `beforeTool` 中按命令判断。

## 3. 迁移现有插件

### 3.1 命令 hooks 脚本

常见问题：

- 向 stdout 打印日志。Claude Code 在退出码 0 时把 stdout 解析为 JSON，混入日志会使决定
  无法解析；日志写 stderr。
- 在 `catch` 中 `exit 0`，使脚本出错时放行。
- `PostToolUse` 读取 `tool_result` 字段。Claude Code 的字段名是 `tool_response`。
- 在支持改写的宿主上仍用退出码 2 拒绝。Claude Code、Codex、Copilot CLI、Cursor、CodeBuddy
  都能改写入参，字段名各不相同（`updatedInput`、`modifiedArgs`、`updated_input`、
  `modifiedInput`）。
- 把会话状态写进 `/tmp` 的共享目录。改用插件数据目录并以 `session_id` 区分。

迁移步骤：

1. 把判断逻辑移入 `beforeTool`、`afterTool`、`beforeStop`，只用公共类型。
2. 在 `requires` 中写明依赖的能力；改写类决定补上 `fallbackReason`。
3. 由各目标的适配器生成入口脚本，入口负责读取 stdin、捕获异常并按宿主协议输出。

### 3.2 Claude Code hooks 模块

1. `tool.call` hook 中 `next` 之前的判断移入 `beforeTool`，`next` 之后对结果的处理移入
   `afterTool`；`classic.Stop` 的判断移入 `beforeStop`。
2. `$.state`、`$.ui.status`、`ui.render` 等界面与状态代码属于 Claude Code 目标，保留在该目标
   的模块中，不进入公共逻辑。
3. 多个插件的状态显示不要共享全局对象：每个 hooks 模块运行在独立环境中，全局变量无法跨插件
   共享。用 `$.ui.status(text)`，每个插件各占一行状态。
4. 模块与命令 hooks 同时声明时，按 [UAPA hooks 适配 §5](uapa-hook-adapters.md#5-claude-code-双形态去重)
   去重。

### 3.3 DSH 插件

- 原生 Cordis 插件：`tools/pre-execute` 的判断对应 `beforeTool`（`deny`），
  `tools/post-execute` 的处理对应 `afterTool`，`agent/turn-stopping` 对应 `beforeStop`。
  DSH 不能改写工具入参，`rewrite` 在该目标按 `fallbackReason` 拒绝。
- 经 `@deepseek-ai/dsh-experimental-claude-code-mods` 运行的 mod：兼容层为实验包，拒绝改写
  入参，`tool.call` 在 DSH 权限决定之后运行，且模块拥有 DSH 进程的全部权限。生产使用时改写为
  原生 Cordis 插件，见 [DSH Cordis 插件开发指南](dsh-cordis-plugin-guide.md)。
- 只在 `inject` 中声明实际使用的服务；按会话变化的状态以 agent 为键保存，在
  `agent/disposed` 时清理。
