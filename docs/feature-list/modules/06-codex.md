# 06 Codex 目标

构建 `codex:subprocess`。产物文件：根 `plugin.json`、hooks 配置（默认 `hooks/hooks.json`）、
`hooks/uapa-codex.mjs` 与 `skills/`。代码位于 `src/targets/codex/`、
`src/capabilities/codex-subprocess.ts` 与 `src/runtime/entries/codex-subprocess.ts`。宿主事实见
[Codex](../../research/coding-agent-plugin-manifests/codex-plugins.md)。

| 编号 | 阶段 | 子模块 | 功能名称 | 验收标准 | 依赖 |
|---|---|---|---|---|---|
| F-06-01 | v0.1.0 | 能力数据 | `codex:subprocess` 的能力数据 | 宿主版本 0.162.1，写明核对日期与出处；取值与 hooks 适配第 4、6、7、8 节一致，工具名见[跨平台对比「工具名差异」](../../research/coding-agent-plugin-manifests/cross-platform-comparison.md#工具名差异)；`promptGate` 在 TA-15 实测前为不支持 | F-03-01 |
| F-06-02 | v0.1.0 | manifest | 生成根 `plugin.json` | `$schema` 格式；顶层字段与键序按模块接口 §5；有 hooks 时 `extensions.com.openai.hooks` 写以 `./` 开头的 hooks 文件路径（如 `./hooks/hooks.json`），`hosts.codex.interface` 写入 `extensions.com.openai.interface`；该文件标为可合并；名称不是 kebab-case 时生成失败 | F-01-03, F-03-11 |
| F-06-03 | v0.1.0 | hooks | 生成 hooks 配置 | 默认写 `hooks/hooks.json`，文件的 JSON 结构（顶层键、事件下是否有分组）取自 TA-15 入口前提的结论；宿主选项 `hooksFile` 可改为独立文件（相对插件目录，由 F-01-03 校验），路径同时写入 `extensions.com.openai.hooks`；未设 `hooksFile` 时，`hooks/hooks.json` 的 `conflictHint` 为“设置 hosts.codex.hooksFile 改用独立的 hooks 文件”（SD-07）；按 `TargetPlan.checks` 生成条目：`beforeTool` → `PreToolUse`，`beforePrompt` → `UserPromptSubmit`，`beforeStop` → `Stop`；不写 matcher；命令为 `node "$PLUGIN_ROOT/hooks/uapa-codex.mjs" <检查名>`，命令是否经 shell 执行待 TA-15；超时字段未核实，不写出；残余风险写明：插件 hooks 只对 Codex 桌面端手动安装的插件生效，含 hooks 的插件不能进入公开目录，运行前需要持久化的 hook 信任；TA-15 实测前，命令不经 shell 执行时 `$PLUGIN_ROOT` 不展开、入口无法启动，Codex 按失败放行；合并布局中 Codex 是否另读取 Claude Code 的 `hooks/hooks.json` 未实测 | F-06-01, F-03-13 |
| F-06-04 | v0.1.0 | hooks | 子进程入口的决策输出 | `generate` 以 `input.bundle`（`entry: 'codex-subprocess'`、`external: 'node'`）打包入口并输出为 `hooks/uapa-codex.mjs`。`codex-subprocess.ts` 实现 `SubprocessProtocol`：工具名取 stdin `tool_name`；拒绝以退出码 2 结束并在 stderr 写非空原因；改写输出 `permissionDecision: "allow"` 与 `updatedInput`；停机继续输出 `decision: "block"` 与 `reason`；数据目录取 `PLUGIN_DATA`；会话 id 与工具入参的字段名、决策 JSON 的层级取自 TA-15 入口前提的结论，写在协议实现中并注明出处 | F-04-02, F-04-04, F-04-05, F-04-06, F-06-01 |
| F-06-05 | v0.1.0 | 产物校验 | 字段白名单检查 | `plugin.json` 顶层只含 [Codex「plugin.json 字段」](../../research/coding-agent-plugin-manifests/codex-plugins.md#pluginjson-字段) 一节通用字段表列出的字段与 `extensions`；`extensions` 只含 `com.openai`；`com.openai` 只含该节专有字段表中的字段，`interface` 的子字段不超出该表列出的 `interface.*`；hooks 处理器在 TA-15 实测前只写 `type`、`command`；超出时生成失败 | F-06-02, F-06-03 |
| F-06-08 | v0.1.0 | hooks | 写入声明的命令 hooks | 能力数据按[命令 hooks 声明](../../architecture/command-hooks.md)第 2 节填写 `commandHookEvents`；hooks 配置（默认 `hooks/hooks.json`，或 `hooksFile`）按 `TargetPlan.commandHooks` 写入条目，结构与 F-06-03 的守卫条目相同，`{pluginRoot}` 换为 `$PLUGIN_ROOT`，同一事件下排在守卫条目之后；未配置守卫时只生成 hooks 配置与 `extensions.com.openai.hooks`，不生成入口；声明含 `SessionEnd` 时残余风险写明 Codex 的 `SessionEnd` 默认超时 1 秒、上限 3 秒 | F-06-03, F-03-15 |
| F-06-06 | v0.2.0 | 组件 | 生成 `mcp.json` | 由规范形式生成服务器配置，每个服务器写明传输 `type` | F-01-08 |
| F-06-07 | v0.2.0 | hooks | 执行后检查的决策输出 | 扣留以 `PostToolUse` 返回 `decision: "block"` 输出；声明需要 `replaceOutput` 时构建失败 | F-02-04, F-04-08, F-06-04 |
