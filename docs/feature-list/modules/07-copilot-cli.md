# 07 Copilot CLI 目标

构建 `copilot-cli:subprocess`，产物采用 `$schema` 格式。代码位于 `src/targets/copilot-cli/`、
`src/capabilities/` 中的对应数据模块与 `src/runtime/entries/` 中的对应入口。宿主事实见
[GitHub Copilot](../../research/coding-agent-plugin-manifests/github-copilot-plugins.md)。

| 编号 | 阶段 | 子模块 | 功能名称 | 验收标准 | 依赖 |
|---|---|---|---|---|---|
| F-07-01 | v0.1.0 | 能力数据 | `copilot-cli:subprocess` 的能力数据 | 写明宿主版本、核对日期与出处；取值与 hooks 适配第 3、4、6、7 节一致 | F-03-01 |
| F-07-02 | v0.1.0 | manifest | 生成根 `plugin.json` | `$schema` 格式，顶层只用文档列出的 10 个字段；该文件声明为可合并 | F-01-03, F-03-07 |
| F-07-03 | v0.1.0 | hooks | 生成 `com.github.copilot/hooks/hooks.json` | matcher 按 `^(?:PATTERN)$` 全匹配写法生成；显式写出超时 | F-07-01, F-03-02 |
| F-07-04 | v0.1.0 | hooks | 子进程入口的决策输出 | 拒绝输出 `permissionDecision: "deny"` 与 `permissionDecisionReason`；改写输出 `modifiedArgs`；停机继续在 `agentStop` 输出 `decision: "block"` | F-04-04, F-04-06, F-07-01 |
| F-07-05 | v0.1.0 | 产物校验 | 字段白名单检查 | `plugin.json` 顶层字段不超出封闭集合；Copilot 专有组件只放在 `com.github.copilot/` 下 | F-07-02, F-07-03 |
| F-07-06 | v0.2.0 | 组件 | 放置 agents | 适用的 agents 写入 `com.github.copilot/agents/*.agent.md` | F-01-07 |
| F-07-07 | v0.2.0 | 组件 | 生成 `mcp.json` | 由规范形式生成服务器配置，`{pluginRoot}` 换为 `${PLUGIN_ROOT}` | F-01-08 |
| F-07-08 | v0.2.0 | hooks | 执行后检查的决策输出 | 替换与扣留都以 `modifiedResult` 输出 | F-02-04, F-04-08, F-07-04 |
