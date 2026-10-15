# 验收 M4-02：rules 与 commands

> 本文记录 M4-02 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M4-02](../workorders/M4-02-rules-and-commands.md) |
| 覆盖功能点 | `F-01-10`、`F-01-11`、`F-03-16`、`F-05-16`、`F-06-09`、`F-11-09`（取自总览「工单构成」表） |
| 验收日期 | 2026-10-15 |
| 验收结论 | 有条件通过（产物在 agy 与 Claude Code 会话中的效果由 M4-05 实测） |
| 判断范围 | 夹具与单元测试 |
| commit | `ee66f81`、`04328f0` |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | 不改守卫、入口与打包；TA-03 的入口用例与 18 个原有夹具的入口用例通过 |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | rules 与 commands 为 Markdown 文件，没有入口；TA-01 的导入检查覆盖 19 个夹具 |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | `rules-commands` 夹具比对运行后的整个源项目目录，`rules/`、`commands/` 之外的新文件只在 `dist/` 中；`components.test.ts` 的读取失败用例不生成 `dist/` |
| V4 | 能力数据含无出处的宿主行为 | 否 | 四个数据模块的 `components.rules`、`components.commands` 注释分别指向 Claude Code 本地实测「commands 与 userConfig」、`claude-code-plugins.md`、Codex 源码核对「commands、rules 与用户配置」、agy「rules（1.3.5，容器）」与 [A1] |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：确定性输出 | `rules-commands` 夹具逐字节比对；rules 按名称排序生成，frontmatter 只含源项目的取值 | 夹具通过；`readRules`、`readCommands` 按名称排序；agy 的 frontmatter 只有 `trigger`、`description`、`globs`，取值来自 `Rule` | `test/fixtures/fixtures.test.ts`「夹具 rules-commands」；`test/source/rules.test.ts`「得出三种 activation 的字段，按 name 排序…」 | ✅ |
| 2 | 硬约束：不越权写入 | `rules-commands` 夹具比对运行后的整个源项目目录：commands 与 rules 只出现在插件目录 | 期望树中源项目的 `rules/`、`commands/` 与源文件相同，生成与复制的文件只在 `dist/claude-code/commands/`、`dist/codex/commands/`、`dist/agy/rules/` | `test/fixtures/rules-commands/expected/tree/` | ✅ |
| 3 | 硬约束：能力数据有出处 | 四个能力数据模块的 `components.rules`、`components.commands` 各带出处注释；TA-09 的测试照常通过 | 四个模块各有两项与出处注释（见 V4）；`host.checked` 未改，以免改动全部夹具的构建报告，日期写在注释中；TA-09 的 4 个测试通过 | `src/capabilities/*-*.ts`；`test/capabilities/capabilities.test.ts` | ✅ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-01-10` | 读取 rules | 读取 `rules/` 下一层的 `<name>.md`，其他项忽略；`<name>` 只含字母、数字、`_`、`-`；frontmatter 必须存在且只含 `activation`、`description`、`globs`、`targets`：`activation` 为 `always`、`model` 或 `glob`；`description` 出现时为非空单行字符串，`activation` 为 `model` 时必填；`activation` 为 `glob` 时 `globs` 为非空字符串数组，元素非空、不含 `,` 与换行，其他取值时不得出现 `globs`；`targets` 的规则同 F-01-05；`Rule.body` 为 frontmatter 之后的原文；违反时返回 `InputIssue`，`field` 写到 frontmatter 字段，如 `activation`（模块接口 §3，SD-32） | ✅ | `test/source/rules.test.ts` 4 个测试：目录不存在、非目录与忽略项；三种 activation 的字段与排序；CRLF 与空正文原样保留；14 种无效输入的 `file`、`field` 与原因（含未知键、`globs` 元素含 `,`、文件名含空格） |
| `F-01-11` | 读取 commands | 读取 `commands/` 下一层的 `<name>.md`，其他项忽略；`<name>` 只含字母、数字、`_`、`-`；frontmatter 的 `description` 为非空字符串，`targets` 的规则同 F-01-05，其他键不校验、原样保留；缺少 frontmatter 或 `description` 时返回 `InputIssue`（模块接口 §3，SD-33） | ✅ | `test/source/commands.test.ts` 3 个测试：忽略项；`argument-hint`、`model` 等键不校验，按名称排序；缺 frontmatter、缺或空 `description`、未知目标名、文件名含 `.` |
| `F-03-16` | 检查 rules 与 commands 的承载 | `TargetCapabilities.components` 增加 `rules` 与 `commands`，缺少时 `tsc` 报错；`TargetPlan` 增加 `rules` 与 `commands`，按 F-03-02 筛选：目标不承载时，未在 frontmatter 写明该目标的条目写入其报告的 `skipped`（`component` 为 `rules/<name>.md`、`commands/<name>.md`），写明时该目标失败；commands 由构建编排按插件目录原样复制为 `commands/<name>.md`，并集与残余风险同 agents（模块接口 §5，SD-33）；rules 由宿主模块按 `TargetPlan.rules` 生成（SD-32） | ✅ | `tsc` 通过（`Component` 含 `rules`、`commands`，四个数据模块缺项时报错）；`test/build/components.test.ts` 7 个测试：commands 原样复制、`commands: 'none'` 与 `rules: 'none'` 时跳过或失败、rules 交给宿主模块且不复制、跳过项顺序、共用目录中 command 的残余风险、读取失败不写文件 |
| `F-05-16` | 放置 commands | 两个目标的能力数据 `components.commands` 为 `package`、`components.rules` 为 `none`（插件根的 `CLAUDE.md` 不作为上下文加载，插件没有规则组件）；适用的 commands 由构建编排原样写入产物 `commands/<name>.md`，frontmatter 中的 `targets` 不影响加载（[本地实测「commands 与 userConfig」](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#commands-与-userconfig)，SD-33） | ✅ | `rules-commands` 夹具：`dist/claude-code/commands/` 含 `claude-only.md` 与 `review.md`，与源文件逐字节一致；两个目标的 `skipped` 为两条 `rules/…`；`claude-code:in-process` 的残余风险为 `command claude-only 不适用于本目标…`。宿主加载由 M4-05 实测 |
| `F-06-09` | commands 与 rules 的承载 | 能力数据的 `components.commands` 为 `package`（兼容格式的插件在安装时把 `commands/*.md` 转换为技能），`components.rules` 为 `none`，依据 [Codex hooks 源码核对记录「commands、rules 与用户配置」](../research/coding-agent-plugin-manifests/codex-source-review.md#commandsrules-与用户配置)（rust-v0.162.1）；适用的 commands 由构建编排原样写入产物 `commands/<name>.md`；`TargetPlan.commands` 非空时残余风险写明“Codex 安装时把 commands 转换为技能，正文含 `$ARGUMENTS` 等模板写法或转换结果超过 4000 字节的命令被跳过，UAPA 不检查”（SD-33） | ✅ | `rules-commands` 夹具：`dist/codex/commands/review.md` 与源文件一致，`skipped` 为两条 `rules/…`，残余风险为该条原文；`test/targets/codex-commands.test.ts` 2 个测试（有与没有 commands） |
| `F-11-09` | 生成 rules | 能力数据的 `components.rules` 为 `package`，`components.commands` 为 `none`（文档写明插件没有斜杠命令组件）；按 `TargetPlan.rules` 生成 `rules/<name>.md`：frontmatter 依次写 `trigger`（`always` → `always_on`，`model` → `model_decision`，`glob` → `glob`）、`description`（有值时）与 `globs`（`glob` 时为以 `,` 连接的一个字符串），正文为 `Rule.body` 原文；生成的文件超过 24,000 字节时残余风险写明超出部分被宿主截断；依据 [agy「rules（1.3.5，容器）」](../research/coding-agent-plugin-manifests/agy-plugins.md#rules135容器)（SD-32） | ✅ | `rules-commands` 夹具：`dist/agy/rules/` 三个文件的 frontmatter 为 `always_on`、`model_decision`（带 `description`）、`glob`（`globs: "*.ts,src/**/*.tsx"`；`04328f0` 之后为 `"*.ts,**/src/**/*.tsx"`，报告含前缀风险），正文与源文件一致；`skipped` 为 `commands/review.md`；`test/targets/agy-rules.test.ts` 4 个测试（换算、YAML 不折行、超过 24,000 字节的风险、没有 rules），`04328f0` 之后 6 个（增加模式换算与不需换算时不写风险） |

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
| `test/container/run.sh check` | 两套 `tsc` 通过，Biome 检查 193 个文件无问题，`node --test` 268 pass / 0 fail，功能清单检查通过 | Docker |
| `test/container/run.sh exec node --test test/fixtures/fixtures.test.ts` | 19 pass / 0 fail（18 个原有夹具的期望产物未改，加 `rules-commands`） | Docker |
| `check_links.py .`、`check_width.py 100` | 链接：11 处失败均为技能模板中的占位链接；行宽：无超出 | 无 |

