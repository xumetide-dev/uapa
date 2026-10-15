# 验收 M2-02：执行后检查端到端

> 本文记录 M2-02 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M2-02](../workorders/M2-02-after-tool-end-to-end.md) |
| 覆盖功能点 | `F-02-04`、`F-04-08`、`F-05-13`、`F-06-07`（取自总览「工单构成」表） |
| 验收日期 | 2026-10-14 |
| 验收结论 | 有条件通过（`after-tool` 产物在 Claude Code 两种形态与 Codex 中的宿主实测由 M2-05 承接） |
| 判断范围 | 夹具与单元测试 |
| commit | `6c8d5c4`、`01e162f` |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | 执行前检查的收口未改：`subprocess.test.ts`、`in-process.test.ts` 的执行前拒绝用例与 v0.1.0 夹具的入口用例全部通过（`pnpm check` 223 pass）；hooks 模块合并处理函数后，`next` 之前出错仍返回 `{ deny }`（`.catch` 用例） |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | `fixtures.test.ts` 对 `after-tool` 产物的导入检查通过：三个子进程入口只导入 `node:` 内置模块，`hooks/uapa-guard.mjs` 只导入 `'claude-code'` |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | `after-tool` 整树比对：源项目目录只多出 `dist/claude-code/`、`dist/codex/`、`dist/agy/` 与 `dist/uapa-report.json` |
| V4 | 能力数据含无出处的宿主行为 | 否 | `failureDefault.afterTool` 的注释指向 `claude-code-local-tests.md`「执行后检查」与 `codex-source-review.md`「PostToolUse」，agy 注明宿主不能阻断或替换输出（SD-29）；TA-09（`capabilities.test.ts`）通过 |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：守卫不静默失效 | `after-tool` 夹具的入口用例：守卫抛错、返回值无效与输入无法解析时输出扣留；`requires` 含目标缺少的 `replaceOutput` 或 `withholdOutput` 时该目标失败（单元测试）；agy 的报告写明执行后检查被省略 | Claude Code 的 `guard-throws`、`invalid-result` 以 `updatedToolOutput` 把 `stdout` 换为原因，`missing-tool-response` 输出 `decision: "block"`；Codex 的三个同名用例都输出 `decision: "block"`，原因分别以 `uapa: 守卫出错`、`uapa: 守卫返回值无效`、`uapa: 无法解析宿主输入` 开头；两项能力列入 `requires` 而缺失时目标失败、不调用宿主模块；agy 的报告含“本目标缺少 withholdOutput，未生成执行后检查的 hook” | `fixtures.test.ts` 的 `夹具 after-tool`（14 个入口用例）；`checks.test.ts`「执行后检查：requires 含缺失的 withholdOutput 或 replaceOutput 时目标失败」；`expected/tree/dist/uapa-report.json` | ✅ |
| 2 | 硬约束：产物零依赖 | TA-01：`after-tool` 产物的子进程入口只导入 `node:` 内置模块，`hooks/uapa-guard.mjs` 只导入 `'claude-code'` | 四个产物入口与 `hooks/register.ts` 的导入检查通过 | `fixtures.test.ts` 的 `checkImports` | ✅ |
| 3 | 硬约束：不在运行时推断宿主 | 入口只读打包时内联的 `capabilities`；子进程协议单元测试断言能力数据与协议方法一致 | 公共部分按 `data.capabilities.withholdOutput` 决定是否调用守卫，按 `replaceOutput` 决定替换或扣留；Claude Code 的能力为两项都支持，入口输出 `updatedToolOutput`；Codex 只支持扣留，入口只输出 `decision: "block"`；agy 两项都不支持，`after-tool` 输出 `{}` 且不调用守卫 | `claude-code-subprocess.test.ts`、`codex-subprocess.test.ts`、`agy-subprocess.test.ts` 的执行后检查用例；`subprocess.test.ts`「withholdOutput 为 false 或守卫未实现 afterTool 时放行」 | ✅ |
| 4 | 硬约束：确定性输出 | `after-tool` 夹具在临时目录中构建，产物与报告逐字比对 | 整树 14 个文件（含复制的源文件与构建报告）、stdout 与 stderr 与期望逐字节一致 | `fixtures.test.ts` 的 `夹具 after-tool` | ✅ |
| 5 | 硬约束：能力数据有出处 | 各目标 `failureDefault.afterTool` 的注释指向 M2-01 的调研结论；TA-09 通过 | 四个能力数据模块的 `afterTool` 均为 `allow`，注释指向上述调研小节；TA-09 通过 | `src/capabilities/*.ts`；`capabilities.test.ts` | ✅ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-02-04` | 执行后检查接口 | `GuardPlugin` 增加 `afterTool`，包入口导出 `AfterTool`；`GuardCheck` 增加 `'afterTool'`；F-02-03 不再拒绝 `afterTool` 与 `replaceOutput`、`withholdOutput`，这两项能力参与构建时能力检查 | ✅ | `types.test.ts`「afterTool 接收调用与输出文本，返回 AfterTool」与 `@ts-expect-error` 用例（tsc 通过）；`guard.test.ts`「afterTool 与执行后能力参与读取」；`checks.test.ts` 的四个执行后检查用例 |
| `F-04-08` | 执行后检查的异常收口 | 执行后检查的输入无法解析、守卫出错或返回值无效时按扣留输出，以说明文字替换原输出（SD-29） | ✅ | `subprocess.test.ts`「守卫抛错、返回值无效与输入无法解析时扣留」：可替换形状以原因替换，其余与无法解析时调用 `blockOutput`；`in-process.test.ts` 中抛错与无效返回值返回 `{ deny }`，`.catch` 在 `next` 之后返回 `{ deny }`；`after-tool` 的 `guard-throws`、`invalid-result`、`missing-tool-response` 入口用例 |
| `F-05-13` | 执行后检查的决策输出 | 命令 hooks 以 `updatedToolOutput` 替换与扣留可替换形状的输出，其他形状以 `decision: "block"` 附加原因并记为残余风险；hooks 模块在 `next` 之后返回 `{ result }` 替换，扣留与不可替换形状的替换返回 `{ deny }`（SD-29） | ⚠️ 仅入口与夹具，宿主中的效果待 M2-05 实测 | `after-tool` 的 `replace-bash`（只改 `stdout` 并清空 `stderr`）、`withhold-read`（只改 `file.content`）、`replace-other-shape`（`decision: "block"`）；报告中两种形态各一条执行后检查的残余风险；`in-process.test.ts` 的 TA-19 用例以桩加载产物中的 `hooks/uapa-guard.mjs`：替换返回 `{ ...ran, result }`，扣留、报错的结果与不可替换形状返回 `{ deny }`，`next` 的结果含 `deny` 时原样返回 |
| `F-06-07` | 执行后检查的决策输出 | 扣留以 `PostToolUse` 返回 `decision: "block"` 与非空 `reason` 输出；`replace` 按扣留写出并在构建报告中记为降级；声明需要 `replaceOutput` 时构建失败（SD-29） | ⚠️ 仅入口与夹具，宿主中的效果待 M2-05 实测 | `after-tool` 的 Codex 入口用例 `replace`、`withhold` 都输出 `decision: "block"` 与非空 `reason`；报告的 `degraded` 为 `{ decision: 'replace', as: 'withhold' }`；`checks.test.ts` 中 `requires` 含缺失的 `replaceOutput` 时目标失败（以合成的能力数据，规则对各目标相同） |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
pnpm check
node --test test/fixtures/fixtures.test.ts test/runtime/decisions.test.ts test/runtime/subprocess.test.ts test/runtime/in-process.test.ts test/runtime/claude-code-subprocess.test.ts test/runtime/codex-subprocess.test.ts test/build/checks.test.ts test/source/guard.test.ts
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `pnpm check` | ✅ 以 `test/container/run.sh check` 运行：两次 `tsc` 通过，Biome 检查 169 个文件无问题，223 pass / 0 fail，“✓ 93 个功能，18 条用户故事，20 项技术验收，关系检查通过” | 无 |
| `node --test test/fixtures/fixtures.test.ts test/runtime/decisions.test.ts test/runtime/subprocess.test.ts test/runtime/in-process.test.ts test/runtime/claude-code-subprocess.test.ts test/runtime/codex-subprocess.test.ts test/build/checks.test.ts test/source/guard.test.ts` | ✅ 83 pass / 0 fail（17 个夹具，含 `after-tool` 的 14 个入口用例） | 以 `test/container/run.sh exec` 在容器中运行 |

## 4. 交付物

- 公共类型与守卫读取：`src/runtime/core/types.ts`（`AfterTool`、`GuardPlugin.afterTool`、
  `GuardCheck` 的 `afterTool`）、`src/index.ts`、`src/source/guard.ts`。
- 运行时：`src/runtime/core/decisions.ts` 的 `checkAfterTool`，新增 `src/runtime/core/output.ts`
  （`outputText`、`replacedOutput`）；`src/runtime/entries/subprocess.ts` 的 `after-tool`、
  `replaceOutput`、`blockOutput`；Claude Code 与 Codex 的子进程入口；
  `claude-code-in-process.ts` 合并后的 `tool.call` 处理函数与 `.catch`；`claude-code-api.d.ts`。
- 构建：`src/build/plan.ts`（`afterTool` 以 `withholdOutput` 为生成条件、`replace` 的降级）、
  `state.ts`、`report.ts`；四个能力数据模块的 `failureDefault.afterTool`；三个宿主的 `hooks.ts`；
  Claude Code 与 Codex 宿主模块的执行后检查残余风险。
- 测试：`test/fixtures/after-tool/`（四个目标，14 个入口用例）、`test/runtime/output.test.ts`，
  以及 `checks`、`guard`、`types`、`decisions`、`subprocess`、三个宿主协议与 `in-process`
  测试中的新用例。
- 文档：`runtime-interfaces.md` 第 4 节补两处写法（见 §6）。

## 5. 与计划的偏差

- v0.1.0 夹具中 10 个夹具的 23 个打包生成的 `.mjs` 随入口代码变化；manifest、hooks 配置、
  构建报告与入口用例的期望不变（`git diff --name-only` 中这些夹具只有 `.mjs`），符合红线。
- 新增 `test/runtime/output.test.ts`：施工单「验收」的命令未列出它，它在 `pnpm check` 中运行。
- TA-19 要求 hooks 模块以桩加载夹具产物，该用例在实现提交之后单独提交（`01e162f`）。
- 测试守卫 `test/runtime/guards/scripted.ts` 增加 `afterTool`；`subprocess.test.ts` 中无效检查名的
  用例由 `after-tool` 改为 `after-stop`，错误信息按新的检查名列表断言。

## 6. 技术决策

| 决策 | 依据 | 回填状态 |
|---|---|---|
| hooks 模块的执行后检查按交给 `next` 的事件换算调用，改写后为新命令 | 与命令 hooks 中 `PostToolUse` 的 `tool_input` 一致 | 已写入入口与打包接口第 4 节 |
| hooks 模块入参无法换算时不调用 `next`，只计划执行后检查时同样返回 `{ deny }` | 没有可交给守卫的调用，按扣留方向收口 | 已写入入口与打包接口第 4 节 |
| `outputText` 对没有 JSON 文本的值（`undefined`）返回空串 | `JSON.stringify(undefined)` 不是字符串；子进程的 stdin 中不会出现 | 已写入入口与打包接口第 4 节的形状表 |
| hooks 模块的替换同样以 `capabilities.replaceOutput` 为条件 | 入口只读内联的能力数据（硬约束「不在运行时推断宿主」） | 实现与能力数据一致，无需改文档 |

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|
| 1 | `after-tool` 产物未在宿主中加载：Claude Code 两种形态的替换与扣留、Codex 的 `decision: "block"` 只以入口用例与 M2-01 的宿主事实为据 | F-05-13、F-06-07 为 ⚠️ | [M2-05](../workorders/M2-05-three-host-live-tests.md) 任务 1、2 的 v0.2.0 一项 |

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- 宿主限制已写入构建报告：Claude Code 命令 hooks 对 Bash、Read 以外的形状只能附加原因，模型仍读到
  原输出，工具报错时不检查；Codex 只检查执行成功的调用。宿主版本升级后按 M2-05 的实测更新能力数据
  与残余风险。
- 下一张：M2-03（agents）。
