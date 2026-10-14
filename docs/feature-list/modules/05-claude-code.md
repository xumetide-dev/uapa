# 05 Claude Code 目标

构建 `claude-code:in-process`（hooks 模块）与 `claude-code:subprocess`（命令 hooks）两个目标。
两个目标输出到同一个插件包，两种形态互为兜底。代码位于 `src/targets/claude-code/`、
`src/capabilities/` 中的对应数据模块与 `src/runtime/entries/` 中的对应入口。宿主事实见
[Claude Code](../../research/coding-agent-plugin-manifests/claude-code-plugins.md) 与
[Mods 指南](../../research/coding-agent-plugin-manifests/claude-code-mods-guide.md)。

| 编号 | 阶段 | 子模块 | 功能名称 | 验收标准 | 依赖 |
|---|---|---|---|---|---|
| F-05-01 | v0.1.0 | 能力数据 | 两个目标的能力数据 | 每个目标一个数据模块，写明宿主版本、核对日期与出处；取值与 hooks 适配第 4、6、7、8 节一致 | F-03-01 |
| F-05-02 | v0.1.0 | manifest | 生成 `.claude-plugin/plugin.json` | 由配置生成名称、版本、描述、作者与关键词；目标选项可写 `displayName`、`userConfig`、`dependencies` 与 `$schema` | F-01-03, F-03-05 |
| F-05-03 | v0.1.0 | 命令 hooks | 生成命令 hooks 配置 | `hooks/hooks.json` 的 `hooks` 键按守卫已实现的检查生成 `UserPromptSubmit`、`PreToolUse`、`Stop` 条目；命令为 `node "${CLAUDE_PLUGIN_ROOT}/hooks/<入口文件>"`，显式写出超时 | F-05-01, F-03-02 |
| F-05-04 | v0.1.0 | 命令 hooks | 子进程入口的决策输出 | 拒绝以退出码 2 加原因或 `permissionDecision: "deny"` 输出；改写输出 `hookSpecificOutput.updatedInput`；停机继续输出 `decision: "block"` 与 `reason`；提示阻断按能力数据记录的协议输出 | F-04-04, F-04-06, F-05-01 |
| F-05-05 | v0.1.0 | hooks 模块 | 生成 hooks 模块入口 | 生成 `hooks/register.ts`，在 `tool.call`、`prompt.submit` 与 `classic.Stop` 上调用守卫；`hooks/hooks.json` 写入 `modules` 键 | F-04-07, F-05-03 |
| F-05-06 | v0.1.0 | hooks 模块 | 生成 hooks 模块的异常收口 | 执行前检查与提示检查写 `.catch`，出错时拒绝；未调用 `next` 前出错不放行 | F-05-05 |
| F-05-07 | v0.1.0 | hooks 模块 | 生成状态类型契约 | 停机门禁计数存于 `$.state`；生成 `types/index.d.ts`，在 `plugin.json` 写 `types` 字段；`claude plugin validate` 能核对状态键 | F-05-05, F-05-02 |
| F-05-08 | v0.1.0 | 双形态去重 | 按会话 id 去重 | 模块在 `session.start` 写入会话 id 环境变量；命令入口比对 stdin 的 `session_id`，相等时以退出码 0 结束；不只判断变量是否存在 | F-05-04, F-05-05, F-05-10 |
| F-05-09 | v0.1.0 | 产物校验 | 调用宿主校验命令 | 本机有 `claude` 时运行 `claude plugin validate --strict`，失败则该目标失败；没有时跳过并写入构建报告 | F-05-02, F-05-03 |
| F-05-10 | v0.1.0 | 双形态去重 | 两种形态合为一个插件包 | 同时配置两个目标时写入同一目录：`hooks/hooks.json` 同时含 `hooks` 与 `modules` 键，`plugin.json` 只生成一份；只配置其中一个目标时只含对应的键 | F-05-02, F-05-03, F-05-05, F-03-05 |
| F-05-11 | v0.2.0 | 组件 | 放置 agents | 适用的 agents 写入产物 `agents/*.md` | F-01-07 |
| F-05-12 | v0.2.0 | 组件 | 生成 `.mcp.json` | 由规范形式生成服务器配置，`{pluginRoot}` 换为 `${CLAUDE_PLUGIN_ROOT}` | F-01-08 |
| F-05-13 | v0.2.0 | 命令 hooks | 执行后检查的决策输出 | 命令 hooks 以 `updatedToolOutput` 替换输出；hooks 模块在 `next` 之后返回 `{ result }`，扣留返回 `{ deny }` | F-02-04, F-04-08, F-05-04 |
