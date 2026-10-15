# 施工单 M4-02：rules 与 commands

> 源项目增加 `rules/` 与 `commands/` 两种组件：agy 把 rules 换算为自己的 frontmatter 写出，
> Claude Code 与 Codex 原样放置 commands（Codex 在安装时转换为技能，限制写为残余风险），其余目标按
> 不承载处理。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M4-00](M4-00-v0-3-0-rules-commands-guard-options.md) |
| 覆盖功能点 | `F-01-10`、`F-01-11`、`F-03-16`、`F-05-16`、`F-06-09`、`F-11-09` |
| 依赖工单 | [M4-01](M4-01-v0-3-0-interfaces.md) |
| 关联 issue | 无 |
| 验收文件 | [M4-02](../acceptance/M4-02-rules-and-commands.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 已有且够用：`readFrontmatter`、`readTargets`（`src/source/frontmatter.ts`）读取 frontmatter 与
  目标限定；`readAgents`（`src/source/agents.ts`）是读取一层 `.md` 组件的先例；`planComponents`
  （`src/build/plan.ts`）按组件种类筛选并写跳过项或失败；`agentUnion`、`agentFiles`、
  `recordAgentRisks`（`src/build/outputs.ts`）按插件目录复制 agents 并写残余风险。
- 已有但不对：`Component`（`src/capabilities/types.ts`）只有 `skills`、`agents`、`mcp`、`hooks`；
  `COMPONENT_KINDS` 只有 skills 与 agents；`readFrontmatter` 不返回正文；`src/build/outputs.ts`
  已有 266 行，再加 commands 的复制会超过 300 行。
- 完全没有：rules 与 commands 的读取、`TargetPlan.rules` 与 `TargetPlan.commands`、agy 的 rules
  生成、含这两种组件的夹具。
- 宿主事实：[agy「rules（1.3.5，容器）」](../research/coding-agent-plugin-manifests/agy-plugins.md#rules135容器)；
  [Claude Code「commands 与 userConfig」](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#commands-与-userconfig)；
  [Codex 源码核对「commands、rules 与用户配置」](../research/coding-agent-plugin-manifests/codex-source-review.md#commandsrules-与用户配置)。

## ⚠️ 关键落地约束（必须先验证）

- **agy 的 `globs` 为一个字符串**：多个模式以 `,` 连接；YAML 列表不生效（已实测）。生成时以
  `yaml` 序列化 frontmatter，以 `*` 开头的模式会被加引号，与实测的写法等价；产物在宿主中的
  效果由 M4-05 复测。
- **正文原样保留**：`Rule.body` 取 frontmatter 结束行之后的原始文本（含原有换行符），agy 产物
  只替换 frontmatter；Claude Code 的 commands 整个文件逐字节复制。
- **Codex 的命令转换不由 UAPA 复刻**：Codex 安装时跳过正文含 `$ARGUMENTS` 等模板写法或转换
  结果超过 4000 字节的命令；UAPA 原样放置，由 Codex 宿主模块在 `TargetPlan.commands` 非空时写
  一条残余风险，不逐条判断。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 否 | 不改守卫与入口 |
| 产物零依赖 | 否 | 不改入口与打包 |
| 不在运行时推断宿主 | 否 | 不改入口 |
| 确定性输出 | 是 | `rules-commands` 夹具逐字节比对；rules 按名称排序生成，frontmatter 只含源项目的取值 |
| 不越权写入 | 是 | `rules-commands` 夹具比对运行后的整个源项目目录：commands 与 rules 只出现在插件目录 |
| 安装不运行脚本 | 否 | 不改 `package.json` |
| 能力数据有出处 | 是 | 四个能力数据模块的 `components.rules`、`components.commands` 各带出处注释；TA-09 的测试照常通过 |

## 任务

### 1. 源项目（`src/source/`）

- `frontmatter.ts` 增加取得正文的函数：返回 frontmatter 映射与结束行之后的原文；`readFrontmatter`
  的行为不变。
- `rules.ts`：按 F-01-10 读取 `rules/` 下一层的 `.md`，得出 `Rule`（`name`、`path`、`activation`、
  `description`、`globs`、`body`、`targets`），按名称排序；`commands.ts`：按 F-01-11 得出
  `Command`（`name`、`path`、`targets`）。字段以模块接口 §3 为准。
- `types.ts`、`index.ts`：`SourceProject` 增加 `rules`、`commands`；读取失败与其他组件的
  `InputIssue` 合并返回。

### 2. 能力数据与能力检查（`src/capabilities/`、`src/build/plan.ts`、`src/targets/types.ts`）

- `Component` 增加 `rules`、`commands`。Claude Code 两个目标为 `rules: 'none'`、
  `commands: 'package'`；Codex 为 `rules: 'none'`、`commands: 'package'`；agy 为
  `rules: 'package'`、`commands: 'none'`。
  每项注明出处（F-05-16、F-06-09、F-11-09）。
- `COMPONENT_KINDS` 增加 `rules`（`rule`，`rules/<name>.md`）与 `commands`（`command`，
  `commands/<name>.md`）；`TargetPlan` 增加 `rules`、`commands`（F-03-16）。

### 3. 放置 commands（`src/build/`）

- 把 skills、agents 的并集、复制与残余风险从 `outputs.ts` 移到新文件 `components.ts`，行为不变；
  在其中加入 commands：写入该插件目录的成功目标 `TargetPlan.commands` 的并集原样复制为
  `commands/<name>.md`，不适用于同目录某承载 commands 的目标时写残余风险（F-03-16、F-05-16）。

### 4. Codex 的命令残余风险（`src/targets/codex/index.ts`）

- `TargetPlan.commands` 非空时，`residualRisks` 增加 F-06-09 规定的一条（F-06-09）。

### 5. agy 的 rules（`src/targets/agy/`）

- 新增 `rules.ts`：按 `TargetPlan.rules` 生成 `rules/<name>.md`，frontmatter 依次写 `trigger`、
  `description`（有值时）、`globs`（`glob` 时以 `,` 连接），后接 `Rule.body`（F-11-09）；
  `index.ts` 把这些文件加入返回的文件列表。

### 6. 帮助文档（`docs/guide/`）

- `source-project.md` 写 rules 与 commands 的源格式；`targets.md` 写三个宿主的承载情况。

### 不改的地方（红线）

- 现有 18 个夹具的期望产物不变；`full`、`merged` 的 TA-06 确定性测试照常通过。
- skills、agents 的放置与残余风险文本不变（只搬移代码）。
- 不改入口、打包与守卫接口。

### 测试

- 单元：`test/source/` 中 rules 的缺 frontmatter、未知键、`activation` 取值、`model` 缺
  `description`、`glob` 缺 `globs`、非 `glob` 写 `globs`、`globs` 元素含 `,`、文件名不合规则、
  正文含 CRLF 时原样保留；commands 缺 frontmatter、缺 `description`、其他键保留。
  `test/build/` 中以 `components.rules`、`components.commands` 为 `'none'` 的合成能力数据覆盖
  未写 `targets` 时跳过、显式限定时失败。`test/targets/` 中 agy 的三种 `activation` 换算、Codex
  有无 commands 时的残余风险。
- 夹具：新增 `rules-commands`（夹具表），断言 TA-21 的通过标准。

## 验收

```bash
test/container/run.sh check
```

```bash
test/container/run.sh exec node --test test/fixtures/fixtures.test.ts
```

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 最终实现方案、关键技术决策及其验证依据；
3. 主要改动点与涉及模块清单；
4. 测试覆盖、宿主实测结果、判断范围和已知限制；
5. 如适用，附生成的产物或入口的输入输出示例。

## 边界

- 允许新增与修改：`src/source/`、`src/capabilities/`、`src/build/plan.ts`、`src/build/outputs.ts`、
  `src/build/components.ts`、`src/targets/types.ts`、`src/targets/agy/`、
  `src/targets/codex/index.ts`（残余风险）、`test/`、`docs/guide/`、
  夹具表与模块接口中本单涉及的段落。
- 禁止修改：`src/runtime/`、`src/bundle/`、Claude Code 宿主模块与 Codex 宿主模块的生成逻辑。

## 依赖

M4-01 的接口定稿。
