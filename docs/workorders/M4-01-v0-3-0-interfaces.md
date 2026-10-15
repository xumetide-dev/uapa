# 施工单 M4-01：v0.3.0 接口定稿

> 把 SD-32～SD-35 的决定写入模块接口、入口与打包接口、构建报告、hooks 适配、架构与设计提案：
> rules 与 commands 的源模型与放置规则、能力数据与 `TargetPlan` 的新字段、F-03-07 的合并规则、
> 守卫选项的类型与入口协议。本单不改代码。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M4-00](M4-00-v0-3-0-rules-commands-guard-options.md) |
| 覆盖功能点 | 无（接口文档；功能由 M4-02～M4-04 实现） |
| 依赖工单 | 无 |
| 关联 issue | 无 |
| 验收文件 | [M4-01](../acceptance/M4-01-v0-3-0-interfaces.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 已有且够用：SD-31～SD-35 与 v0.3.0 的 13 个功能条目（[功能清单](../feature-list/README.md)）；
  宿主事实见 [agy「rules（1.3.5，容器）」](../research/coding-agent-plugin-manifests/agy-plugins.md#rules135容器)、
  [Claude Code「commands 与 userConfig」](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#commands-与-userconfig)、
  [Codex「commands、rules 与用户配置」](../research/coding-agent-plugin-manifests/codex-source-review.md#commandsrules-与用户配置)。
- 已有但不对：
  - [模块接口](../architecture/module-interfaces.md) §3 的 `SourceProject` 没有 `rules`、`commands`，
    `GuardDeclaration` 没有 `options`；§4 的 `components` 只有四种组件；§5 的 `TargetPlan` 没有
    `rules`、`commands`，`OutputFile.merge` 与合并规则标为预留（F-03-07）。
  - [入口与打包接口](../architecture/runtime-interfaces.md)第 1 节的 `TargetRuntimeData` 没有
    `options`；第 2 节的 hooks 模块入口只接收 `on`；第 3 节的 `SubprocessProtocol` 没有
    `optionValue`。
  - [构建报告](../architecture/build-report.md)的 `skipped` 与 `residualRisks` 顺序只列到 agents、
    MCP 服务器与命令 hooks 声明。
  - [hooks 适配](../research/coding-agent-plugin-manifests/uapa-hook-adapters.md#2-公共类型)第 2 节的
    `GuardPlugin` 没有 `options`，检查方法没有 `GuardContext` 参数。
  - [架构](../architecture/architecture.md) §1 第 2 步写“v0.1.0 的组件只有 skills”，第 5 步写
    “按命名空间合并 JSON 为预留”；`build` 的职责只写“放置 skills 与覆盖文件”。
  - [设计提案](../research/coding-agent-plugin-manifests/unified-agent-plugin-architecture.md)第 4 节把
    rules、commands 写为“未排期，SD-02”；第 6 节的组件表没有 agy 列，Codex 的 commands 为“无”；
    第 10 节写守卫配置的统一接口延后（SD-10）。
- 完全没有：`Rule`、`Command`、`GuardOption`、`GuardContext` 的接口定义。

## ⚠️ 关键落地约束（必须先验证）

- **只写已定的决策**：宿主格式只引用 SD-32～SD-35 与上述调研小节；接口文档不写调研中未核实的
  宿主行为（如 Codex 转换后的命令调用方式、agy 的插件设置）。
- **接口与功能条目一致**：v0.3.0 条目引用的“模块接口 §3、§4、§5”“入口与打包接口第 1、3 节”
  在改完后都能找到对应定义；发现条目与接口矛盾时以范围决策为准修订条目，并在验收 §5 写明。
- **只扩展、不改语义**：v0.1.0、v0.2.0 的字段与规则保持原文，新字段以“v0.3.0”标注；`merge`
  的注释由“预留”改为 v0.3.0，规则文字不变。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 否 | 不改代码；无效取值的收口由 M4-04 实现与测试 |
| 产物零依赖 | 否 | 不改代码 |
| 不在运行时推断宿主 | 否 | 不改代码 |
| 确定性输出 | 否 | 不改代码 |
| 不越权写入 | 否 | 不改代码 |
| 安装不运行脚本 | 否 | 不改 `package.json` |
| 能力数据有出处 | 否 | 不改能力数据；`components.rules`、`components.commands` 的取值与出处由 M4-02 写入 |

## 任务

### 1. 模块接口（`docs/architecture/module-interfaces.md`）

- §3：`Rule`（`name`、`path`、`activation`、`description`、`globs`、`body`、`targets`）、`Command`
  （`name`、`path`、`targets`）、`SourceProject.rules` 与 `.commands`（按名称排序，没有目录时为
  空）；`GuardDeclaration.options`（按选项名排序，每项含 `name`、`type`、`title`、`description`、
  `default`）；读取规则各一条，指向 F-01-10、F-01-11、F-02-05。
- §4：`components` 的键增加 `rules`、`commands`。
- §5：`TargetPlan.rules`、`TargetPlan.commands`；commands 由构建编排按插件目录放置（同 agents）；
  rules 由宿主模块按 `TargetPlan.rules` 生成；`merge` 与合并规则去掉“预留”，标为 v0.3.0
  （F-03-07）。

### 2. 入口与打包接口（`docs/architecture/runtime-interfaces.md`）

- 第 1 节：`TargetRuntimeData.options`（按选项名排序的 `name`、`type`、`default`），没有选项时为
  空数组。
- 第 2 节：hooks 模块入口以 `register(on, options)` 接收用户设置，生成的 `register.ts` 把两者
  传给守卫入口。
- 第 3 节：`SubprocessProtocol.optionValue?(name, env)` 返回选项的文本或 `undefined`；取值规则
  （未实现或 `undefined` 取 `default`，number 为有限数，boolean 只接受 `true`、`false`）、无效时的
  原因 `uapa: 守卫选项无效: <选项名>` 与各检查的收口；`GuardContext` 只传给守卫实现的检查；
  `src/runtime/core/options.ts` 中两个纯函数（解析文本、检查模块收到的值）的签名。

### 3. 构建报告（`docs/architecture/build-report.md`）

- `skipped` 的顺序：skills、agents、rules、commands、MCP 服务器、命令 hooks 声明；`component`
  写作 `rules/<name>.md`、`commands/<name>.md`。
- `residualRisks`：第（4）类加入 commands；宿主模块返回的条目加入 Codex 的命令转换限制
  （F-06-09）、agy 的 rules 超长（F-11-09）与守卫选项取默认值（F-06-10、F-11-10）。

### 4. hooks 适配第 2 节与包入口

- `GuardOption`、`GuardContext`，`GuardPlugin.options` 与各检查方法的最后一个参数；说明包入口
  导出两者（F-02-05）。

### 5. 架构与设计提案

- 架构 §1：第 2 步的组件、第 5 步的合并与 `build` 的职责按 v0.3.0 改写；`runtime/core` 的职责
  加入选项取值。
- 设计提案：第 4 节的两行改为 v0.3.0（SD-32、SD-33）；第 6 节的组件表加 agy 列，Codex 的
  commands 改为“包内（安装时转换为技能）”；第 10 节的守卫配置改为已由 SD-35 落实。

### 不改的地方（红线）

- 不改 `src/`、`test/` 与能力数据。
- 不改 v0.1.0、v0.2.0 功能条目与范围决策的语义。
- 帮助文档 `docs/guide/` 随实现工单更新，本单不改。

### 测试

- 文档：`node scripts/check-feature-list.mjs` 通过；改动文件的相对链接与锚点有效；
  `test/container/run.sh check` 照常通过（247 pass / 0 fail）。

## 验收

```bash
node scripts/check-feature-list.mjs
```

```bash
test/container/run.sh check
```

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 接口定义的要点及其依据（范围决策与调研小节）；
3. 改动的文档与段落清单；
4. 判断范围（文档）和已知限制。

## 边界

- 允许新增与修改：`docs/architecture/`、`uapa-hook-adapters.md`、
  `unified-agent-plugin-architecture.md`、`docs/feature-list/` 中与接口矛盾的条目。
- 禁止修改：`src/`、`test/`、`docs/guide/`、其他调研文档。

## 依赖

无。
