# UAPA 命令 hooks 声明

本文定义构建配置中原样声明的命令 hooks：配置字段、各目标承载的事件、命令中插件根目录的写法，
以及构建编排与宿主模块的处理规则（[范围决策 SD-05](../feature-list/scope-decisions.md)）。守卫
hooks 的入口与命令见[入口与打包接口](runtime-interfaces.md)，模块之间的其他数据见
[模块接口](module-interfaces.md)。代码块中的类型是实现时的约定，字段名与文件位置以本文为准；
宿主行为以宿主调研文档为准。

## 1. 配置字段

```ts
// src/config/types.ts（F-01-09），由 src/index.ts 导出
export type CommandHookEvent =
  | 'SessionStart' | 'SessionEnd' | 'UserPromptSubmit'
  | 'PreToolUse' | 'PostToolUse' | 'Stop'
export interface CommandHookDecl {
  readonly event: CommandHookEvent
  readonly command: string // 原样写入 hooks 配置；插件根目录写作 {pluginRoot}
  readonly targets?: readonly TargetName[] // 限定目标；省略时适用于全部已配置目标
}
// UapaConfig.commandHooks?: readonly CommandHookDecl[]
```

- 声明的命令不经守卫逻辑。UAPA 不读取、不换算命令的 stdin、stdout、stderr 与退出码；各宿主的
  输入输出协议见宿主调研，由插件作者负责。
- 校验（F-01-09）：`command` 为非空单行字符串；`targets` 非空、不重复，只含已配置的目标。
- v0.1.0 不支持 `matcher` 与超时字段。工具名因宿主而异，matcher 无法写成宿主无关的形式；
  工具事件上的命令对全部工具触发（省略 matcher 时的宿主行为见 SD-23）。

## 2. 各目标承载的事件

能力数据的 `commandHookEvents`（[模块接口 §4](module-interfaces.md#4-目标能力数据)）记录每个事件在
该目标上的宿主事件名；`null` 表示不承载或调研未记载。

| 事件 | `claude-code:subprocess` | `codex:subprocess` | `agy:subprocess` | `copilot-cli:subprocess`（预留） | `kimi:subprocess`（预留） |
|---|---|---|---|---|---|
| `SessionStart` | `SessionStart` | `SessionStart` | `SessionStart` | `sessionStart` | `SessionStart` |
| `SessionEnd` | `SessionEnd`（2.1.296 本地实测，`-p` 模式也触发） | `SessionEnd` | `null`（宿主没有该事件） | `sessionEnd` | `SessionEnd` |
| `UserPromptSubmit` | `UserPromptSubmit` | `UserPromptSubmit` | `null`（宿主没有该事件） | `userPromptSubmitted` | `UserPromptSubmit` |
| `PreToolUse` | `PreToolUse` | `PreToolUse` | `PreToolUse` | `preToolUse` | `PreToolUse` |
| `PostToolUse` | `PostToolUse` | `PostToolUse` | `PostToolUse` | `postToolUse` | `PostToolUse` |
| `Stop` | `Stop` | `Stop` | `Stop` | `agentStop` | `Stop` |

- `claude-code:in-process` 不运行命令，各事件均为 `null`。
- agy 的 `PreToolUse` 命令须在 stdout 输出含 `decision` 的 JSON，否则宿主阻断该次工具调用
  （F-11-06 写入残余风险）。
- 出处：[Claude Code](../research/coding-agent-plugin-manifests/claude-code-plugins.md)、
  [Claude Code 本地实测记录](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#命令-hooks) 与
  [hooks 适配](../research/coding-agent-plugin-manifests/uapa-hook-adapters.md)、
  [Codex](../research/coding-agent-plugin-manifests/codex-plugins.md)、
  [agy](../research/coding-agent-plugin-manifests/agy-plugins.md)、
  [GitHub Copilot](../research/coding-agent-plugin-manifests/github-copilot-plugins.md)、
  [Kimi Code](../research/coding-agent-plugin-manifests/kimi-code-plugins.md) 的 hooks 一节。

## 3. 插件根目录

命令中的 `{pluginRoot}` 按目标替换，写法与守卫入口的 hooks 命令一致（入口与打包接口第 2 节）；
其余文本原样写入。

| 目标 | `{pluginRoot}` 替换为 |
|---|---|
| `claude-code:subprocess` | `${CLAUDE_PLUGIN_ROOT}` |
| `codex:subprocess` | `${PLUGIN_ROOT}`（宿主在交给 shell 前替换，SD-23） |
| `agy:subprocess` | `.`（hook 以插件目录为工作目录） |
| `copilot-cli:subprocess`（预留） | 处理器的 `bash` 中为 `$PLUGIN_ROOT`，`powershell` 中为 `$env:PLUGIN_ROOT` |
| `kimi:subprocess`（预留） | `.`（插件 hook 以插件根目录为工作目录） |

## 4. 处理规则

- 承载检查（F-03-15）：声明的 `targets` 省略或包含某个已配置目标时，该声明适用于该目标。
  适用且 `commandHookEvents[event]` 不为 `null` 时，声明按顺序进入该目标的
  `TargetPlan.commandHooks`。适用但为 `null` 时：`targets` 显式列出该目标则该目标失败；否则在该
  目标报告的 `skipped` 中写 `{ component: 'commandHooks[<下标>]', reason }`，同一宿主的另一目标
  承载该声明时不写（如同时配置两个 Claude Code 目标时的 `claude-code:in-process`）。
- 生成（F-05-15、F-06-08、F-11-06）：宿主模块按 `TargetPlan.commandHooks` 在该目标的
  hooks 配置中写入条目，事件名取 `commandHookEvents`，条目结构与超时同该目标的守卫条目，不写
  matcher（agy 的工具事件同其守卫条目写 `"matcher": ""`）；同一事件下排在守卫条目之后，按声明顺序。
  例外（v0.4.0，F-06-14）：Codex 的 `SessionEnd` 写 `timeout: 3`，宿主把更大的值压到 3 秒并在每次
  会话开始时告警（rust-v0.162.1 `hooks/src/engine/discovery.rs`）。v0.4.0 起 Claude Code 与 Codex
  的 `SessionStart` 中，规则输出脚本的条目排在声明的命令之前（宿主模块接口「v0.4.0 的生成规则」）。
- `TargetPlan.checks` 为空而 `commandHooks` 非空时，宿主模块只生成 hooks 配置与 manifest 中指向它
  的字段，不生成入口。
- Claude Code 双形态去重（F-05-08）只作用于守卫入口；声明的命令只写在 `hooks/hooks.json` 的
  `hooks` 键中，每个事件执行一次。
