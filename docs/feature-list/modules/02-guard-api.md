# 02 守卫接口

插件作者编写守卫逻辑时使用的公共类型，以及构建时读取守卫声明。类型定义位于
`src/runtime/core/`，由包入口 `src/index.ts` 导出。守卫逻辑只以 `import type` 引用这些类型，
打包时擦除。类型的语义见 [hooks 适配 §2](../../research/coding-agent-plugin-manifests/uapa-hook-adapters.md#2-公共类型)。

| 编号 | 阶段 | 子模块 | 功能名称 | 验收标准 | 依赖 |
|---|---|---|---|---|---|
| F-02-01 | v0.1.0 | 公共类型 | 导出守卫公共类型 | 包入口导出 `GuardPlugin`、`ToolCall`、`BeforeTool`、`BeforeStop`、`Capability`，与 hooks 适配第 2 节一致 | — |
| F-02-02 | v0.1.0 | 公共类型 | 提示提交前检查接口 | `GuardPlugin` 增加可选的 `beforePrompt`，返回放行或带原因的阻断；新增能力 `promptGate` | F-02-01 |
| F-02-03 | v0.1.0 | 守卫加载 | 构建时读取守卫声明 | 构建时导入配置指定的守卫模块，读取 `name`、`requires` 与已实现的检查；默认导出不符合 `GuardPlugin` 时失败 | F-01-02, F-02-01 |
| F-02-04 | v0.2.0 | 公共类型 | 执行后检查接口 | 导出 `AfterTool` 与 `afterTool`；`replaceOutput`、`withholdOutput` 参与构建时能力检查 | F-02-01 |
