# Claude Code 本地实测记录

本文记录调研中依赖本地实测的 Claude Code 行为，供复现。环境：Claude Code 2.1.296，macOS，
2026-10-13。测试插件均为最小示例，不含业务逻辑。

## hooks 模块（mod）

| 项目 | 做法 | 结果 |
|---|---|---|
| 模块导入限制 | `validate` 一个导入 `node:fs` 的模块 | 报错 |
| 事件与状态键 | `validate` 含 `on('stop', ...)` 或 `$.state.get('badge')` 的模块 | 均报错 |
| 缺少 `.catch` | `validate --strict` 一个不带 `.catch` 的守卫钩子 | 只输出 `gating hook without .catch` 说明，通过 |
| 插件名 | 以 `claude-`、`anthropic-`、`cc-plugin-` 开头及 `@org/foo` 的插件 | 前三者 `validate` 报错；`@org/foo` 在 `validate` 中告警，`--plugin-dir` 加载被拒绝 |
| 守卫示例 | [Mods 指南](claude-code-mods-guide.md) 中的示例模块 | `validate --strict`、`tsc` 通过；3 个 `claude plugin test` 用例（拒绝、放行、扣留）通过 |

## hooks 模块与命令 hooks 并存

| 项目 | 做法 | 结果 |
|---|---|---|
| 同一文件并存 | 同一插件的 `hooks/hooks.json` 声明 `"modules"` 与 `UserPromptSubmit` 命令 hook，用 `claude -p --plugin-dir` 运行 | 两者都执行；模块在 `session.start` 中 `$.env.set` 的变量出现在命令 hook 进程环境中；`$.session.id()` 与 stdin 的 `session_id` 一致 |
| 未知顶层键 | `hooks.json` 同时含 `hooks` 与未知键 `foo` | `validate --strict` 通过；命令 hook 正常执行 |
| 拆分文件 | `plugin.json` 的 `hooks` 指向只含命令 hooks 的文件，默认 `hooks.json` 只含 `modules` | 两者都执行 |
| 数组形式 | `plugin.json` 的 `hooks` 为两个文件路径的数组，其中一个只含 `modules` | 两者都执行 |

## 使用的命令

```bash
claude plugin validate ./command-guard --strict
```

```bash
claude plugin test ./command-guard
```

```bash
claude -p --plugin-dir ./dualtrack-probe "hello"
```