## 4. 交付物

- 源项目：`src/source/rules.ts`、`src/source/commands.ts`（新增）；`frontmatter.ts` 的
  `readFrontmatterAndBody`；`files.ts` 的 `listMarkdownFiles`（agents 改用它）；`types.ts`、`index.ts`。
- 能力数据与能力检查：`src/capabilities/types.ts` 与四个数据模块；`src/build/plan.ts`；
  `src/targets/types.ts`。
- 放置：`src/build/components.ts`（新增，skills、agents 的复制与风险自 `outputs.ts` 移入并加入
  commands）；`outputs.ts` 由 266 行减为 179 行。
- 宿主模块：`src/targets/agy/rules.ts`（新增）与 `index.ts`；`src/targets/codex/index.ts`。
- 测试：5 个新测试文件 20 个测试；`rules-commands` 夹具；6 个测试文件的 `TargetPlan` 字面量补
  `rules`、`commands`。
- 帮助文档：`docs/guide/source-project.md`（rules、commands 两节与组件表）、`targets.md`。

## 5. 与计划的偏差

- agents 的目录列举并入 `files.ts` 的 `listMarkdownFiles`，与 rules、commands 共用；读取失败时
  问题按文件名排序列出（原为目录列举的顺序），读取结果不变。
- 能力数据的 `host.checked` 未改为 2026-10-15：该日期写入每个夹具的构建报告，改动会使 18 个原有
  夹具的期望产物变化；新增取值的核对日期写在注释中。
