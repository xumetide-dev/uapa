# 08 Kimi Code 目标

构建 `kimi:subprocess`。hooks 写在 `kimi.plugin.json` 的 `hooks` 字段中。代码位于
`src/targets/kimi/`、`src/capabilities/` 中的对应数据模块与 `src/runtime/entries/` 中的对应入口。
宿主事实见 [Kimi Code](../../research/coding-agent-plugin-manifests/kimi-code-plugins.md)。

| 编号 | 阶段 | 子模块 | 功能名称 | 验收标准 | 依赖 |
|---|---|---|---|---|---|
| F-08-01 | v0.1.0 | 能力数据 | `kimi:subprocess` 的能力数据 | 写明宿主版本、核对日期与出处；改写入参与执行后检查记为不支持 | F-03-01 |
| F-08-02 | v0.1.0 | manifest | 生成 `kimi.plugin.json` | 由配置生成名称、版本、描述与 `skills` 路径；目标选项可写 `interface` | F-01-03, F-03-05 |
| F-08-03 | v0.1.0 | hooks | 生成 hooks 规则 | 写入 `kimi.plugin.json` 的 `hooks`；每条规则只含 `event`、`matcher`、`command`、`timeout`；命令以插件根目录为工作目录 | F-08-01, F-08-02, F-03-02 |
| F-08-04 | v0.1.0 | hooks | 子进程入口的决策输出 | 拒绝与停机继续以退出码 2 输出并写原因；改写按 `fallbackReason` 拒绝 | F-04-02, F-04-04, F-04-06, F-08-01 |
| F-08-05 | v0.1.0 | 产物校验 | hook 规则字段检查 | 任一规则出现第五个字段时该目标失败 | F-08-03 |
| F-08-06 | v0.2.0 | 组件 | 放置 agents | 适用的 agents 写入产物 `agents/`，路径写入 manifest 的 `agents` 字段 | F-01-07, F-08-02 |
| F-08-07 | v0.2.0 | 组件 | 生成 `mcpServers` 字段 | 由规范形式生成 manifest 的 `mcpServers` | F-01-08, F-08-02 |
