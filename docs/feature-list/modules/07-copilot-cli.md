# 07 Copilot CLI 目标

**阶段：预留**（[SD-27](../scope-decisions.md)）。维护者与协作者没有可做宿主实测的订阅账号；设计保留，恢复排期时把各功能的阶段改为
具体版本，并先完成该宿主的 TA-15 各项。

构建 `copilot-cli:subprocess`，产物采用 `$schema` 格式。产物文件：根 `plugin.json`、
`com.github.copilot/hooks/hooks.json`、`com.github.copilot/hooks/uapa-copilot-cli.mjs` 与
`skills/`；hooks 文件的位置以 TA-15 结论为准。代码位于 `src/targets/copilot-cli/`、
`src/capabilities/copilot-cli-subprocess.ts` 与
`src/runtime/entries/copilot-cli-subprocess.ts`。
宿主事实见 [GitHub Copilot](../../research/coding-agent-plugin-manifests/github-copilot-plugins.md)。

| 编号 | 阶段 | 子模块 | 功能名称 | 验收标准 | 依赖 |
|---|---|---|---|---|---|
| F-07-01 | 预留 | 能力数据 | `copilot-cli:subprocess` 的能力数据 | 宿主版本下限 1.0.26（插件 hook 进程有 `PLUGIN_ROOT` 的最低版本），其余取值为文档核对，写明核对日期与出处；取值与 hooks 适配第 4、6、7、8 节一致，工具名见[跨平台对比「工具名差异」](../../research/coding-agent-plugin-manifests/cross-platform-comparison.md#工具名差异)，使用 camelCase 事件收到的运行时名；`promptGate` 在 TA-15 实测前为不支持 | F-03-01 |
| F-07-02 | 预留 | manifest | 生成根 `plugin.json` | `$schema` 格式，顶层只用 [GitHub Copilot「plugin.json 字段」](../../research/coding-agent-plugin-manifests/github-copilot-plugins.md#pluginjson-字段) 一节列出的 10 个字段；字段与键序按模块接口 §5（v0.1.0 不写 `extensions`）；该文件标为可合并 | F-01-03, F-03-11 |
| F-07-03 | 预留 | hooks | 生成 hooks 配置 | 写入 TA-15 确认的 hooks 文件位置（SD-23）；结论得出前，实现与夹具按 `com.github.copilot/hooks/hooks.json` 编写；文件含 `"version": 1`，`hooks.<事件>` 直接为处理器数组（调研「Hooks」一节示例）；按 `TargetPlan.checks` 生成：`beforeTool` → `preToolUse`，`beforePrompt` → `userPromptSubmitted`，`beforeStop` → `agentStop`；处理器只写 `type: "command"`、`bash`、`powershell` 与 `timeoutSec`（取能力数据的 `hookTimeoutSeconds`，即 30），不写 matcher；`bash` 为 `node "$PLUGIN_ROOT/com.github.copilot/hooks/uapa-copilot-cli.mjs" <检查名>`，`powershell` 为 `node "$env:PLUGIN_ROOT/com.github.copilot/hooks/uapa-copilot-cli.mjs" <检查名>`；与 Claude Code 共用插件目录时，残余风险写明 Copilot CLI 按 hooks 参考可能读取 `hooks/hooks.json` 并执行 Claude Code 的命令 hooks（Copilot CLI 提供 `CLAUDE_PLUGIN_ROOT`），未实测 | F-07-01, F-03-13 |
| F-07-04 | 预留 | hooks | 子进程入口的决策输出 | `generate` 以 `input.bundle`（`entry: 'copilot-cli-subprocess'`、`external: 'node'`）打包入口并输出为 `com.github.copilot/hooks/uapa-copilot-cli.mjs`。`copilot-cli-subprocess.ts` 实现 `SubprocessProtocol`：工具名取 stdin `toolName`；拒绝输出 `permissionDecision: "deny"` 与 `permissionDecisionReason`，退出码 0；改写输出 `modifiedArgs`；停机继续在 `agentStop` 输出 `decision: "block"` 与 `reason`；数据目录取 `COPILOT_PLUGIN_DATA`（调研只记载插件 hook 可写入该目录，进程环境中是否有该变量待 TA-15）；会话 id 与工具入参的字段名、上述决策 JSON 的层级取自 TA-15 入口前提的结论，写在协议实现中并注明出处 | F-04-02, F-04-04, F-04-05, F-04-06, F-07-01 |
| F-07-05 | 预留 | 产物校验 | 字段白名单检查 | `plugin.json` 顶层字段不超出封闭集合；Copilot 专有组件只放在 `com.github.copilot/` 下；hooks 处理器只含 F-07-03 列出的字段 | F-07-02, F-07-03 |
| F-07-09 | 预留 | hooks | 写入声明的命令 hooks | 能力数据按[命令 hooks 声明](../../architecture/command-hooks.md)第 2 节填写 `commandHookEvents`；F-07-03 的 hooks 文件按 `TargetPlan.commandHooks` 写入处理器，字段与 F-07-03 的守卫处理器相同，`bash` 中的 `{pluginRoot}` 换为 `$PLUGIN_ROOT`、`powershell` 中换为 `$env:PLUGIN_ROOT`，同一事件下排在守卫处理器之后；未配置守卫时只生成 hooks 文件，不生成入口 | F-07-03, F-03-15 |
| F-07-06 | 预留 | 组件 | 放置 agents | 适用的 agents 写入 `com.github.copilot/agents/*.agent.md` | F-01-07 |
| F-07-07 | 预留 | 组件 | 生成 `mcp.json` | 由规范形式生成服务器配置，`{pluginRoot}` 换为 `${PLUGIN_ROOT}` | F-01-08 |
| F-07-08 | 预留 | hooks | 执行后检查的决策输出 | 替换与扣留都以 `modifiedResult` 输出 | F-02-04, F-04-08, F-07-04 |
