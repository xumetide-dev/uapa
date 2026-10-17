# 验收 M5-03：rules 与 commands 的换算承载

> 本文记录 M5-03 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M5-03](../workorders/M5-03-converted-rules-and-commands.md) |
| 覆盖功能点 | `F-03-19`、`F-05-19`、`F-06-11`、`F-06-13`、`F-11-11`（取自总览「工单构成」表） |
| 验收日期 | 2026-10-15 |
| 验收结论 | 通过 |
| 判断范围 | 夹具与单元测试 + 宿主实测 |
| commit | `15afb6e`、`92264a1` |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | 本单未改 `src/runtime/` 与 `src/bundle/`；守卫条目的写法不变，`rules-commands` 以外 20 个夹具的期望产物未改动且逐字节通过（`fixtures.test.ts` 21 pass） |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | 规则输出脚本只有一行 `process.stdout.write(<字面量>)`，没有导入；`fixtures.test.ts` 的导入检查覆盖产物中全部 `.mjs`，含两个规则脚本 |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | `rules-commands` 比对运行后的整个源项目目录，新增文件只在 `dist/claude-code/`、`dist/codex/`、`dist/agy/` 中；本单未改写出与 `--check` 的代码 |
| V4 | 能力数据含无出处的宿主行为 | 否 | 四处取值的注释各指向调研记录，见 §1 第 5 行 |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：产物零依赖 | 规则入口的导入检查（与 TA-01 相同的测试）；`rules-commands` 的入口用例以 `process.execPath` 运行，环境为空 | 导入检查对两个规则脚本通过（没有导入）；入口用例 `claude-code-subprocess/always-rules.json` 与 `codex-subprocess/always-rules.json` 以空 stdin、空环境运行，退出码 0，stdout 为 `回复使用中文，代码标识符保持英文。\n`，stderr 为空 | `test/fixtures/fixtures.test.ts`「夹具 rules-commands」；入口用例新增可选的 `entry` 字段（`test/fixtures/run.ts`） | ✅ |
| 2 | 硬约束：不在运行时推断宿主 | 规则入口不读取宿主环境变量，输出在打包时确定；入口用例在空环境中得到同样的输出 | 脚本内容为构建时写入的字符串字面量，不读取 `process.env`；空环境下的输出与期望逐字一致 | `rule-conversion.test.ts`「always 规则的文本」；同上的入口用例 | ✅ |
| 3 | 硬约束：确定性输出 | `rules-commands` 夹具逐字节比对；规则按名称排序 | 夹具通过；Claude Code 取各目标规则的并集按名称排序，Codex 取 `TargetPlan.rules`（读取时已按名称排序）；`always` 规则按传入顺序合并 | `fixtures.test.ts`；`rule-conversion.test.ts` 的五个用例 | ✅ |
| 4 | 硬约束：不越权写入 | 夹具比对运行后的整个源项目目录 | 期望树相对 M4-02 只多出 `dist/claude-code/hooks/`、`dist/claude-code/skills/typescript/`、`dist/codex/hooks/`、`dist/codex/skills/typescript/`、`dist/agy/commands/review.md`；源项目的 `rules/`、`commands/` 与源文件相同 | `test/fixtures/rules-commands/expected/tree/` | ✅ |
| 5 | 硬约束：能力数据有出处 | 四个能力数据模块中 `converted` 的取值各带出处注释（TA-25 小节、Codex 源码） | Claude Code 两个模块的 `rules: 'converted'` 指向 claude-code-local-tests.md「v0.4.0 覆盖审查（2.1.296，容器）」；Codex 的 `rules: 'converted'` 指向 rust-v0.162.1 `hooks/src/events/session_start.rs` 与 codex-source-review.md，注明会话中的效果未实测；agy 的 `commands: 'package'` 指向 agy-local-tests.md「v0.4.0 覆盖审查（1.3.5，容器）」与 SD-39 | `src/capabilities/*.ts` | ✅ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-03-19` | 换算承载的组件 | `Carrier` 增加 `converted`：组件由宿主模块按 `TargetPlan` 换成宿主承载的其他组件；构建编排按 F-03-02 筛选后放进 `TargetPlan`，不为该目标原样复制；同一插件目录中另有目标原样承载该组件时，原样复制照常进行（SD-38） | ✅ | `components.test.ts`「换算承载（converted）的组件交给宿主模块，构建编排不原样复制」：只有 `converted` 的目标时不复制，同目录另有 `package` 的目标时照常复制；`componentUnion` 只并入 `package` 的目标 |
| `F-05-19` | rules 的换算承载 | 两个目标的 `components.rules` 为 `converted`；`model` 与 `glob` 规则写为 `skills/<name>/SKILL.md`，frontmatter 依次写 `name`、`description`（有值时）、`paths`（`glob` 时，YAML 列表，模式原样）与 `user-invocable: false`，正文为 `Rule.body`；`always` 规则按名称顺序由 `SessionStart` 命令 hook 输出正文，入口文件与命令按入口与打包接口，条目排在守卫条目之后、声明的命令 hooks 之前；与源项目 skill 同名时生成失败；`always` 规则的输出超过 10,000 字符时残余风险写明超出部分不进入上下文；只有 `claude-code:in-process` 进入 `plans` 时残余风险写明规则输出需要 Node（SD-38） | ✅ | `rule-conversion.test.ts`：frontmatter 的三种写法（有无 `description`、有无 `paths`）逐字核对；`SessionStart` 中规则条目排在声明的命令之前、守卫条目之后；超过 10,000 字符与只有 `claude-code:in-process` 时的残余风险逐字核对；`components.test.ts`「rules 换算的技能与源项目 skill 同名时写入该目录的全部目标失败」；`rules-commands` 夹具；三种换算规则的产物通过 `claude plugin validate --strict`（宿主实测，Claude Code 2.1.296，见 M5-07） |
| `F-06-11` | rules 的换算承载 | `components.rules` 为 `converted`；`model` 规则与有 `description` 的 `glob` 规则写为 `skills/<name>/SKILL.md`，内容与 F-05-19 相同，共用插件目录时逐字一致；没有 `description` 的 `glob` 规则列为跳过，原因写明 Codex 的技能须有 `description`；有 `glob` 规则写为技能时残余风险写明 Codex 不按 `paths` 加载，由模型按描述决定；`always` 规则由 `SessionStart` 命令 hook 输出正文，残余风险写明 Codex 须先信任插件的 hooks；与源项目 skill 同名时生成失败（SD-38） | ✅ | `rule-conversion.test.ts`「Codex：规则技能与 Claude Code 逐字一致；没有 description 的 glob 规则跳过」：技能文件与 Claude Code 逐字相同，跳过原因逐字核对，`paths` 与信任两条残余风险；同名失败用例以 `codex:subprocess` 运行；夹具中两个宿主的 `skills/typescript/SKILL.md` 相同 |
| `F-06-13` | 逐个检查 commands 的转换 | 按 rust-v0.162.1 `core-plugins/src/command_migration.rs` 的条件逐个检查 `TargetPlan.commands`：正文含模板写法、转换结果超过 4000 字节、名称超过 64 字符等会被 Codex 跳过的命令列为跳过（`component` 为 `commands/<name>.md`，原因写明条件）；代替 F-06-09 中笼统的残余风险（SD-43） | ✅ | `codex-commands.test.ts`：六种模板写法、`README`、65 个字符的技能名、`a-b` 与 `a_b` 重名、4185 字节的转换结果各列为跳过并写明原因，49 个字符的名称与普通命令不跳过；不再写笼统的残余风险，`rules-commands` 的报告中该风险已删去 |
| `F-11-11` | commands 的承载 | `components.commands` 为 `package`：构建编排把 `commands/<name>.md` 原样复制到插件目录，agy 安装时把命令转换为技能，以 `/<插件名>:<命令名>` 调用，`$ARGUMENTS` 替换为参数文本（TA-25，1.3.5），命令不再列为跳过；能力数据的注释指向调研文档；有命令时残余风险写明转换后的技能也会被模型按 `description` 自动选用（SD-39） | ✅ | `components.test.ts`「agy 原样复制 commands，不列为跳过，写模型自动选用的残余风险」；`rules-commands` 的 `dist/agy/commands/review.md` 与源文件相同，报告中 agy 的 `skipped` 为空；能力数据注释见 §1 第 5 行；`agy plugin install` 与 `/rules-commands:review` 会话调用生效（宿主实测，agy 1.3.5，见 M5-07） |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
test/container/run.sh check
```