- 夹具期望输出以 `test/container/run.sh exec` 在容器中运行 `update.ts` 生成，再以 tar 流取回
  核对；手写的三个 manifest 与生成结果一致。
- M4-05 实测（2026-10-15，agy 1.3.5）发现 agy 按被读文件的绝对路径匹配 `globs`，按工作区相对
  路径写的 `src/**/*.tsx` 不生效。按“已有同一件事的单就补那张单”，修正记在本单：`04328f0` 为
  含 `/` 的模式加 `**/` 前缀并写残余风险，F-11-09 的验收标准、使用指南与 `rules-commands` 夹具
  随之更新；`test/container/run.sh check` 296 pass / 0 fail。修正后的产物在 agy 会话中复测生效，
  见 [M4-05](M4-05-v0-3-0-live-tests.md)。
- 2026-10-15 补测 §7 第 2 项（维护者确认使用 Codex CLI）：在测试容器中以 codex-cli 0.162.1 安装
  `rules-commands` 的 Codex 产物，`commands/review.md` 被转换为
  `.codex-plugin/migrated-command-skills/source-command-review/SKILL.md`，会话中名为
  `rules-commands:source-command-review`。`$rules-commands:source-command-review` 把 SKILL.md 加入
  会话，模型按命令正文审查临时仓库中的一行改动；按描述的隐式选用与 TUI 中的 `$` 补全也生效；
  不带插件名的 `$source-command-review` 不加入 SKILL.md。记录见
  [Codex「容器实测（0.162.1）」](../research/coding-agent-plugin-manifests/codex-plugins.md#容器实测01621)
  （`26d2972`），使用指南的 Codex 小节随之写明调用方式。

## 6. 技术决策

| 决策 | 依据 | 回填状态 |
|---|---|---|
| agy 规则的 frontmatter 以 `yaml` 的 `stringify(…, { lineWidth: 0 })` 序列化 | 含 `: ` 或以 `*` 开头的取值自动加引号；不折行使每个键保持一行，与实测的写法等价 | 实现注释；M4-05 复测三种 trigger 生效 |
| 含 `/` 的 `globs` 模式在 agy 中加 `**/` 前缀，不改写成绝对路径 | 插件安装位置与工作区路径在构建时未知；`**/` 前缀在实测中生效，代价是也匹配其他位置的同名目录，写为残余风险 | F-11-09；使用指南 |
| 超长规则的残余风险按生成后的 UTF-8 字节数判断 | 文档记载的上限针对规则文件，frontmatter 换写后长度改变 | 已写入 F-11-09 的实现 |
| Codex 的命令转换限制只写一条风险，不逐条判断模板写法 | 跳过条件随 Codex 版本变化，SD-33 决定不复刻 | 已写入 F-06-09 的实现 |

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|
| 1 | 产物在宿主会话中的效果未实测（agy 的三种 trigger、Claude Code 的命令调用） | 夹具只证明产物内容与调研结论一致 | M4-05；已关闭：实测发现的 globs 问题由 `04328f0` 修正，修正后三种 trigger 与两个命令都生效 |
| 2 | Codex 转换命令后的调用方式未核对 | Codex 用户能否在会话中使用转换后的技能未知 | M4-00 收口时向维护者申请以 Codex CLI 实测（使用 Codex CLI 须逐次确认）；已关闭：2026-10-15 容器实测，转换后的技能可显式调用，也按描述被选用，见 §5 |

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- `rules-commands` 的 agy 产物在 M4-05 中安装实测，结论与调研不一致时先更新调研文档。
- 下一步：M4-03（按命名空间合并共用的 JSON）。
- 2026-10-15 补记：§7 两项均已关闭（第 1 项由 M4-05，第 2 项由 Codex 容器实测，见 §5）；结论按
  验收时的判断保留为有条件通过。
