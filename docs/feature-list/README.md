# UAPA 功能清单

本目录列出 UAPA 各版本交付的软件功能，按功能模块分文件。每个功能有唯一编号、阶段、子模块、
验收标准与依赖，并由 [用户故事](stories.md) 或 [技术验收](technical-acceptance.md) 承接；取舍
记录在 [范围决策](scope-decisions.md)。技术约束见 [架构](../architecture/architecture.md)，
模块之间的数据类型见 [模块接口](../architecture/module-interfaces.md) 与
[入口与打包接口](../architecture/runtime-interfaces.md)，守卫公共类型与各目标的 hooks 输出见
[hooks 适配](../research/coding-agent-plugin-manifests/uapa-hook-adapters.md)。文档冲突时的依据见
[开发 UAPA](../guide/developing-uapa.md#文档冲突时的依据)。术语见
[架构「术语」](../architecture/architecture.md#术语)。
本清单不含估时。

## 阶段

| 阶段 | 范围 |
|---|---|
| v0.1.0 | 四个目标：`claude-code:in-process`、`claude-code:subprocess`、`codex:subprocess`、`agy:subprocess`；组件只含 skills，另生成守卫 hooks 与配置中声明的命令 hooks；守卫检查含执行前、提示提交前与停机前 |
| v0.2.0 | 同一批目标补全 agents、MCP 服务器与执行后检查 |
| v0.3.0 | 同一批目标补 rules 与 commands、守卫选项，以及按命名空间合并共用 JSON 的 F-03-07 |
| v0.4.0 | 同一批目标补齐三个宿主已承载的能力：共用文件、rules 与 commands 的换算承载、MCP 服务器的环境变量、marketplace 文件、Claude Code 的 manifest 透传字段，以及守卫可靠性与残余风险 |
| 预留 | 设计保留、尚未排期：Copilot CLI（07）与 Kimi Code（08）的全部功能；恢复排期时改为具体版本 |

其余目标与组件的安排见 [SD-01、SD-02](scope-decisions.md)，v0.2.0 的目标范围见 SD-28，
v0.3.0 的范围见 SD-31，v0.4.0 的范围见 SD-36，预留的理由与恢复条件见 SD-26、SD-27。

## 端

全部功能落在同一个端：`uapa` 命令行（[ARCH-001](../architecture/ARCH-001-agent-plugin-build-tool.md)）。
打包进插件产物的运行时代码随命令行包发布，不单列端。

## 功能模块

| 编号 | 功能模块 | 职责 | 代码位置 |
|---|---|---|---|
| 01 | [源项目与配置](modules/01-source-config.md) | 构建配置、目标名与宿主标识、组件读取、覆盖目录 | `src/config/`、`src/source/`（`guard.ts` 除外） |
| 02 | [守卫接口](modules/02-guard-api.md) | 守卫公共类型；构建时读取守卫声明 | `src/runtime/core/types.ts`、`src/source/guard.ts` |
| 03 | [构建编排](modules/03-build.md) | 能力检查、宿主模块接口与注册表、按宿主构建、组件放置与覆盖、产物布局与合并、宿主校验、比对、构建报告 | `src/build/`、`src/report/`、`src/capabilities/types.ts`、`src/capabilities/index.ts`、`src/targets/types.ts`、`src/targets/index.ts`、`src/bundle/types.ts` |
| 04 | [守卫运行时](modules/04-guard-runtime.md) | 工具名与入参换算、子进程入口的公共部分、打包 | `src/runtime/core/`（`types.ts` 除外）、`src/runtime/entries/subprocess.ts`、`src/runtime/entries/bundle-names.d.ts`、`src/bundle/`（`types.ts` 除外） |
| 05 | [Claude Code 目标](modules/05-claude-code.md) | 两种形态的能力数据、manifest、hooks 配置、入口；两种形态合为一个插件包并去重 | `src/targets/claude-code/`、`src/capabilities/claude-code-*.ts`、`src/runtime/entries/claude-code-*.ts` |
| 06 | [Codex 目标](modules/06-codex.md) | 能力数据、`$schema` 格式 manifest、hooks 配置与入口 | `src/targets/codex/`、`src/capabilities/codex-subprocess.ts`、`src/runtime/entries/codex-subprocess.ts` |
| 07 | [Copilot CLI 目标](modules/07-copilot-cli.md)（预留） | 能力数据、`$schema` 格式 manifest、hooks 配置与入口 | `src/targets/copilot-cli/`、`src/capabilities/copilot-cli-subprocess.ts`、`src/runtime/entries/copilot-cli-subprocess.ts` |
| 08 | [Kimi Code 目标](modules/08-kimi-code.md)（预留） | 能力数据、`kimi.plugin.json`、hook 规则与入口 | `src/targets/kimi/`、`src/capabilities/kimi-subprocess.ts`、`src/runtime/entries/kimi-subprocess.ts` |
| 09 | [命令行](modules/09-cli.md) | 命令、参数、终端输出与退出码 | `src/cli/` |
| 10 | [仓库工程与发布](modules/10-repo-release.md) | 本地检查、测试夹具、包结构、发布与安装冒烟 | `scripts/`、`test/fixtures/`、`package.json`、`tsconfig*.json`、`biome.json` |
| 11 | [agy 目标](modules/11-agy.md) | 能力数据、根 `plugin.json`、根 `hooks.json` 与入口 | `src/targets/agy/`、`src/capabilities/agy-subprocess.ts`、`src/runtime/entries/agy-subprocess.ts` |

`src/index.ts` 只做重新导出，不归单一功能模块：F-01-01 导出 `defineConfig` 与 `UapaConfig`，
F-02-01、F-02-02 导出守卫公共类型。

### 划分原则

- **宿主无关的功能模块与宿主功能模块分开。** 01～04、09～10 不包含 manifest、hooks 配置与入口
  协议等宿主格式；01 只含宿主标识、目标名与 `hosts` 中各宿主选项的类型及校验。每个宿主一个
  功能模块，负责该宿主的能力数据、manifest、hooks 配置、入口的决策输出与产物校验。
- **代码依赖方向以[架构 §1](../architecture/architecture.md#1-组成与模块) 的模块表为准。**
  构建编排（`src/build/`）经 `src/targets/index.ts` 调用宿主模块，宿主模块不导入构建编排；
  宿主模块按[模块接口 §5](../architecture/module-interfaces.md) 返回文件列表；共用插件目录时
  同名文件必须逐字一致，宿主模块标为可合并的 JSON 按命名空间合并（F-03-07，v0.3.0）。
- **新增目标不改构建编排与守卫运行时的接口。** 要修改的位置见
  [架构 §2](../architecture/architecture.md#2-目录结构)；需要新的守卫能力时，先扩展 02 的公共类型。
- **阶段内依赖不跨到后续阶段。** 每个版本阶段的功能只依赖同一阶段或更早阶段的功能，不依赖
  预留的功能。

## 建议实现顺序

依赖列只记录功能之间的先后。夹具、TA-14 与发布功能要运行各宿主的产物，但关系检查不允许它们
依赖宿主功能模块（05～08、11），它们的位置由下表与[夹具表](modules/10-repo-release.md#夹具)的
「加入比对」列确定。本节不估时。同一里程碑内的功能可以并行；每个里程碑结束时 `pnpm check`
通过，「加入比对」不晚于该里程碑的夹具比对通过。M4 与 M5 的功能互不依赖，可以并行；含四个
目标的夹具在两者都完成后加入比对，是 M6 的前提。M5 的 TA-12 用覆盖目录把测试文件放进产物，
须在 F-01-06、F-03-12 完成后运行。

| 里程碑 | 完成标志 | 功能 |
|---|---|---|
| M1 仓库骨架 | `pnpm check` 在空实现上通过 | F-10-01, F-10-03 |
| M2 skills 端到端 | `no-guard`、`empty`、`invalid-config`、`usage-error` 夹具比对通过：写出 `claude-code:subprocess` 的 manifest 与 skills，构建报告与终端摘要齐全 | F-02-01～F-02-03, F-01-01～F-01-05, F-03-01～F-03-05, F-03-09～F-03-11, F-05-01, F-05-02, F-09-01～F-09-03, F-10-02 |
| M3 守卫端到端 | `single-claude`、`verify-failed` 夹具比对通过；`single-claude` 的入口用例覆盖放行、拒绝、改写、缺少会话 id 的执行前事件，以及 TA-16 的停机序列（前提：TA-15 入口前提中 Claude Code 的各项已有结论） | F-03-13, F-03-14, F-04-01～F-04-06, F-05-03, F-05-04, F-05-09 |
| M4 Codex 与 agy 子进程目标、合并布局 | `throwing-guard`、`requires-missing`、`unknown-override` 夹具比对与入口用例通过（TA-03、TA-04）；合并布局、覆盖文件、命令 hooks 声明与 `--check` 的单元测试通过 | F-01-06, F-03-06, F-03-08, F-03-12, F-09-04, F-06-01～F-06-05, F-11-01～F-11-05, F-01-09, F-03-15, F-05-15, F-06-08, F-11-06 |
| M5 Claude Code hooks 模块 | `in-process-only`、`claude-both` 夹具比对通过：配置两个 Claude Code 目标时只生成一份 `plugin.json`，`hooks/hooks.json` 同时含 `hooks` 与 `modules` 键，命令入口在去重变量等于 `session_id` 时以退出码 0 结束；TA-17 通过。TA-11、TA-12 为宿主实测，不阻塞发布 | F-04-07, F-05-05～F-05-08, F-05-10, F-05-14 |
| M6 发布 | 夹具表全部夹具比对通过；生成发布提交与 tag，安装冒烟通过 | F-10-04, F-10-05 |

- [SD-22](scope-decisions.md) 列出的 TA-15 入口前提须在对应宿主的子进程入口实现前得出结论：
  Claude Code 在 M3 之前（已于 2.1.296 实测），Codex 在 M4 之前；agy 的各项已于 1.3.4 实测。
  [SD-23](scope-decisions.md)
  的两项在发布前须有结论。其余实测项不阻塞实现与发布，实测前相关能力在能力数据中记为不支持；
  结论决定各目标 `promptGate` 的取值。

## 编号

- 功能编号为 `F-XX-NN`，`XX` 是模块编号，`NN` 在模块内递增；编号一经分配不复用。
- 角色为 `P-NN`，用户故事为 `US-NN`，技术验收为 `TA-NN`，范围决策为 `SD-NN`；均只追加，不重编号。
- 阶段为 `v0.1.0`、`v0.2.0`、`v0.3.0`、`v0.4.0` 或 `预留`；故事与技术验收各有阶段，只引用
  不晚于该阶段的功能。
- 功能表的“依赖”列表示该功能验收前必须先完成的功能，不表示代码的导入方向。

## 检查

编号、依赖与承接关系由脚本检查：编号格式与唯一性、依赖存在且无环、跨功能模块的依赖不指向
宿主功能模块（05～08、11）、依赖不指向更晚的阶段、故事与技术验收的引用存在且不晚于其阶段、
每个已排期的功能至少被一条故事或技术验收承接（预留功能不要求）。F-10-01 实现后，该检查是 `pnpm check` 的一步；在此之前直接运行：

```bash
node scripts/check-feature-list.mjs
```
