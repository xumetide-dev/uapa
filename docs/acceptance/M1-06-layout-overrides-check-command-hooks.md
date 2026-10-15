# 验收 M1-06：合并布局、覆盖文件、比对与命令 hooks

> 本文记录 M1-06 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M1-06](../workorders/M1-06-layout-overrides-check-command-hooks.md) |
| 覆盖功能点 | `F-01-06`、`F-03-06`、`F-03-08`、`F-03-12`、`F-09-04`、`F-01-09`、`F-03-15`、`F-05-15`、`F-06-08`、`F-11-06`（取自总览「工单构成」表） |
| 验收日期 | 2026-10-14 |
| 验收结论 | 有条件通过（§7 两项由 M1-07 接手） |
| 判断范围 | 夹具与单元测试 |
| commit | `bb89b1d` |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | 夹具 `throwing-guard`：三个入口的执行前检查在守卫抛错与缺少会话 id 时都拒绝（Claude Code、Codex 退出码 2，agy stdout `decision: "deny"`）；夹具 `requires-missing`：缺 `promptGate` 的 `agy:subprocess` 构建失败，报告写明原因 |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | `fixtures.test.ts` 的导入检查覆盖新夹具中的 `uapa-claude-code.mjs`、`uapa-codex.mjs`、`uapa-agy.mjs`，只导入 `node:` 模块 |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | `test/build/layout.test.ts`：合并布局保留无关文件、冲突时目录快照不变；`--check` 前后整个源项目的 `readTree` 快照相等；夹具 `unknown-override` 退出码 2 且不写 `dist/` |
| V4 | 能力数据含无出处的宿主行为 | 否 | 三个能力数据模块的 `commandHookEvents` 注明取自命令 hooks 声明第 2 节，取值与该表一致；该表各列注明调研出处 |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：守卫不静默失效 | `throwing-guard` 与 `requires-missing` 夹具（TA-03、TA-04） | `throwing-guard` 11 个入口用例与期望逐字一致：执行前、提示提交前检查的原因为 `uapa: 守卫出错: throwing-guard`（agy 为退出码 0 的 `decision: "deny"`，其余退出码 2），停机前检查退出码 0、stderr 为同一原因，缺字段输入的原因以 `uapa: 无法解析宿主输入` 开头；`requires-missing` 退出码 1，stderr `uapa: agy:subprocess: 守卫的 requires 声明了 promptGate，本目标缺少该能力`，不写 `dist/agy/`，其余两个目标写出且提示阻断用例通过 | `fixtures.test.ts` 的「夹具 throwing-guard」「夹具 requires-missing」 | ✅ |
| 2 | 硬约束：不在运行时推断宿主 | TA-05：`full` 之前以三个子进程目标的入口用例各运行两次，输出逐字一致 | 11 个入口用例各运行两次，第二次另设其他两个目标的数据目录变量与 `ANTIGRAVITY_CONVERSATION_ID`；两次的退出码、stdout、stderr 逐字一致，另设变量所指目录均为空 | `test/fixtures/host-inference.test.ts` 1/1 | ✅ |
| 3 | 硬约束：确定性输出 | 夹具逐字节比对 | 9 个夹具（新增 3 个）的产物、stdout、stderr 与期望逐字节一致；已有 6 个夹具的期望产物未改 | `node --test test/fixtures/fixtures.test.ts` 9/9；`git diff cccec80 bb89b1d --name-only -- test/fixtures` 只含 `run.ts`、`host-inference.test.ts` 与三个新夹具 | ✅ |
| 4 | 硬约束：不越权写入 | 合并布局不删除目录中的其他文件、冲突时不写入（TA-07 的单元部分）；`--check` 前后目录快照一致（TA-08 的单元部分） | 合并布局保留 `out/keep.txt`；冲突时 `out/` 只剩 `keep.txt`；`--check` 前后快照相等，报告未写 | `test/build/layout.test.ts` 8/8 | ✅ |
| 5 | 硬约束：能力数据有出处 | 三个子进程目标的 `commandHookEvents` 取自命令 hooks 声明第 2 节 | Claude Code、Codex 六个事件同名；agy 的 `SessionEnd`、`UserPromptSubmit` 为 `null`，其余同名；注释注明出处 | `src/capabilities/*-subprocess.ts`；`test/build/command-hooks.test.ts` 以真实能力数据得出 agy 的跳过与失败 | ✅ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-01-06` | 读取覆盖目录 | 列出 `overrides/<宿主>/` 下的文件；目录名不是 `targets` 中已配置的宿主时失败；本模块不复制文件 | ✅ | `test/source/overrides.test.ts` 3/3：按宿主递归列出、相对宿主目录按字典序，非目录项忽略；`overrides/agy`、`overrides/kimi` 各一条 `不是已配置的宿主（已配置：claude-code、codex）`；`overrides` 为文件、含符号链接时为输入错误；`readOverrides` 只列举不复制；夹具 `unknown-override` 退出码 2，stderr `uapa: overrides/codex: 不是已配置的宿主（已配置：claude-code）`，不写 `dist/` |
| `F-03-06` | 合并布局写出 | 按 `resolvePluginDirs`（模块接口 §2）的结果，两个以上宿主的插件目录解析为同一路径时写入同一目录；只写入生成的文件，不删除目录中的其他文件；同名文件内容不一致时写入该目录的全部目标失败、该目录不写入任何文件，错误按模块接口 §8 写明文件、冲突的宿主与 `conflictHint`；该目录可以是源项目根目录，此时不复制 skills | ✅ | `test/build/layout.test.ts`：「合并布局只写入生成的文件」中 `out/keep.txt` 保留、同名同内容的 `same.txt` 只写一次；「合并布局同名文件内容不同」两目标各一条 `合并布局冲突：out/hooks/hooks.json 由 claude-code、codex 生成，内容不同；改用独立文件`，`units` 为空，`out/` 只剩 `keep.txt`，`dist/agy` 照常写出；「目录为源项目根目录」不复制 skills，`codex:subprocess` 记 skill 残余风险 |
| `F-03-08` | 只比对不写入 | 在内存中生成全部产物，与磁盘逐字节比对；不写任何文件，不生成也不比对构建报告；返回新增、修改的文件，默认布局另返回写入前会被清除的文件；失败目标的处理与输出格式见模块接口 §8 | ✅ | `test/build/layout.test.ts` 的三个「比对」用例：未构建时三条 `added`；构建后删除、修改、新建各一个文件，`changes` 依次为 `removed dist/claude-code/extra.txt`、`modified …/hooks/hooks.json`、`added …/manifest.json`，前后 `readTree` 快照相等，`reportPath` 为 `null`；合并布局的无关文件不产生差异；默认布局目标全部失败的目录、合并冲突的目录都不比对 |
| `F-03-12` | 应用覆盖文件 | 宿主模块生成之后、写出之前，用 `overrides/<宿主>/` 中的文件覆盖或新增该宿主的同名文件；覆盖文件不做字段白名单检查；覆盖生成文件时继承其合并标记；每个被覆盖或新增的文件写入该宿主各目标报告的 `overridden` | ✅ | `test/build/layout.test.ts`「覆盖文件替换生成文件与 skill 文件、新增文件」：三个文件内容为覆盖文件，`overridden` 为 `extra/README.md`、`manifest.json`、`skills/review/SKILL.md`；「覆盖生成文件时继承其 conflictHint」冲突错误带 Codex 生成文件的提示。v0.1.0 没有合并标记（F-03-07 为预留），继承的是 `conflictHint`；覆盖文件在宿主模块之后应用，不经字段白名单 |
| `F-09-04` | `--check` 选项 | `uapa build --check` 调用只比对模式，不写文件；比对一致且没有目标失败时以退出码 0 结束，有差异或有目标失败时以退出码 1 结束，差异按模块接口 §8 列出；stdout 只含差异行 | ✅ | `test/cli/run.test.ts`「--check」：以 `{ check: true }` 调用 `build`，两条差异时 stdout 为两行 `<change> <path>`、退出码 1、stderr 空；无差异时退出码 0、stdout 空；目标失败时退出码 1、stdout 空、stderr 一行原因；「参数解析」含 `--check --config a.ts` |
| `F-01-09` | 校验命令 hooks 声明 | `UapaConfig.commandHooks` 与 `CommandHookDecl` 按[命令 hooks 声明](../architecture/command-hooks.md)第 1 节定义，由包入口导出；`event` 不是第 1 节的六个事件之一、`command` 为空或含换行、`targets` 为空数组、含重复或未配置的目标，或出现 `matcher`、`timeout` 等未知字段时返回 `InputIssue`，字段路径如 `commandHooks[1].event` | ✅ | `test/config/command-hooks.test.ts` 4/4：字段路径 `commandHooks[0].event`（`未知事件 "Notification"`）、`commandHooks[0].command`（`不能为空`；含 `\n` 或 `\r` 时 `应为单行，不能含换行`）、`commandHooks[1].targets`（空数组）、`commandHooks[1].targets[1]`（重复、未配置）、`commandHooks[1].targets[0]`（未知目标名）、`commandHooks[0].matcher` 与 `.timeout`（`未知字段`）；`CommandHookDecl`、`CommandHookEvent` 由 `src/index.ts` 导出（`tsc` 检查夹具配置的类型） |
| `F-03-15` | 检查命令 hooks 的事件承载 | `TargetCapabilities` 增加 `commandHookEvents`（模块接口 §4），缺少时 `tsc` 报错；按[命令 hooks 声明](../architecture/command-hooks.md)第 4 节得出各目标的 `TargetPlan.commandHooks`：适用且宿主事件名不为 `null` 的声明按声明顺序列入；`targets` 显式列出的目标不承载该事件时该目标失败；未显式列出时写入该目标报告的 `skipped`（`component` 为 `commandHooks[<下标>]`），同一宿主的另一目标承载该声明时不写 | ⚠️ 仅“同一宿主的另一目标承载该声明时不写”未验证 | `test/build/command-hooks.test.ts` 3/3：承载的声明按声明顺序列入、限定其他目标的声明不计；agy 不承载 `UserPromptSubmit`、`SessionEnd` 时 `skipped` 为 `commandHooks[1]`、`commandHooks[2]`，目标成功；显式列出 agy 的 `SessionEnd` 声明使 agy 失败（`commandHooks[0] 显式限定了本目标，但本目标不承载 SessionEnd 事件`），`plan` 为 `null`；字段缺失时 `tsc` 报错（三个能力数据模块都已填写）。同一宿主两个目标的情形须等 `claude-code:in-process` 登记（§7 第 1 行） |
| `F-05-15` | 写入声明的命令 hooks | 两个目标的能力数据按[命令 hooks 声明](../architecture/command-hooks.md)第 2 节填写 `commandHookEvents`（`claude-code:in-process` 全部为 `null`，`claude-code:subprocess` 的六个事件均为同名宿主事件）；`hooks/hooks.json` 的 `hooks` 键按 `claude-code:subprocess` 的 `TargetPlan.commandHooks` 写入条目，结构与 F-05-03 的守卫条目相同，`{pluginRoot}` 换为 `${CLAUDE_PLUGIN_ROOT}`，同一事件下排在守卫条目之后；未配置守卫时只生成 `hooks/hooks.json`，不生成入口；去重（F-05-08）不作用于这些条目 | ⚠️ 仅 `claude-code:in-process` 部分未交付 | `test/targets/command-hooks.test.ts`「Claude Code」：`PreToolUse` 依次为守卫分组、两条声明的分组，`SessionEnd` 一组，`{pluginRoot}` 换为 `${CLAUDE_PLUGIN_ROOT}`；「未配置守卫时」只生成 `.claude-plugin/plugin.json` 与 `hooks/hooks.json`，未打包；`claude-code:subprocess` 的 `commandHookEvents` 六个事件均为同名。`claude-code:in-process` 的能力数据与去重（F-05-08）在 M1-07（§7 第 2 行） |
| `F-06-08` | 写入声明的命令 hooks | 能力数据按[命令 hooks 声明](../architecture/command-hooks.md)第 2 节填写 `commandHookEvents`；hooks 配置（默认 `hooks/hooks.json`，或 `hooksFile`）按 `TargetPlan.commandHooks` 写入条目，结构与 F-06-03 的守卫条目相同，`{pluginRoot}` 换为 `${PLUGIN_ROOT}`，同一事件下排在守卫条目之后；未配置守卫时只生成 hooks 配置与 manifest 的 `hooks` 字段，不生成入口；声明含 `SessionEnd` 时残余风险写明 Codex 的 `SessionEnd` 默认超时 1 秒、上限 3 秒 | ✅ | `test/targets/command-hooks.test.ts`「Codex」：写入 `hooksFile` 指定的 `codex-hooks.json`，`Stop` 依次为守卫分组与声明分组，`{pluginRoot}` 换为 `${PLUGIN_ROOT}`，manifest `hooks` 为 `./codex-hooks.json`，残余风险含 `SessionEnd` 一条；「未配置守卫时」只生成 manifest 与 `hooks/hooks.json`，manifest `hooks` 为 `./hooks/hooks.json`，未打包 |
| `F-11-06` | 写入声明的命令 hooks | 能力数据按[命令 hooks 声明](../architecture/command-hooks.md)第 2 节填写 `commandHookEvents`（`SessionEnd`、`UserPromptSubmit` 为 `null`）；`hooks.json` 按 `TargetPlan.commandHooks` 每条声明写一个元素，结构同 F-11-03（`PostToolUse` 与 `PreToolUse` 相同，`SessionStart` 与 `Stop` 相同），`{pluginRoot}` 换为 `.`，同一事件下排在守卫元素之后；未配置守卫时只生成 `hooks.json`，不生成入口；声明含 `PreToolUse` 时残余风险写明该命令的 stdout 须为含 `decision` 的 JSON，否则每次工具调用都被阻断 | ✅ | `test/targets/command-hooks.test.ts`「agy」：`PreToolUse` 两个 `{ matcher: "", hooks }` 元素（守卫在前），`PostToolUse` 同结构，`SessionStart` 为处理器，`node {pluginRoot}/pre.mjs` 换为 `node ./pre.mjs`；残余风险为 `声明的 PreToolUse 命令须在 stdout 输出含 decision 的 JSON，否则 agy 阻断每次工具调用`；「未配置守卫时」只生成 `plugin.json` 与 `hooks.json`；能力数据 `SessionEnd`、`UserPromptSubmit` 为 `null` |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
pnpm check
node --test test/fixtures/fixtures.test.ts
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `pnpm check` | 通过：两次 `tsc` 无错误，Biome 检查 132 个文件无问题，`node --test` 160 pass / 0 fail，功能清单检查“93 个功能，18 条用户故事，18 项技术验收，关系检查通过” | 以 `test/container/run.sh check` 在容器中运行 |
| `node --test test/fixtures/fixtures.test.ts` | 9 pass / 0 fail（含新增的 `requires-missing`、`throwing-guard`、`unknown-override`）；同次运行的 `host-inference.test.ts` 1 pass | 以 `test/container/run.sh exec` 在容器中运行 |

## 4. 交付物

- 构建编排：`src/build/outputs.ts`（计划写出的文件集合、合并冲突、覆盖文件、skills 放置与共用目录
  风险）、`src/build/compare.ts`（比对）、`src/build/write.ts`（按集合写出）、`src/build/run.ts`
  （`check` 分支）、`src/build/plan.ts`（命令 hooks 承载检查）、`src/build/generate.ts`
  （`sharedWith`）、`src/build/state.ts`（`BuildInput`）。
- 源项目：`src/source/overrides.ts`、`src/source/files.ts`（由 `skills.ts` 抽出的文件列举）。
- 配置与能力数据：`src/config/types.ts`（`CommandHookEvent`、`CommandHookDecl`）、
  `src/config/validate.ts`、`src/capabilities/types.ts` 与三个子进程目标的 `commandHookEvents`。
- 宿主模块：`src/targets/types.ts`（`TargetPlan.commandHooks`、`HostInput.sharedWith`），三个宿主的
  `hooks.ts` 与 `index.ts`，`src/targets/codex/manifest.ts`（`NO_HOOKS`）。
- 命令行：`src/cli/args.ts`、`src/cli/run.ts`（`--check`）。
- 测试：`test/build/layout.test.ts`、`test/build/command-hooks.test.ts`、
  `test/source/overrides.test.ts`、`test/config/command-hooks.test.ts`、
  `test/targets/command-hooks.test.ts`、`test/fixtures/host-inference.test.ts`；夹具
  `throwing-guard`、`requires-missing`、`unknown-override`；`test/fixtures/run.ts` 登记 Codex 与 agy
  的入口。
- 文档：模块接口 §5、功能清单 F-06-02 与 F-06-03、Codex 调研与源码核对记录。

生成的 Codex manifest（没有 hooks、与其他宿主共用目录时）：

```json
{
  "name": "demo",
  "version": "0.1.0",
  "description": "测试用插件",
  "hooks": {
    "hooks": {}
  }
}
```

## 5. 与计划的偏差

- 超出施工单边界：`src/targets/types.ts` 的 `HostInput` 增加 `sharedWith`，Codex manifest 增加
  `NO_HOOKS`，Codex 与 agy 增加共用插件目录的残余风险。三项是施工单「测试」节承接的 M1-04、
  M1-05 验收 §7 所要求的，不属于“命令 hooks 的写入”。模块接口 §5 同步增加 `sharedWith`。
- 新增一条施工单未列的 Codex 残余风险：与 Claude Code 共用插件目录且 hooks 配置为
  `hooks/hooks.json` 时，Claude Code 也会加载该文件。Claude Code 按目录加载该文件，Codex 的
  manifest 无法阻止；该条已写入 F-06-03 的验收标准。
- F-06-02 的验收标准增加共用目录时写 `"hooks": {"hooks": {}}` 一句。
- `src/source/skills.ts` 中的文件列举移到 `src/source/files.ts`，供覆盖目录共用，行为不变。
- `test/fixtures/run.ts` 的 `runEntryCase` 增加 `extraEnv` 参数，供 TA-05 的第二次运行使用。
- 已有夹具的期望产物不变；默认布局的清空规则与路径校验不变，路径校验从写出移到计划阶段，
  比对模式因此同样校验。

## 6. 技术决策

- 写出与比对共用 `planOutputs` 得出的集合，比对只把写出换成逐字节比较，因此部分失败时的
  `removed` 与实际清空后的结果一致。skills 文件放入每个宿主在该目录中的文件表，覆盖文件可以
  替换 skill 文件；合并布局中各宿主的文件表对同一路径内容不同即为冲突。
- 冲突错误写作 `合并布局冲突：<路径> 由 <宿主>、<宿主> 生成，内容不同；<conflictHint>`，路径相对
  配置文件所在目录。
- 复制的源文件（skills、覆盖文件）以 `copyFile` 写出，保留可执行权限；比对只比较内容。
- 每条命令 hooks 声明在 hooks 配置中占一个分组（agy 为一个元素），排在同一事件的守卫条目之后；
  未生成入口时不写守卫条目。
- 承接 M1-05 验收 §7 第 2 行（已关闭）：按 Codex rust-v0.162.1 源码，`"hooks": []` 解析为未写、仍读
  默认文件，单个内联对象 `{"hooks": {}}` 不回退；结论写入源码核对记录。Codex 是开源宿主，按
  TA-15 以源码核对为依据。
- 承接 M1-04 验收 §7 第 1 行（已关闭）：`sharedWith` 由配置的插件目录布局得出，agy 与 Claude Code
  共用目录时写 F-11-03 的残余风险。
- 承接 M1-03 验收 §7 第 1 行（已关闭）：`--check` 不调用 `verify`，报告中 `hostValidation` 为
  `none`（`test/build/layout.test.ts` 的比对用例）。

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|
| 1 | 承载检查的“同一宿主的另一目标承载该声明时不写”已实现但没有用例：目前每个宿主只登记了一个目标 | `F-03-15` 部分交付 | M1-07 登记 `claude-code:in-process` 后补单元测试（已写入 M1-07 施工单「测试」节） |
| 2 | `claude-code:in-process` 的 `commandHookEvents` 与“去重不作用于声明的命令”依赖 M1-07 的目标与去重 | `F-05-15` 部分交付 | M1-07 实现 F-05-08、F-05-14 时补齐并测试（已写入 M1-07 施工单「测试」节） |

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- 合并布局、覆盖文件与命令 hooks 的产物未在宿主中安装运行；`merged`、`merged-conflict`、
  `targets-filter`、`command-hooks` 夹具与 TA-06、TA-07、TA-08 的夹具部分在 M1-07 加入。
- Codex 的 `{"hooks": {}}` 写法依据源码，宿主升级后需重新核对 `resolve_manifest_hooks` 与
  `load_plugin_hooks`。
- 下一步：M1-07（Claude Code hooks 模块与四目标夹具）。
