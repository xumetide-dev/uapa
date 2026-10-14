# 06 Codex 目标

构建 `codex:subprocess`。代码位于 `src/targets/codex/`、`src/capabilities/` 中的对应数据模块与
`src/runtime/entries/` 中的对应入口。宿主事实见
[Codex](../../research/coding-agent-plugin-manifests/codex-plugins.md)。插件 hooks 只对桌面端手动
安装的插件生效，构建报告写明。

| 编号 | 阶段 | 子模块 | 功能名称 | 验收标准 | 依赖 |
|---|---|---|---|---|---|
| F-06-01 | v0.1.0 | 能力数据 | `codex:subprocess` 的能力数据 | 写明宿主版本、核对日期与出处；取值与 hooks 适配第 3、4、6、7 节一致 | F-03-01 |
| F-06-02 | v0.1.0 | manifest | 生成根 `plugin.json` | `$schema` 格式；`extensions.com.openai` 写 hooks 文件路径，目标选项可写 `interface`；该文件声明为可合并 | F-01-03, F-03-07 |
| F-06-03 | v0.1.0 | hooks | 生成 hooks 配置 | 默认写 `hooks/hooks.json`；目标选项 `hooksFile` 可改为独立文件，路径同时写入 `extensions.com.openai.hooks`；显式写出超时 | F-06-01, F-03-02 |
| F-06-04 | v0.1.0 | hooks | 子进程入口的决策输出 | 拒绝以退出码 2 输出且 stderr 非空，或输出 `permissionDecision: "deny"`；改写输出 `updatedInput` 并配合 `allow`；停机继续输出 `decision: "block"` 与 `reason` | F-04-04, F-04-06, F-06-01 |
| F-06-05 | v0.1.0 | 产物校验 | 字段白名单检查 | 生成的 `plugin.json` 与 hooks 配置只含文档列出的字段，否则该目标失败 | F-06-02, F-06-03 |
| F-06-06 | v0.2.0 | 组件 | 生成 `mcp.json` | 由规范形式生成服务器配置，每个服务器写明传输 `type` | F-01-08 |
| F-06-07 | v0.2.0 | hooks | 执行后检查的决策输出 | 扣留以 `PostToolUse` 返回 `decision: "block"` 输出；声明需要 `replaceOutput` 时构建失败 | F-02-04, F-04-08, F-06-04 |
