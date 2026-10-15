# 验收 M2-03：agents

> 本文记录 M2-03 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M2-03](../workorders/M2-03-agents-component.md) |
| 覆盖功能点 | `F-01-07`、`F-05-11`、`F-11-07`（取自总览「工单构成」表） |
| 验收日期 | 2026-10-14 |
| 验收结论 | 有条件通过（`components` 产物中的 agents 在 Claude Code 与 agy 中的加载由 M2-05 实测） |
| 判断范围 | 夹具与单元测试 |
| commit | `a73da25` |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | 本单不改守卫与入口（`src/runtime/` 无改动）；`pnpm check` 中执行前检查的用例与全部夹具的入口用例通过（234 pass） |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | agents 为原样复制的 Markdown；`components` 产物没有入口文件，其余夹具的导入检查通过 |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | `components` 整树比对：源项目目录只多出 `dist/claude-code/`、`dist/codex/`、`dist/agy/` 与 `dist/uapa-report.json`；`layout.test.ts`「比对：agents 计入计划写出的文件，--check 不写文件」比对前后目录快照相同 |
| V4 | 能力数据含无出处的宿主行为 | 否 | 本单不改能力数据；`components.agents` 的取值与注释为 M2-01 写入，TA-09 通过 |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：确定性输出 | `components` 夹具在临时目录中构建，agents 文件逐字节比对；读取顺序按文件名排序 | 整树 10 个文件、stdout 与 stderr 与期望逐字节一致；`readAgents` 的结果按 `name` 排序（`alpha` 在 `zeta` 前） | `fixtures.test.ts` 的 `夹具 components`；`agents.test.ts`「得出名称、路径与 targets，按 name 排序」 | ✅ |
| 2 | 硬约束：不越权写入 | `components` 夹具与 `--check` 的单元测试：agents 只写入插件目录，`--check` 不写文件 | agents 只出现在 `dist/claude-code/agents/` 与 `dist/agy/agents/`；`--check` 列出 `dist/claude-code/agents/reviewer.md` 为 `added`，目录快照不变；合并布局的目录为源项目根目录时不复制 agents | `夹具 components`；`layout.test.ts` 的两个 agents 用例 | ✅ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-01-07` | 读取 agents | 读取 `agents/` 下一层的 `.md` 文件与 frontmatter，校验 `name`（与文件名去掉 `.md` 相同）与 `description`；支持 `targets` 筛选（SD-30） | ✅ | `agents.test.ts` 5 个用例：`agents/` 不存在为空、子目录与非 `.md` 文件忽略、不是目录时失败；缺 frontmatter、YAML 无效、`name` 或 `description` 空白、`name` 与文件名不同、`targets` 为空或含未知目标名时失败；与 skills 的问题一并返回；`build.test.ts` 中不承载 agents 的目标按 `targets` 跳过或失败 |
| `F-05-11` | 放置 agents | 适用的 agents 由构建编排原样写入产物 `agents/<name>.md`（SD-30） | ⚠️ 仅夹具，宿主加载待 M2-05 实测 | `components` 的 `dist/claude-code/agents/` 只有不写 `targets` 的 `reviewer.md`，内容与源文件逐字节一致；`build.test.ts`「共用插件目录中不适用于某目标的 agent 记为该目标的残余风险」 |
| `F-11-07` | 放置 agents | 适用的 agents 由构建编排原样写入产物 `agents/<name>.md`（SD-30） | ⚠️ 仅夹具，宿主加载待 M2-05 实测 | `components` 的 `dist/agy/agents/` 含 `agy-helper.md` 与 `reviewer.md`，与源文件逐字节一致；Codex 的报告中 `reviewer` 列为跳过 `agents/reviewer.md`，`agy-helper` 不适用于 Codex、不计 |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
pnpm check
node --test test/fixtures/fixtures.test.ts test/source/agents.test.ts test/build/build.test.ts test/targets/claude-code.test.ts test/targets/agy.test.ts test/targets/codex.test.ts
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `pnpm check` | ✅ 以 `test/container/run.sh check` 运行：两次 `tsc` 通过，Biome 检查无问题，234 pass / 0 fail，“✓ 93 个功能，18 条用户故事，20 项技术验收，关系检查通过” | 无 |
| `node --test test/fixtures/fixtures.test.ts test/source/agents.test.ts test/build/build.test.ts test/targets/claude-code.test.ts test/targets/agy.test.ts test/targets/codex.test.ts` | ✅ 54 pass / 0 fail（18 个夹具，含 `components`） | 以 `test/container/run.sh exec` 在容器中运行 |

## 4. 交付物

- 源项目：新增 `src/source/agents.ts`（`readAgents`）与 `src/source/frontmatter.ts`（从
  `skills.ts` 移出的 `readFrontmatter`、`readTargets`）；`SourceProject.agents`、`Agent` 类型；
  `readSource` 汇总 agents 的问题。
- 构建：`TargetPlan.agents`；`plan.ts` 的 `planComponents` 对 skills 与 agents 共用筛选规则；
  `outputs.ts` 复制 agents 并写共用目录的残余风险；`TargetState.sharedSkillRisks` 改名为
  `sharedRisks`，报告中的顺序不变（skill 在前，agent 在后）。
- 测试：`test/source/agents.test.ts`、`build.test.ts` 与 `layout.test.ts` 的 agents 用例、
  `test/fixtures/components/`（agents 部分）。
- 文档：模块接口 §5 补写“不承载 agents 的目标不写共用目录的风险”。

## 5. 与计划的偏差

- 施工单的验收命令列出 `test/targets/*.test.ts`：宿主模块不处理 agents（SD-30 由构建编排放置），
  这三个文件只为 `TargetPlan` 补 `agents: []`，没有新用例；放置的用例在 `build.test.ts` 与
  `layout.test.ts`。
- `components` 夹具的配置与说明已按 M2-04 的最终形态写好（说明含 MCP 服务器），`mcp/` 目录由
  M2-04 加入。

## 6. 技术决策

| 决策 | 依据 | 回填状态 |
|---|---|---|
| 不承载 agents 的目标（Codex）不写“agent 不适用于本目标但共用插件目录”的风险 | 宿主不加载 `agents/`，共用目录中的 agent 对它没有影响；未写 `targets` 的 agent 已列为跳过 | 已写入模块接口 §5 |
| skills 与 agents 共用一个筛选函数，跳过项与错误的写法由组件类型决定 | 两者的规则相同（F-03-02、SD-30），skills 的输出与 v0.1.0 逐字相同 | 无需改文档 |

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|
| 1 | `components` 产物未在宿主中加载：Claude Code 与 agy 是否列出两个 agent 只以 M2-01 的宿主事实为据 | F-05-11、F-11-07 为 ⚠️ | [M2-05](../workorders/M2-05-three-host-live-tests.md) 任务 1、3 的 v0.2.0 一项 |

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- agy 的插件根同时有 `agents.json` 与 `agents/*.md` 时加载哪些子代理未实测；UAPA 不生成
  `agents.json`，覆盖文件写入它时才会出现，见 M2-05 任务 3。
- 下一张：M2-04（MCP 服务器），在 `components` 夹具中加入 `mcp/servers.json`。
