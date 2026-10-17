# 验收 M2-01：v0.2.0 宿主事实与接口定稿

> 本文记录 M2-01 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M2-01](../workorders/M2-01-v0-2-0-host-facts.md) |
| 覆盖功能点 | 无（调研文档、能力数据与接口文档）（取自总览「工单构成」表） |
| 验收日期 | 2026-10-14 |
| 验收结论 | 有条件通过（agy 根 `agents.json` 与 `agents/*.md` 并存时的处理未实测） |
| 判断范围 | 文档 + 宿主实测 |
| commit | `22a7b07` |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | 本单不改 `src/` 的行为，能力数据取值不变；`pnpm check` 中 TA-03 的入口用例与 16 个夹具的比对通过（198 pass） |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | 产物未变；TA-01 的夹具测试通过 |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | 构建编排未改；TA-07、TA-08 的测试通过 |
| V4 | 能力数据含无出处的宿主行为 | 否 | 四个数据模块的 `replaceOutput`、`withholdOutput` 与组件承载的注释指向带日期的实测或源码核对小节；TA-09 的「宿主版本、核对日期与出处」通过 |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：能力数据有出处 | TA-09 的单元测试通过；每个改动的取值在数据模块的注释中指向调研文档中带日期的实测或源码核对小节 | 取值均未改动；`claude-code-in-process.ts`、`claude-code-subprocess.ts` 的替换与扣留注释指向 Claude Code 本地实测记录「执行后检查」（2026-10-14，2.1.296），`codex-subprocess.ts` 指向 Codex 源码核对记录的「PostToolUse」「插件中的 MCP 服务器」「agents」（rust-v0.162.1），`agy-subprocess.ts` 指向 agy「agents 与 MCP 服务器（1.3.5，容器）」；TA-09 的 3 个测试通过 | `test/capabilities/capabilities.test.ts`；`test/container/run.sh check` 198 pass / 0 fail | ✅ |
| 2 | Claude Code 宿主事实 | 施工单任务 1 的 Claude Code 各项有结论 | `tool_response` 形状（Bash、Read）、`updatedToolOutput` 的对象与字符串取值、退出码 1 与超时、`PostToolUseFailure`；hooks 模块 `next` 的结果字段、`{ result }` 替换 Bash 与 Read、`{ deny }` 扣留（含报错的结果）、两个不带 matcher 的处理函数使模块校验失败；`.mcp.json` 中 `command`、`args`、`env` 的 `${CLAUDE_PLUGIN_ROOT}` 展开；含 `targets` 的 agent 通过 `validate --strict` | [本地实测记录](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#执行后检查)（宿主实测，2.1.296，容器） | ✅ |
| 3 | Codex 宿主事实 | 施工单任务 1 的 Codex 各项有结论 | `PostToolUse` 的 stdin 与 `tool_response` 类型、`decision: "block"` 以 `reason` 替换输出、失败与超时保留原输出、只对成功的调用触发；兼容 manifest 的 `mcpServers` 路径与默认 `.mcp.json`、snake_case 字段、不展开占位符、相对 `cwd` 拼到插件目录；插件不承载 agents | [源码核对记录](../research/coding-agent-plugin-manifests/codex-source-review.md#posttooluse)（rust-v0.162.1，含上游测试名） | ✅ |
| 4 | agy 宿主事实 | 施工单任务 1 的 agy 各项有结论 | agents 以 frontmatter 的 `name` 加载，含 `targets` 照常加载；MCP 服务器以插件目录为工作目录，`args` 中的相对路径可用，`env` 原样传入，进程环境有 `PLUGIN_ROOT`、`PLUGIN_DATA`；`${extensionPath}` 的服务器未启动（推断未展开）；根 `agents.json` 与 `agents/*.md` 并存时的处理未实测 | [agy「agents 与 MCP 服务器（1.3.5，容器）」](../research/coding-agent-plugin-manifests/agy-local-tests.md#agents-与-mcp-服务器135容器)（宿主实测，1.3.5，容器） | ⚠️ 仅 `agents.json` 并存一项未实测 |
| 5 | 范围决策与接口文档 | SD-29、SD-30；模块接口 §3、§5，入口与打包接口第 2～4 节，构建报告，hooks 适配第 4、6、7 节，F-03-13 与需要修订的 v0.2.0 条目，设计提案的过时段落 | 均已写入；修订 F-01-07、F-01-08、F-04-08、F-05-11～F-05-13、F-06-06、F-06-07、F-11-07、F-11-08 的验收标准，F-03-13 补 v0.2.0 的能力；设计提案文首、第 4 节、第 10 节改写 | 提交 `22a7b07` 的 diff | ✅ |
| 6 | 技术验收与夹具表 | TA-19、TA-20；TA-14、TA-04 的修订；夹具表的 `after-tool`、`components` | 均已写入；功能清单检查：93 个功能、18 条用户故事、20 项技术验收 | `node scripts/check-feature-list.mjs` | ✅ |

## 2. 功能点逐条验收

本单在总览「工单构成」表中不挂功能点，本节没有条目；交付以 §1 与 §3 判定。

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
pnpm check
node scripts/check-feature-list.mjs
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `pnpm check` | 经 `test/container/run.sh check` 运行：两套 `tsc` 通过，Biome 检查 164 个文件无问题，`node --test` 198 pass / 0 fail，功能清单检查通过 | Docker |
| `node scripts/check-feature-list.mjs` | `✓ 93 个功能，18 条用户故事，20 项技术验收，关系检查通过` | 无 |
| 宿主实测（容器 `shell`） | Claude Code 2.1.296：`PostToolUse` 与 `PostToolUseFailure` 的命令 hooks、hooks 模块 `tool.call` 在 `next` 前后的返回值、`.mcp.json` 与 agents 的会话，结论见 Claude Code 本地实测记录；agy 1.3.5：安装含两个 agent 与三个 MCP 服务器的临时插件、运行一次会话后卸载，结论见 agy「本地实测」；Codex：rust-v0.162.1 源码与上游测试核对 | 容器中的 Claude 令牌与 agy 登录；提示只要求运行 `echo uapa-after-tool-probe` 一类标记命令或读取临时目录中的文件 |
| `check_links.py .`、`check_width.py 100` | 链接：11 处失败均为技能模板中的占位链接，与本单无关；行宽：超出的 3 行为链接与命令行 | 无 |

## 4. 交付物

- 调研文档：`claude-code-local-tests.md`（「执行后检查」「MCP 服务器与 agents」两节）、
  `claude-code-plugins.md`、`claude-code-mods-guide.md`、`codex-source-review.md`（「PostToolUse」
  「插件中的 MCP 服务器」「agents」三节）、`codex-plugins.md`、`agy-plugins.md`、
  `cross-platform-comparison.md`、`uapa-hook-adapters.md`、`unified-agent-plugin-architecture.md`。
- 接口文档：`runtime-interfaces.md`（第 2～4 节）、`module-interfaces.md`（§3、§5）、
  `build-report.md`。
- 功能清单：SD-29、SD-30，TA-19、TA-20，TA-04 与 TA-14 的修订，模块 01、03、04、05、06、10、11
  的条目。
- 能力数据：`src/capabilities/` 四个数据模块的注释。

## 5. 与计划的偏差

- agy 的组件实测在 1.3.5 上进行：测试容器中的 agy 已是 1.3.5。能力数据的 `host.version` 保持
  1.3.4，因为 hooks 的各项结论来自 1.3.4 的实测；数据模块注释写明 agents 与 MCP 服务器的结论来自
  1.3.5。M2-05 在容器中重测 hooks 后再改版本号。
- F-11-08 的设计由“含 `{pluginRoot}` 的服务器列为跳过”改为“在 `args` 与 `env` 中换为 `.`，
  `command` 中出现时跳过”，F-06-06 同样换算：实测与源码核对表明两个宿主的服务器以插件目录为
  工作目录（Codex 需写 `"cwd": "."`），跳过会使插件自带的服务器在两个宿主上都不可用。
- 宿主模块接口增加 `HostResult.skipped`：MCP 服务器能否换算取决于宿主格式，由宿主模块判定。
- 施工单边界之外同步了 M2-02、M2-04 的施工单与 M2-02～M2-04 的验收骨架：功能条目修订后，
  验收骨架 §2 的验收要点按功能清单的当前文本更新；M2-04 的夹具改为四个服务器。

## 6. 技术决策

| 决策 | 位置 | 回填状态 |
|---|---|---|
| 执行后检查只在 `withholdOutput` 为支持时生成；缺 `replaceOutput` 时 `replace` 按扣留写出并记为降级 | SD-29；构建报告 `degraded` 第 2 种 | 已定 |
| 输出文本与替换按输出形状判断（字符串、`stdout`、`file.content`、其他），两种 Claude Code 形态共用 `src/runtime/core/output.ts` | 入口与打包接口第 4 节 | 已定 |
| 子进程协议增加 `replaceOutput`、`blockOutput`；Claude Code 的不可替换形状与 Codex 都以 `decision: "block"` 写出 | 入口与打包接口第 3 节 | 已定 |
| hooks 模块在 `tool.call` 上只注册一个处理函数，执行前后检查都在其中，`next` 之后出错返回 `{ deny }` | 入口与打包接口第 2、4 节 | 已定 |
| hooks 模块对报错的结果同样运行执行后检查；`next` 的结果含 `deny` 时原样返回 | 入口与打包接口第 4 节 | 已定 |
| agents 由构建编排原样放置；MCP 服务器由宿主模块生成，三个宿主的文件名、字段与插件根换算 | SD-30；模块接口 §3、§5 | 已定 |
| Codex 没有服务器而共用插件目录时 manifest 写 `"mcpServers": {}` | 模块接口 §5 | 已定（依据为代码路径，见 §7 第 2 行） |

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|
| 1 | agy 根 `agents.json` 与 `agents/*.md` 并存时的处理未实测 | UAPA 不生成 `agents.json`；源项目或覆盖目录提供它时，两者的优先级不明 | M2-05 任务 3 |
| 2 | Codex 兼容 manifest 的 `"mcpServers": {}` 不回退到 `.mcp.json`，依据为代码路径，没有上游测试 | 合并布局中 Codex 可能读到 Claude Code 的 `.mcp.json` | M2-05 任务 2（Codex CLI 的使用须维护者确认） |

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- Claude Code 命令 hooks 只能替换 Bash 与 Read 的输出，工具报错时只触发不能替换输出的
  `PostToolUseFailure`；只装命令 hooks 的旧版本 Claude Code 上，其他工具与报错的调用不受执行后
  检查约束。M2-02 由宿主模块把它写入构建报告的残余风险。
- Codex 的扣留对模型是一次失败的工具调用；替换只能降级为扣留。
- 下一步：M2-02 按 SD-29 与入口与打包接口实现执行后检查。
