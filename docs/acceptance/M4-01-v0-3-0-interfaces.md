# 验收 M4-01：v0.3.0 接口定稿

> 本文记录 M4-01 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M4-01](../workorders/M4-01-v0-3-0-interfaces.md) |
| 覆盖功能点 | 无（接口文档；功能由 M4-02～M4-04 实现）（取自总览「工单构成」表） |
| 验收日期 | 2026-10-15 |
| 验收结论 | 通过 |
| 判断范围 | 不涉及宿主行为判断 |
| commit | `25bf526` |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | 本单只改文档；入口与打包接口第 3 节把守卫选项无效列入执行前检查调用 `deny` 的情况；`node --test` 247 pass |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | 不改代码与夹具；TA-01 的夹具测试通过 |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | 不改构建编排；TA-07、TA-08 的测试通过 |
| V4 | 能力数据含无出处的宿主行为 | 否 | 不改能力数据；接口文档的宿主格式只引用 SD-32～SD-35 与三个调研小节 |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 模块接口 | §3 的 `Rule`、`Command`、`SourceProject` 新字段与 `GuardDeclaration.options`；§4 的 `components`；§5 的 `TargetPlan` 新字段、commands 与 rules 的放置、F-03-07 不再预留 | §3 增加 `RuleActivation`、`Rule`、`Command`、`SourceProject.rules` 与 `.commands`、`GuardDeclaration.options`，以及 rules、commands 与守卫选项的读取要点；§4 的 `components` 键增加 `rules`、`commands`；§5 增加 `TargetPlan.rules` 与 `.commands`、commands 与 rules 的放置两条，`merge` 的注释与合并规则改为 v0.3.0 | [模块接口](../architecture/module-interfaces.md) | ✅ |
| 2 | 入口与打包接口 | 第 1 节 `TargetRuntimeData.options`；第 2 节 `register(on, options)`；第 3 节 `optionValue`、取值规则、无效取值的原因与收口、`options.ts` 的函数签名 | 第 1 节增加 `options` 与 `RuntimeOption`；第 2 节增加守卫选项一条（`(on, options) => guard(on, options)`，无效时同守卫抛错）；第 3 节增加 `optionValue`、`GuardOptionValue`、`OptionsResult`、`optionsFromText`、`optionsFromValues`，文本解析规则与三类检查的收口，Claude Code 的变量名 | [入口与打包接口](../architecture/runtime-interfaces.md#3-子进程入口) | ✅ |
| 3 | 构建报告 | `skipped` 与 `residualRisks` 加入 rules、commands 与守卫选项的条目 | `component` 示例加 `rules/style.md`；`skipped` 顺序为 skills、agents、rules、commands、MCP 服务器、命令 hooks 声明；`residualRisks` 第（4）类加 command，宿主模块条目加 F-06-09、F-11-09、F-06-10、F-11-10 | [构建报告](../architecture/build-report.md) | ✅ |
| 4 | hooks 适配与包入口 | 第 2 节的 `GuardOption`、`GuardContext` 与检查方法的参数 | 第 2 节增加 `GuardOption`、`GuardContext`、`GuardPlugin.options`，四个检查方法的最后一个参数为 `ctx`，并说明取值来源；第 5 节的 `register.ts` 写法改为传入 `options` | [hooks 适配](../research/coding-agent-plugin-manifests/uapa-hook-adapters.md#2-公共类型) | ✅ |
| 5 | 架构与设计提案 | 架构 §1 按 v0.3.0 改写；设计提案第 4、6、10 节更新 | 架构 §0 的产物布局、§1 第 2、5 步、`build` 与 `runtime/core` 的职责已改；设计提案第 4 节两行改为 v0.3.0，第 6 节组件表加 agy 列、Codex 的 commands 为“包内（安装时转换为技能）”，第 10 节守卫配置改为由 SD-35 落实 | [架构](../architecture/architecture.md#1-组成与模块)；[设计提案](../research/coding-agent-plugin-manifests/unified-agent-plugin-architecture.md#6-组件与目标) | ✅ |

## 2. 功能点逐条验收

本单在总览「工单构成」表中不挂功能点，本节没有条目；交付以 §1 与 §3 判定。

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
node scripts/check-feature-list.mjs
```

```bash
test/container/run.sh check
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `node scripts/check-feature-list.mjs` | `✓ 105 个功能，21 条用户故事，24 项技术验收，关系检查通过` | 无 |
| `test/container/run.sh check` | 两套 `tsc` 通过，Biome 检查 182 个文件无问题，`node --test` 247 pass / 0 fail，功能清单检查通过 | Docker |
| `check_links.py .`、`check_width.py 100` | 链接：11 处失败均为技能模板中的占位链接，与本单无关；行宽：超出的 2 行为原有的长句（只改前缀）与链接 | 无 |

## 4. 交付物

- 接口文档：`module-interfaces.md`（§3、§4、§5）、`runtime-interfaces.md`（第 1～3 节）、
  `build-report.md`、`architecture.md`（§0、§1）。
- 调研文档：`uapa-hook-adapters.md`（第 2、5 节）、`unified-agent-plugin-architecture.md`（第 4、
  6、10 节）。

## 5. 与计划的偏差

- hooks 适配第 5 节的 `register.ts` 写法随第 2 节一并更新：施工单只列了第 2 节，第 5 节写着
  `on => guard(on)`，不改会与入口与打包接口第 2 节矛盾。
- 设计提案第 6 节的“rules 换算”一条加入 agy 的 `trigger` 与 `globs`。

## 6. 技术决策

| 决策 | 依据 | 回填状态 |
|---|---|---|
| `GuardDeclaration.options` 与 `TargetRuntimeData.options` 为按名称排序的数组，不用对象 | 打包内联的常量与构建结果的顺序由数组顺序决定，满足确定性输出 | 已写入模块接口 §3、入口与打包接口第 1 节 |
| 选项取值的解析分为 `optionsFromText`（子进程）与 `optionsFromValues`（hooks 模块）两个纯函数 | 子进程收到文本，hooks 模块收到带类型的值（Claude Code 本地实测）；类型检查不做 I/O，放在 `runtime/core` | 已写入入口与打包接口第 3 节 |
| number 的文本要求去掉首尾空白后非空且 `Number(文本)` 为有限数 | `Number('')` 为 0，空文本不能当作 0 | 已写入入口与打包接口第 3 节 |
| `ctx` 为检查方法的最后一个参数，v0.2.0 的守卫逻辑不需修改 | 只增加参数，原有签名仍满足类型 | 已写入 hooks 适配第 2 节 |

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|

本单没有限制与技术债；`register(on, options)` 能否通过 `validate --strict` 由 M4-04 的关键落地
约束验证。

## 8. 风险与下一步

- M4-04 若发现 `validate --strict` 不接受 `register.ts` 把 `options` 传给守卫文件，按施工单回退
  为取默认值，并同步修订入口与打包接口第 2 节与 hooks 适配第 5 节。
- 下一步：M4-02（rules 与 commands）。