```bash
test/container/run.sh exec node --test test/fixtures/fixtures.test.ts
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `test/container/run.sh check` | ✅ tsc 与 biome 通过（219 个文件，无警告）；321 pass / 0 fail；功能清单关系检查通过 | Docker 可用 |
| `test/container/run.sh exec node --test test/fixtures/fixtures.test.ts` | ✅ 21 pass / 0 fail，含 `夹具 rules-commands` 与它的两个入口用例 | Docker 可用 |

## 4. 交付物

- 能力数据与放置：`Carrier` 增加 `converted`；Claude Code 与 Codex 的 `rules` 为 `converted`，
  agy 的 `commands` 为 `package`；`componentUnion` 只复制 `package` 的组件。
- 源项目：`Command` 增加 `description` 与 `body`。
- 共用生成函数：`src/targets/rule-skills.ts`（规则技能文件、`always` 规则的文本与输出脚本、
  同一宿主两个目标共用目录时的残余风险）。
- Claude Code：`src/targets/claude-code/rules.ts`，`hooks.ts` 写入规则条目。
- Codex：`src/targets/codex/rules.ts`、`commands.ts`（转换检查），残余风险拆到 `risks.ts`，
  `hooks.ts` 写入规则条目。
- agy：命令的残余风险。
- 测试：`test/targets/rule-conversion.test.ts`，`codex-commands.test.ts` 重写，
  `components.test.ts` 与 `commands.test.ts` 的新用例；夹具 `rules-commands` 的期望产物与两个
  入口用例，入口用例的 `entry` 字段。
- 文档：`docs/guide/targets.md` 与 `source-project.md` 的承载方式与限制；接口文档中的
  `Command`、共用生成函数的位置与规则文本的写法；夹具表。

## 5. 与计划的偏差

- 夹具的入口用例只能运行守卫入口：增加可选的 `entry` 字段（相对插件目录），同步夹具说明与功能
  清单的夹具格式。
- 规则文本去掉 `Rule.body` 首尾的换行，入口与打包接口原写“去掉结尾换行”：`Rule.body` 以
  frontmatter 之后的空行开头，只去结尾会让输出以空行开头。接口文档已改。
- `rules-commands` 的 Codex 报告多出两条既有的 hooks 残余风险（信任与公开目录），因为 `always`
  规则使该目标有了 hooks；信任风险以“守卫不生效”结尾，对没有守卫的插件不准确，排入 M5-05。
- 帮助文档 `source-project.md` 中“rule 写 `targets: [claude-code:subprocess]` 时失败”的示例
  已不成立，改为只举 agent 的例子。
- 核对 M5-07 时发现 `rules-commands` 的 `model` 规则只限 agy，已在 M5-07 写明实测时的处理；
  `README.md` 的宿主矩阵描述已发布的 v0.3.0，在 M5-00 的发布说明中写明发布时更新。
- 夹具表要求 `host-coverage` 含一个正文含 `$ARGUMENTS` 的命令（F-06-13），本单未加，由 M5-04
  补入（见 M5-04 验收 §5）。

## 6. 技术决策

| 决策 | 依据 | 回填状态 |
|---|---|---|
| 两个宿主共用的生成函数放在 `src/targets/rule-skills.ts`，宿主模块可导入，它不导入宿主模块 | 施工单要求共用且不跨宿主导入，位置以接口定稿为准，M5-01 未定 | 已写入宿主模块接口与架构文档 |
| 规则技能的 frontmatter 以 yaml 写出、不折行，`*` 开头的模式加引号 | 与 skill 的 frontmatter 一样由 yaml 解析，模式原样保留 | 实现即文档 |
| 只配置 `claude-code:in-process` 时也写规则条目，并写需要 Node 的残余风险 | hooks 模块没有会话开始事件，规则只能经命令 hook 输出 | 功能清单 F-05-19 已写明 |
| Codex 的命令检查顺序为 README、技能名长度、模板写法、重名、字节数；重名只在通过前三项的命令之间判断；跳过项按路径排序 | 与 rust-v0.162.1 `command_migration.rs` 的处理顺序一致 | 实现即文档 |

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|
| 1 | 合并布局中，Claude Code 与 Codex 换算出的规则技能也被共用目录的其他宿主当作技能加载，构建报告不记录 | agy 以规则与技能各加载一次；只限部分目标的规则进入其他宿主 | 帮助文档 `source-project.md` 已写明，规则只限部分目标时改用默认布局（本单） |
| 2 | Codex 中规则技能与 `always` 规则的会话效果未实测 | 能力数据注释标明未实测 | [M5-07](../workorders/M5-07-v0-4-0-live-tests.md) 第 3 节，须维护者确认 |
| 3 | UAPA 产物中的规则技能、规则条目与 agy 的命令未在宿主中复测 | 宿主行为已在 M5-01 的容器审查中确认，产物本身未安装运行 | [M5-07](../workorders/M5-07-v0-4-0-live-tests.md) 第 1、2 节（agy `rules-commands` 命令调用与 Claude Code 三种规则 `validate --strict` 已于 2026-10-17 实测通过；Claude Code 会话复测待订阅就绪后补测） |
| 4 | Codex 信任风险的“守卫不生效”对没有守卫的插件不准确 | 只影响报告文字 | [M5-05](../workorders/M5-05-guard-reliability-and-risks.md) 第 2 节 |

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- Codex 的命令转换条件照搬 rust-v0.162.1，Codex 升级后条件可能变化，需随能力数据的核对日期
  一起复核。
- 下一步：M5-04 MCP 服务器的环境变量。
