# 11 agy 目标

构建 `agy:subprocess`（Antigravity CLI）。产物文件：根 `plugin.json`、根 `hooks.json`、
`hooks/uapa-agy.mjs` 与 `skills/`。代码位于 `src/targets/agy/`、
`src/capabilities/agy-subprocess.ts` 与 `src/runtime/entries/agy-subprocess.ts`。宿主事实见
[agy](../../research/coding-agent-plugin-manifests/agy-plugins.md)，其中文档未写明的行为以 1.3.4 的
本地实测为准。`agy plugin validate` 对结构错误也报通过，不作为宿主校验；本宿主不实现 `verify`，
由 F-11-05 在生成时检查字段。

| 编号 | 阶段 | 子模块 | 功能名称 | 验收标准 | 依赖 |
|---|---|---|---|---|---|
| F-11-01 | v0.1.0 | 能力数据 | `agy:subprocess` 的能力数据 | 宿主版本 1.3.4，写明核对日期与出处；取值与 hooks 适配第 4、6、7、8 节一致，工具名见[跨平台对比「工具名差异」](../../research/coding-agent-plugin-manifests/cross-platform-comparison.md#工具名差异)；`rewriteInput`、`stopGate` 为支持，`promptGate`、`replaceOutput`、`withholdOutput` 为不支持（宿主没有提示提交事件，`PostToolUse` 不能替换输出）；`failureDefault.beforeTool` 为 `{ error: 'deny', timeout: 'deny' }`（本地实测），`beforeStop` 为 `{ error: 'allow', timeout: 'allow' }`（出错为本地实测，超时注明“未实测”），`beforePrompt` 为 `{ error: 'allow', timeout: 'allow' }` 并注明“宿主没有该事件”；`hookTimeoutSeconds` 与 `defaultTimeoutSeconds` 为 30；在登记处加入本目标（M4） | F-03-01 |
| F-11-02 | v0.1.0 | manifest | 生成根 `plugin.json` | 只写 `name` 与 `description`（宿主 schema 不允许其他字段），不写 `$schema`（文档给出的地址返回 404）；不写 `skills` 字段，宿主加载 `skills/` 下的全部 skill；名称不匹配 `^[a-zA-Z0-9_-]+$` 时生成失败；该文件不标为可合并，`conflictHint` 为“agy 的根 plugin.json 只允许 name 与 description，不能与其他宿主的根 plugin.json 合并；为 hosts.agy.dir 设置单独的目录”；在宿主模块登记处加入本宿主（M4） | F-01-03, F-03-11 |
| F-11-03 | v0.1.0 | hooks | 生成 `hooks.json` | 写入插件根目录的 `hooks.json`，顶层只有一个键，为配置的 `name`；其值按 `TargetPlan.checks` 写事件：`beforeTool` → `PreToolUse`，元素为 `{ "matcher": "", "hooks": [<处理器>] }`（`""` 匹配全部工具，本地实测）；`beforeStop` → `Stop`，元素直接为处理器；处理器依次写 `type: "command"`、`command`、`timeout`（取能力数据的 `hookTimeoutSeconds`，即 30）；`command` 为 `node hooks/uapa-agy.mjs <检查名>`（hook 以插件目录为工作目录，本地实测）；不写 `enabled`；与 Claude Code 共用插件目录时，残余风险写明安装命令是否把含 `.claude-plugin/` 的目录按 Claude Code 插件转换未实测 | F-11-01, F-03-13 |
| F-11-04 | v0.1.0 | hooks | 子进程入口的决策输出 | `generate` 以 `input.bundle`（`entry: 'agy-subprocess'`、`external: 'node'`）打包入口并输出为 `hooks/uapa-agy.mjs`。`agy-subprocess.ts` 实现 `SubprocessProtocol`：会话 id 取 stdin `conversationId`，工具名取 `toolCall.name`，入参取 `toolCall.args`，命令字段为 `CommandLine`；`PreToolUse` 的 stdout 不是含 `decision` 的 JSON 时宿主阻断（本地实测），因此执行前检查的放行输出 `{"decision":"allow"}`，停机前检查的放行输出 `{}`；拒绝输出 `{"decision":"deny","reason":<原因>}`，退出码 0；改写输出 `{"decision":"allow","overwrite":{"CommandLine":<命令>}}`（宿主按键浅合并）；停机继续输出 `{"decision":"continue","reason":<原因>}`；`dataDir` 返回 `path.join(os.tmpdir(), 'uapa-' + encodeURIComponent(插件名))`（宿主没有插件数据目录变量，SD-06）；有停机前检查时残余风险写明系统临时目录被清理时停机计数归零 | F-04-02, F-04-04, F-04-05, F-04-06, F-11-01 |
| F-11-05 | v0.1.0 | 产物校验 | 字段白名单检查 | `plugin.json` 只含 `name`、`description`；`hooks.json` 顶层只有一个键，其值只含 `SessionStart`、`PreToolUse`、`PostToolUse`、`Stop`；`PreToolUse`、`PostToolUse` 的元素只含 `matcher`、`hooks`；处理器只含 `type`、`command`、`timeout`；超出时生成失败 | F-11-02, F-11-03 |
| F-11-06 | v0.1.0 | hooks | 写入声明的命令 hooks | 能力数据按[命令 hooks 声明](../../architecture/command-hooks.md)第 2 节填写 `commandHookEvents`（`SessionEnd`、`UserPromptSubmit` 为 `null`）；`hooks.json` 按 `TargetPlan.commandHooks` 每条声明写一个元素，结构同 F-11-03（`PostToolUse` 与 `PreToolUse` 相同，`SessionStart` 与 `Stop` 相同），`{pluginRoot}` 换为 `.`，同一事件下排在守卫元素之后；未配置守卫时只生成 `hooks.json`，不生成入口；声明含 `PreToolUse` 时残余风险写明该命令的 stdout 须为含 `decision` 的 JSON，否则每次工具调用都被阻断 | F-11-03, F-03-15 |
| F-11-07 | v0.2.0 | 组件 | 放置 agents | 适用的 agents 由构建编排原样写入产物 `agents/<name>.md`（SD-30） | F-01-07 |
| F-11-08 | v0.2.0 | 组件 | 生成 `mcp_config.json` | 由规范形式生成 `mcpServers`：本地服务器写 `command`、`args`、`env`，`{pluginRoot}` 在 `args` 与 `env` 中换为 `.`（服务器以插件目录为工作目录），在 `command` 中出现时列为跳过；远程服务器的 `url` 写为 `serverUrl`（SD-30） | F-01-08 |
