# 施工单 M2-03：agents

> 读取源项目的 `agents/*.md`，按 frontmatter 的 `targets` 与目标的组件承载筛选，写入 Claude Code
> 与 agy 的插件目录；Codex 不承载 agents，列为跳过。新增 `components` 夹具的 agents 部分。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M2-00](M2-00-v0-2-0-three-host-completion.md) |
| 覆盖功能点 | `F-01-07`、`F-05-11`、`F-11-07` |
| 依赖工单 | [M2-01](M2-01-v0-2-0-host-facts.md) |
| 关联 issue | 无 |
| 验收文件 | [M2-03](../acceptance/M2-03-agents-component.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 已有且够用：
  - `src/source/skills.ts` 的 `readFrontmatter`（开头两行 `---` 之间的 YAML 映射）与
    `readTargets`（未知目标名或空数组时失败），可供 agents 复用。
  - `src/build/plan.ts` 的 `planSkills` 按 `targets` 与 `components.skills` 筛选并写跳过项与
    错误（F-03-02）。
  - `src/build/outputs.ts` 的 `skillUnion` 与 `recordSkillRisks` 按插件目录取并集并写残余风险
    （SD-21）。
- 已有但不对：能力数据的 `components.agents` 已填写（Claude Code 与 agy 为 `package`，Codex 为
  `none`），没有代码读取。
- 完全没有：`SourceProject` 的 agents 字段（`src/source/types.ts`）、读取 `agents/` 的代码、
  `TargetPlan` 中的 agents、写出 agents 文件的代码与测试。
- 宿主事实：Claude Code 加载插件的 `agents/*.md`，子目录计入 agent 名，manifest 的 `agents`
  字段会替换默认目录，见
  [Claude Code](../research/coding-agent-plugin-manifests/claude-code-plugins.md)；agy 加载
  `agents/<name>.md`，见 [agy](../research/coding-agent-plugin-manifests/agy-plugins.md)；
  frontmatter 的规则以 M2-01 的结论为准。

## ⚠️ 关键落地约束（必须先验证）

- **放置方与文件内容按 SD-30**：由构建编排按插件目录放置（与 skills 相同），还是由宿主模块
  写出，以及 frontmatter 是否原样保留（含 `targets`），以 M2-01 定下的 SD-30 与模块接口 §5
  为准。
- **只读 `agents/` 下一层的 `.md` 文件**：子目录不读取，避免 Claude Code 把子目录计入 agent 名
  而 agy 不计；子目录的处理以 SD-30 为准。
- **承载未核实的宿主**：M2-01 把某宿主的 `components.agents` 记为 `none` 时，该宿主的 agents
  按 F-03-02 列为跳过，不写文件。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 否 | |
| 产物零依赖 | 否 | |
| 不在运行时推断宿主 | 否 | |
| 确定性输出 | 是 | `components` 夹具在临时目录中构建，agents 文件逐字节比对；读取顺序按文件名排序 |
| 不越权写入 | 是 | `components` 夹具与 `--check` 的单元测试：agents 只写入插件目录，`--check` 不写文件 |
| 安装不运行脚本 | 否 | |
| 能力数据有出处 | 否 | |

## 任务

### 1. 源项目（`src/source/`）

- 读取 `agents/*.md`：`agents/` 不存在时为空列表；frontmatter 的 `name`、`description` 为
  非空字符串，`targets` 按 F-01-05 的规则；与文件名的关系按 SD-30；结果按 `name` 排序
  （F-01-07）。

### 2. 能力检查（`src/build/plan.ts`、`src/targets/types.ts`）

- `TargetPlan` 加入 agents：不适用于本目标的不计；本目标不承载 agents 时，显式写了本目标的
  agent 使目标失败，未写 `targets` 的列为跳过，`component` 为 `agents/<name>.md`（F-03-02）。

### 3. 写出（按 SD-30：`src/build/outputs.ts`，或 `src/targets/claude-code/` 与 `src/targets/agy/`）

- Claude Code 写入 `agents/<name>.md`，两种形态共用插件目录时取两者的并集（F-05-11）；agy 写入
  `agents/<name>.md`（F-11-07）；共用插件目录中不适用于某目标的 agent 记为该目标的残余风险。

### 4. 夹具（`test/fixtures/components/`）

- 两个 agent：一个不写 `targets`，一个只限定 `agy:subprocess`；四个目标，默认布局。Codex 的
  报告中前者列为跳过；Claude Code 的插件目录只含前者。

### 不改的地方（红线）

- v0.1.0 的 16 个夹具的期望输出不变：它们没有 `agents/` 目录，产物与报告不含 agents 的条目。
- skills 的读取与放置规则不变。
- Codex 的产物中不出现 `agents/` 目录。

### 测试

- 单元：`agents/` 不存在、不是目录、缺 frontmatter、缺 `name` 或 `description`、`targets` 含
  未知目标名时的结果；承载为 `none` 的合成能力数据下，agent 未写 `targets` 与显式写了该目标
  两种情况（TA-04 的组件承载部分）。
- 夹具：`components` 的整树比对（TA-20 的 agents 部分）；`merged` 等现有夹具不变。

## 验收

```bash
pnpm check
node --test test/fixtures/fixtures.test.ts test/source/agents.test.ts test/build/build.test.ts test/targets/claude-code.test.ts test/targets/agy.test.ts test/targets/codex.test.ts
```

宿主实测见 M2-05。

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 最终实现方案、关键技术决策及其验证依据；
3. 主要改动点与涉及模块清单；
4. 测试覆盖、判断范围（夹具与单元测试）和已知限制；
5. `components` 夹具中各插件目录的 agents 文件与报告的跳过项。

## 边界

- 允许新增与修改：`src/source/`、`src/build/`、`src/targets/`、`test/`、与本单相关的接口文档与
  功能清单条目。
- 禁止修改：`src/runtime/`；v0.1.0 夹具的期望文件。

## 依赖

M2-01：agents 的宿主结论与 SD-30。
