# UAPA 构建报告

本文是[模块接口](module-interfaces.md) §7 的内容：构建报告的类型、终端摘要与各字段的填写规则。
报告的写出时机、比对与退出码见[写出、比对与退出码](build-output.md)，路径写法见模块接口 §2。
代码块中的类型是实现时的
约定，字段名与文件位置以本文为准。

```ts
// src/report/types.ts：不引用其他模块的类型
// targets 按配置中的目标顺序排列
export interface BuildReport { readonly targets: readonly TargetReport[] }
export interface TargetReport {
  readonly target: string
  readonly status: 'ok' | 'failed'
  readonly errors: readonly string[]
  readonly host: { name: string; version: string; checked: string; source: string }
  readonly units: readonly { kind: string; path: string }[] // path 相对配置文件所在目录
  // component 为相对插件目录的组件路径，如 'skills/review'、'agents/reviewer.md'、
  // 'rules/style.md'、'commands/deploy.md'（v0.3.0 / v0.4.0）；
  // 命令 hooks 声明写作 'commandHooks[<下标>]'，MCP 服务器写作 'mcpServers.<名称>'
  readonly skipped: readonly { component: string; reason: string }[]
  readonly degraded: readonly { decision: string; as: string; reason: string }[]
  readonly overridden: readonly string[] // 相对插件目录
  // none 为本次未调用 verify：宿主模块未实现，或该宿主未写出文件
  readonly hostValidation: 'passed' | 'failed' | 'skipped' | 'none'
  readonly residualRisks: readonly string[]
}
// 终端摘要；reportPath 为报告文件相对配置文件所在目录的路径；由 cli 写到 stdout
export function formatSummary(report: BuildReport, reportPath: string): string
```

- 报告写到 `<outDir>/uapa-report.json`，两空格缩进、结尾换行；不含时间、绝对路径与用户名。
- `--check` 不生成也不比对报告。
- 各字段由构建编排按下表填写。`errors`、`reason` 与 `residualRisks` 的说明文字，除验收标准中
  逐字给出的原因外不逐字规定；字段、取值与条目顺序按下表。

| 字段 | 规则 |
|---|---|
| `status`、`errors` | 错误依次来自能力检查、`HostResult.errors` 中本目标的条目、合并冲突、宿主校验；宿主模块返回 `ok: false` 而没有本目标的条目时，写 `同一宿主的生成失败`；`generate` 抛错（含 `bundle` 打包失败）时，写 `同一宿主的生成失败: <异常消息>` |
| `host` | 取自能力数据的 `host` |
| `units` | v0.1.0 为 `[{ kind: 'plugin', path: <插件目录> }]`；v0.4.0 起写出 marketplace 文件的宿主，其成功目标再追加 `{ kind: 'marketplace', path: <该文件> }`（F-03-18）；未写出文件的目标（能力检查、宿主生成或合并冲突失败）为空；宿主校验失败的目标保留 |
| `skipped` | 按 F-03-02、F-03-15、F-03-16 与 F-03-20，依次为 skills、agents、rules、commands（v0.3.0）、MCP 服务器与命令 hooks 声明；再按返回顺序写 `HostResult.skipped` 中本目标的条目（v0.2.0：SD-30 中不能换算插件根的 MCP 服务器；v0.4.0：Codex 跳过无 `description` 的 `glob` 规则（F-06-11）、转换时会被跳过的 commands（F-06-13）与超长的 skills/规则技能（F-06-16）） |
| `degraded` | 依次为：（1）守卫实现了 `beforeTool`、目标缺 `rewriteInput` 且 `requires` 不含它时，写一条 `{ decision: 'rewrite', as: 'deny' }`，`reason` 说明目标不能改写入参、`rewrite` 按 `fallbackReason` 拒绝；（2）v0.2.0：守卫实现了 `afterTool`、目标有 `withholdOutput` 而缺 `replaceOutput` 且 `requires` 不含它时，写一条 `{ decision: 'replace', as: 'withhold' }`，`reason` 说明目标不能替换输出、`replace` 的文本作为扣留说明写出（SD-29） |
| `overridden` | 按 F-03-12 |
| `hostValidation` | 按 F-03-14 |
| `residualRisks` | 先写构建编排按能力数据生成的条目，依次为：（1）子进程目标的 `TargetPlan.checks` 中 `failureDefault[检查].error` 为 `'allow'` 的检查（Claude Code 设置 `onFailure: 'block'` 的 `beforeTool` 与 `beforePrompt` 除外，F-05-21），按 `checks` 顺序各写一条：缺少 Node ≥ 22 或入口无法启动时该检查不生效；（2）因 `stopGate`、`promptGate` 与 `withholdOutput`（v0.2.0，SD-29）缺失而省略的检查；（3）`TargetPlan.checks` 非空、`hookTimeoutSeconds` 为 `null` 且 `defaultTimeoutSeconds` 不为 `null` 时，hooks 配置未写超时、沿用的宿主默认超时；（4）共用插件目录中不适用于本目标的 skill，以及 v0.2.0 的 agent、v0.3.0 的 command（[宿主模块接口](host-module-interface.md)）。再按返回顺序写 `HostResult.residualRisks` 中本目标的条目。宿主模块只返回能力数据表达不了的风险（如 F-05-10、F-06-03、F-11-03/F-11-15 所列；v0.2.0 另有 SD-29 中执行后检查只覆盖部分工具或部分调用的目标，以及 SD-30 中 Codex 不为 MCP 服务器名加命名空间；v0.3.0 另有 agy 超出大小上限的 rules（F-11-09）与 Codex/agy 的守卫选项取默认值（F-06-10、F-11-10）；v0.4.0 另有规则换算、命令转换、MCP 环境变量与 `${user_config.*}` 剥离、`SessionEnd` 3 秒截断、停机与 `/btw` 等风险（F-05-19～F-05-26、F-06-11～F-06-18、F-11-11～F-11-15）），不重复上述各类 |
