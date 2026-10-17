# 命令 hooks

命令 hooks 是在配置中原样声明、不经守卫逻辑的命令：UAPA 按目标把事件名与插件根目录换算后写入
各宿主的 hooks 配置。适合会话开始时准备环境、记录日志这类不需要放行或拒绝判断的操作；需要判断
的检查写在[守卫](guards.md)中。字段与写入规则的权威定义见
[命令 hooks 声明](../architecture/command-hooks.md)。

## 声明

```ts
import { defineConfig } from 'uapa'

export default defineConfig({
  name: 'team-rules',
  version: '0.1.0',
  description: '团队的提交与依赖约定',
  author: { name: 'Example Team' },
  targets: ['claude-code:subprocess', 'codex:subprocess', 'agy:subprocess'],
  commandHooks: [
    {
      event: 'SessionStart',
      command: 'node "{pluginRoot}/scripts/session-start.mjs"',
      timeout: 10,
    },
  ],
})
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `event` | 是 | `SessionStart`、`SessionEnd`、`UserPromptSubmit`、`PreToolUse`、`PostToolUse`、`Stop` 之一 |
| `command` | 是 | 非空的单行命令，原样写入；插件根目录写作 `{pluginRoot}` |
| `targets` | 否 | 只写入列出的目标；省略时适用于全部已配置目标 |
| `timeout` | 否 | 单条命令超时（秒），正整数；省略时取目标的 `hookTimeoutSeconds`（30 秒） |

- 不支持 `matcher`，写了按未知字段报错。工具事件上的命令对全部工具触发。
- Codex 的 `SessionEnd` 超时上限为 3 秒：单条命令写 `Math.min(timeout ?? 30, 3)`；省略 `timeout`
  或 `timeout > 3` 时构建报告写 3 秒截断残余风险，`timeout <= 3` 时按原值写出且不报该风险。
- UAPA 不读取、不换算命令的 stdin、stdout、stderr 与退出码；各宿主的输入输出协议见
  [宿主调研](../research/coding-agent-plugin-manifests/README.md)的 hooks 一节，由插件作者负责。
- 命令引用的脚本不由 UAPA 复制，放在 `overrides/<宿主>/` 下的同一相对路径，每个宿主各放一份，
  见[源项目结构「覆盖文件」](source-project.md#覆盖文件)：

```text
overrides/
├── claude-code/scripts/session-start.mjs
├── codex/scripts/session-start.mjs
└── agy/scripts/session-start.mjs
```

## 各目标承载的事件

| 事件 | `claude-code:subprocess` | `codex:subprocess` | `agy:subprocess` |
|---|---|---|---|
| `SessionStart` | `SessionStart` | `SessionStart` | `SessionStart` |
| `SessionEnd` | `SessionEnd` | `SessionEnd` | 不承载（宿主没有该事件） |
| `UserPromptSubmit` | `UserPromptSubmit` | `UserPromptSubmit` | 不承载（宿主没有该事件） |
| `PreToolUse` | `PreToolUse` | `PreToolUse` | `PreToolUse` |
| `PostToolUse` | `PostToolUse` | `PostToolUse` | `PostToolUse` |
| `Stop` | `Stop` | `Stop` | `Stop` |

- `claude-code:in-process` 不运行命令。同时配置两个 Claude Code 目标时，命令写入
  `hooks/hooks.json` 的 `hooks` 键，每个事件执行一次。
- 某个目标不承载声明的事件时：声明的 `targets` 显式列出了该目标，该目标构建失败；未显式列出时，
  构建报告的 `skipped` 写 `commandHooks[<下标>]`。
- agy 的 `PreToolUse` 命令须在 stdout 输出含 `decision` 的 JSON，否则宿主阻断该次工具调用；
  构建报告把它列为残余风险。

## 插件根目录

| 目标 | `{pluginRoot}` 换为 | 本例写出的命令 |
|---|---|---|
| `claude-code:subprocess` | `${CLAUDE_PLUGIN_ROOT}` | `node "${CLAUDE_PLUGIN_ROOT}/scripts/session-start.mjs"` |
| `codex:subprocess` | `${PLUGIN_ROOT}` | `node "${PLUGIN_ROOT}/scripts/session-start.mjs"` |
| `agy:subprocess` | `.`（hook 以插件目录为工作目录） | `node "./scripts/session-start.mjs"` |

命令的其余文本原样写入。生成的条目与守卫条目结构相同，超时取单条 `timeout ?? 30`（Codex 的
`SessionEnd` 为 `Math.min(timeout ?? 30, 3)`），同一事件下排在守卫条目之后，按声明顺序。

## 参考

- 字段、承载规则与出处：[命令 hooks 声明](../architecture/command-hooks.md)。
- 示例夹具：[`command-hooks`](../../test/fixtures/command-hooks/source/uapa.config.ts)。
