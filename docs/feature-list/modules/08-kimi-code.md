# 08 Kimi Code 目标

构建 `kimi:subprocess`。hooks 写在 `kimi.plugin.json` 的 `hooks` 字段中。产物文件：
`kimi.plugin.json`、`hooks/uapa-kimi.mjs` 与 `skills/`。代码位于 `src/targets/kimi/`、
`src/capabilities/kimi-subprocess.ts` 与 `src/runtime/entries/kimi-subprocess.ts`。
宿主事实见 [Kimi Code](../../research/coding-agent-plugin-manifests/kimi-code-plugins.md)。

| 编号 | 阶段 | 子模块 | 功能名称 | 验收标准 | 依赖 |
|---|---|---|---|---|---|
| F-08-01 | v0.1.0 | 能力数据 | `kimi:subprocess` 的能力数据 | 宿主版本 2.1.1，写明核对日期与出处；取值与 hooks 适配第 4、6、7、8 节一致，工具名见[跨平台对比「工具名差异」](../../research/coding-agent-plugin-manifests/cross-platform-comparison.md#工具名差异)；改写入参与执行后检查记为不支持；`promptGate` 在 TA-15 确认提示文本字段名之前为不支持（`UserPromptSubmit` 以退出码 2 阻断已有文档依据，见 hooks 适配第 4 节） | F-03-01 |
| F-08-02 | v0.1.0 | manifest | 生成 `kimi.plugin.json` | 由配置生成名称、版本、描述，有适用的 skill 时写 `skills` 为 skills 目录相对插件根目录的路径，写法待 TA-15；宿主选项 `hosts.kimi` 可写 `interface`；名称不匹配 `[a-z0-9][a-z0-9_-]{0,63}` 时生成失败 | F-01-03, F-03-11 |
| F-08-03 | v0.1.0 | hooks | 生成 hooks 规则 | 写入 `kimi.plugin.json` 的 `hooks`，值为规则对象数组（与 `[[hooks]]` 同构）；按 `TargetPlan.checks` 生成规则：`beforeTool` → `PreToolUse`，`beforePrompt` → `UserPromptSubmit`，`beforeStop` → `Stop`；每条规则只写 `event`、`command`、`timeout`，不写 `matcher`；`command` 为 `node hooks/uapa-kimi.mjs <检查名>`（插件 hook 以插件根目录为工作目录）；`timeout` 取能力数据的 `hookTimeoutSeconds`（30） | F-08-01, F-08-02, F-03-13 |
| F-08-04 | v0.1.0 | hooks | 子进程入口的决策输出 | `generate` 以 `input.bundle`（`entry: 'kimi-subprocess'`、`external: 'node'`）打包入口并输出为 `hooks/uapa-kimi.mjs`。`kimi-subprocess.ts` 实现 `SubprocessProtocol`：会话 id 取 stdin `session_id`，工具名取 `tool_name`；工具入参与提示文本的字段名取自 TA-15 入口前提的结论；拒绝与停机继续以退出码 2 结束并在 stderr 写原因；不实现 `rewriteShell`（能力数据 `rewriteInput` 为 `false`）；`dataDir` 返回 `path.join(os.tmpdir(), 'uapa-' + encodeURIComponent(插件名))`（SD-06）；有停机前检查时残余风险写明系统临时目录被清理时停机计数归零 | F-04-02, F-04-04, F-04-05, F-04-06, F-08-01 |
| F-08-05 | v0.1.0 | 产物校验 | hook 规则字段检查 | 任一规则出现 `event`、`matcher`、`command`、`timeout` 之外的字段时生成失败 | F-08-03 |
| F-08-08 | v0.1.0 | hooks | 写入声明的命令 hooks | 能力数据按[命令 hooks 声明](../../architecture/command-hooks.md)第 2 节填写 `commandHookEvents`；`kimi.plugin.json` 的 `hooks` 按 `TargetPlan.commandHooks` 追加规则，字段同 F-08-03（`event`、`command`、`timeout`），`{pluginRoot}` 换为 `.`，同一事件下排在守卫规则之后；未配置守卫时只写 `hooks` 字段，不生成入口 | F-08-03, F-03-15 |
| F-08-06 | v0.2.0 | 组件 | 放置 agents | 适用的 agents 写入产物 `agents/`，路径写入 manifest 的 `agents` 字段 | F-01-07, F-08-02 |
| F-08-07 | v0.2.0 | 组件 | 生成 `mcpServers` 字段 | 由规范形式生成 manifest 的 `mcpServers` | F-01-08, F-08-02 |
