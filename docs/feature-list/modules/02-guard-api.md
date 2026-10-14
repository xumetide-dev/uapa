# 02 守卫接口

插件作者编写守卫逻辑时使用的公共类型，以及构建时读取守卫声明。类型定义位于
`src/runtime/core/types.ts`，由包入口 `src/index.ts` 导出；读取守卫声明位于
`src/source/guard.ts`。守卫逻辑以 `export default` 导出 `GuardPlugin`，只以 `import type` 引用
这些类型，打包时擦除。类型的语义见 [hooks 适配 §2](../../research/coding-agent-plugin-manifests/uapa-hook-adapters.md#2-公共类型)，
守卫声明的结构见 [模块接口 §3](../../architecture/module-interfaces.md)。

| 编号 | 阶段 | 子模块 | 功能名称 | 验收标准 | 依赖 |
|---|---|---|---|---|---|
| F-02-01 | v0.1.0 | 公共类型 | 导出守卫公共类型 | 包入口导出 `GuardPlugin`、`ToolCall`、`BeforeTool`、`BeforeStop`、`Capability`；`GuardPlugin` 为 hooks 适配第 2 节去掉 `afterTool` 后的形式；`Capability` 含 `rewriteInput`、`replaceOutput`、`withholdOutput`、`stopGate`（`promptGate` 由 F-02-02 加入）；`src/runtime/core/types.ts` 另定义不由包入口导出的 `CanonicalTool`、`ToolNameMap`（模块接口 §4）与 `GuardCheck`（模块接口 §3）、`TargetRuntimeData`（入口与打包接口第 1 节） | — |
| F-02-02 | v0.1.0 | 公共类型 | 提示提交前检查接口 | `GuardPlugin` 增加可选的 `beforePrompt(p: PromptSubmit)`，返回 `BeforePrompt`：`allow`，或带 `reason` 的 `block`；`Capability` 增加 `promptGate`；包入口另导出 `PromptSubmit` 与 `BeforePrompt` | F-02-01 |
| F-02-03 | v0.1.0 | 守卫加载 | 构建时读取守卫声明 | `readGuard` 导入配置 `guard` 指定的守卫逻辑，按模块接口 §3 得出 `GuardDeclaration`（`name`、`requires` 与已实现的检查）；默认导出不符合 `GuardPlugin` 时返回 `InputIssue`；默认导出含 `afterTool` 方法，或 `requires` 含 `replaceOutput`、`withholdOutput` 时同样返回 `InputIssue`，原因写明 v0.1.0 不支持执行后检查（SD-20） | F-01-02, F-02-01, F-02-02 |
| F-02-04 | v0.2.0 | 公共类型 | 执行后检查接口 | `GuardPlugin` 增加 `afterTool`，包入口导出 `AfterTool`；`GuardCheck` 增加 `'afterTool'`；F-02-03 不再拒绝 `afterTool` 与 `replaceOutput`、`withholdOutput`，这两项能力参与构建时能力检查 | F-02-01, F-02-03 |
