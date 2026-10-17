# 施工单 M5-03：rules 与 commands 的换算承载

> 能力数据的承载方式增加 `converted`：组件由宿主模块换成宿主承载的其他组件。
> - Claude Code 与 Codex：`model`、`glob` 规则写为技能，`always` 规则由 `SessionStart` 命令 hook
>   输出。
> - agy：commands 改为原样复制，agy 安装时转换为技能（SD-39）。
> - Codex：逐个检查 commands 的转换条件，会被跳过的命令列为跳过。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M5-00](M5-00-v0-4-0-host-coverage.md) |
| 覆盖功能点 | `F-03-19`、`F-05-19`、`F-06-11`、`F-06-13`、`F-11-11` |
| 依赖工单 | [M5-01](M5-01-v0-4-0-host-facts-and-interfaces.md)、[M5-02](M5-02-shared-files-and-claude-code-config.md) |
| 关联 issue | 无 |
| 验收文件 | [M5-03](../acceptance/M5-03-converted-rules-and-commands.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 已有且够用：
  - `planComponents`（`src/build/plan.ts`）按 `COMPONENT_KINDS` 筛选组件，并写跳过项或失败。
  - `componentUnion`、`componentFiles`、`recordComponentRisks`（`src/build/components.ts`）按
    插件目录复制 commands。
  - agy 的 `rules.ts`（`src/targets/agy/`）是宿主模块按 `TargetPlan.rules` 生成文件的先例。
  - `commandHooks`、`hooksKey`（`src/targets/claude-code/hooks.ts`）与 `src/targets/codex/hooks.ts`
    写命令 hooks 的条目。
- 已有但不对：
  - `Carrier` 只有 `package`、`manifest`、`none`。
  - Claude Code 两个目标与 Codex 的 `components.rules` 为 `none`，agy 的 `components.commands` 为
    `none`，这些组件被列为跳过。
  - Codex 在 `TargetPlan.commands` 非空时只写一条笼统的残余风险（F-06-09）。
  - `src/targets/codex/index.ts` 已有 212 行。
- 完全没有：生成 `skills/<name>/SKILL.md` 的规则与命令换算、输出 `always` 规则的入口文件、
  按 `command_migration.rs` 的条件逐个检查命令。
- 宿主事实：以 M5-01 写入调研文档的 TA-25 第 3、6 项结论，以及 Codex 源码核对的跳过条件为准。

## ⚠️ 关键落地约束（必须先验证）

- **TA-25 的结论**：
  - Claude Code 的 `paths` 技能与 `SessionStart` 输出生效，才实现 F-05-19。
  - M5-01 的结论（2.1.296、1.3.5）：Claude Code 的 `SessionStart` 输出与规则技能生效；agy 安装时
    把 `commands/` 转换为技能，F-11-11 按 `package` 原样复制。
- **共用插件目录时逐字一致**：Claude Code 与 Codex 为同一条规则生成的 `SKILL.md` 内容相同，合并
  布局中不产生冲突；Codex 不读 `paths`，但不拒绝该键。规则输出脚本按宿主分别命名
  （`hooks/uapa-rules-claude-code.mjs`、`hooks/uapa-rules-codex.mjs`，入口与打包接口 §2）。
- **入口文件零依赖**：输出 `always` 规则的入口只导入 `node:` 内置模块或不导入任何模块，规则正文
  在打包时写成字面量，文件名与命令以入口与打包接口为准。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 否 | 不改守卫条目；规则的 `SessionStart` 条目排在守卫条目之后 |
| 产物零依赖 | 是 | 规则入口的导入检查（与 TA-01 相同的测试）；`rules-commands` 的入口用例以 `process.execPath` 运行，环境为空 |
| 不在运行时推断宿主 | 是 | 规则入口不读取宿主环境变量，输出在打包时确定；入口用例在空环境中得到同样的输出 |
| 确定性输出 | 是 | `rules-commands` 夹具逐字节比对；规则按名称排序 |
| 不越权写入 | 是 | 夹具比对运行后的整个源项目目录 |
| 安装不运行脚本 | 否 | 不改 `package.json` |
| 能力数据有出处 | 是 | 四个能力数据模块中 `converted` 的取值各带出处注释（TA-25 小节、Codex 源码） |

## 任务

### 1. 能力检查与放置（`src/capabilities/types.ts`、`src/build/`）

- `Carrier` 增加 `converted`（F-03-19）。
- `planComponents` 把 `converted` 的组件放进 `TargetPlan`。
- 构建编排不为 `converted` 的目标原样复制该组件；同目录中另有目标为 `package` 时照常复制。

### 2. Claude Code（`src/targets/claude-code/`、`src/capabilities/claude-code-*.ts`）

- 新增 `rules.ts`：按 F-05-19 生成规则技能与 `always` 规则的入口文件。
- `hooks.json` 的 `hooks.SessionStart` 写入入口条目，排在守卫条目之后、声明的命令 hooks 之前。
- 与源项目 skill 同名时失败；输出超过 10,000 字符时写残余风险。

### 3. Codex（`src/targets/codex/`、`src/capabilities/codex-subprocess.ts`）

- 先把 `index.ts` 中的残余风险拆到单独的文件，行为不变。
- 规则：按 F-06-11 生成，与 Claude Code 共用生成函数，不跨宿主导入，放在宿主无关的位置，
  位置以 M5-01 的接口定稿为准。没有 `description` 的 `glob` 规则列为跳过。
- 命令：按 F-06-13 逐个检查命令，会被跳过的列为跳过，删去 F-06-09 的笼统残余风险。

### 4. agy（`src/targets/agy/`、`src/capabilities/agy-subprocess.ts`）

- 按 F-11-11 把 `components.commands` 改为 `package`，注释指向 agy 实测记录；命令不再列为跳过，
  补模型自动选用的残余风险。宿主模块不生成命令文件。

### 5. 帮助文档（`docs/guide/`）

- `targets.md`：组件矩阵中 rules 与 commands 的承载方式。
- `source-project.md`：换算的写法与限制。

### 不改的地方（红线）

- `rules-commands` 以外的夹具期望产物不变。
- agy 的 rules 生成（F-11-09）不变。
- 守卫条目与声明的命令 hooks 的写法不变。

### 测试

- 单元：
  - 合成能力数据中 `converted` 的筛选与不复制。
  - 规则技能的 frontmatter（三种 `activation`、有无 `description`）。
  - 与源项目 skill 同名时失败。
  - Codex 的命令检查覆盖每一条跳过条件，并有一条不跳过的对照。
  - agy 的命令原样复制，不列为跳过；有命令时写自动选用的残余风险。
- 夹具：更新 `rules-commands` 的期望产物；规则入口加入入口用例（空 stdin，期望 stdout 为规则
  正文）。

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

- 允许新增与修改：`src/capabilities/`、`src/build/`、`src/targets/`、`src/runtime/entries/`
  （规则入口，按接口定稿）、`src/bundle/`（如需打包规则入口）、`test/`、`docs/guide/`、
  夹具表中本单涉及的段落。
- 禁止修改：守卫接口、守卫入口的协议与决策输出。

## 依赖

M5-01 的 TA-25 结论与接口定稿；M5-02 对 `src/build/outputs.ts` 的拆分。
