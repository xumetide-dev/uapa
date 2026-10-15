# UAPA 架构

| 项 | 内容 |
|---|---|
| 状态 | v0.1.0、v0.2.0 以 tag 发布；§1、§2 描述模块与目录 |
| 选型依据 | [ARCH-001](ARCH-001-agent-plugin-build-tool.md) |
| 更新日期 | 2026-10-15 |
| 变更记录 | 2026-10-14：落实范围决策 SD-09、SD-13～SD-21，见[范围决策](../feature-list/scope-decisions.md)。2026-10-14：`TargetRuntimeData` 移入 `runtime/core`，`BundleRequest` 移入 `src/bundle/types.ts`，入口源码的类型声明、守卫返回值检查与插件目录解析的位置（SD-24）。2026-10-14：落实 SD-05（新增[命令 hooks 声明](command-hooks.md)）与 SD-06。2026-10-14：v0.1.0 目标改为 Claude Code 两种形态、Codex 与 agy；Copilot CLI 与 Kimi Code 改为预留（SD-25～SD-27） |

本文是 UAPA 的权威架构文档：由哪些模块组成、模块之间的依赖方向、各层的硬约束、目录与发布方式。
模块之间交换的数据类型见 [模块接口](module-interfaces.md)、
[入口与打包接口](runtime-interfaces.md)、[构建报告](build-report.md) 与
[命令 hooks 声明](command-hooks.md)。选型理由与被否决的方案见
[ARCH-001](ARCH-001-agent-plugin-build-tool.md)。守卫公共类型与各目标的 hooks 输出见
[hooks 适配](../research/coding-agent-plugin-manifests/uapa-hook-adapters.md)；后续目标（Cursor、
Kiro、CodeBuddy、OpenCode、DSH）的设计见
[设计提案](../research/coding-agent-plugin-manifests/unified-agent-plugin-architecture.md)。
文档冲突时的依据见 [README](../../README.md#文档冲突时的依据)。

## 术语

本文与功能清单中的“模块”指 §1 的代码模块；功能清单按 01～10 划分的称“功能模块”，
与代码模块不一一对应。“宿主模块”指 `src/targets/<宿主>/`；功能清单的 05～08 与 11 称“宿主功能
模块”，另含该宿主的能力数据与入口源码。

| 术语 | 含义 |
|---|---|
| 宿主 | 加载插件的编码代理。v0.1.0 的宿主标识为 `claude-code`、`codex`、`agy`；`copilot-cli`、`kimi` 为预留，不在 v0.1.0 登记 |
| 形态 | hooks 在宿主中的运行方式：`subprocess` 为命令 hooks，每个事件启动一个 Node 子进程；`in-process` 为 Claude Code 的 hooks 模块（mod），运行在没有 Node 的独立环境 |
| 目标 | `<宿主>:<形态>`，如 `codex:subprocess`；能力数据、入口与能力检查按目标区分 |
| 源项目 | 插件作者维护的目录：`uapa.config.ts`、skills、守卫逻辑与覆盖目录 `overrides/<宿主>/` |
| 组件 | 源项目中按目录读取、放进插件目录的内容：v0.1.0 为 skills，v0.2.0 增加 agents 与 MCP 服务器；能力数据的 `components` 另含 `hooks`，表示目标承载 hooks 配置的位置 |
| 宿主选项 | 配置中 `hosts.<宿主>` 下的字段（模块接口 §2），同一宿主的目标共用 |
| 守卫 | 插件在宿主事件上做出的放行、拒绝、改写、阻断或继续的判断；由守卫逻辑实现，经各目标的 hooks 配置与入口生效。“守卫 hooks”指为守卫生成的 hooks 配置与入口 |
| 守卫逻辑 | 插件作者编写的 TypeScript 文件，默认导出 `GuardPlugin`，由配置的 `guard` 字段指定 |
| 守卫声明 | 构建时从守卫逻辑的默认导出读出的 `name`、`requires` 与已实现的检查（`GuardDeclaration`，模块接口 §3）；不是单独的文件 |
| 命令 hooks 声明 | 配置 `commandHooks` 中原样声明、不经守卫逻辑的命令；由子进程目标换为宿主事件名后写入 hooks 配置（[命令 hooks 声明](command-hooks.md)） |
| 检查 | 守卫逻辑实现的方法：执行前检查 `beforeTool`、提示提交前检查 `beforePrompt`、停机前检查 `beforeStop`、执行后检查 `afterTool`（v0.2.0）。构建时的能力检查、字段白名单检查、宿主校验、`uapa build --check` 的比对与功能清单的关系检查都不属于这里的“检查” |
| 决策 | 检查的返回值：`BeforeTool` 为 allow、deny、rewrite，`BeforePrompt` 为 allow、block，`BeforeStop` 为 stop、continue；“决策输出”指入口把决策写成宿主协议要求的退出码、stdout 与 stderr |
| 规范名 | 守卫看到的统一工具名，如 `shell`、`edit_file`（hooks 适配第 3 节）；能力数据的 `toolNames` 把宿主工具名换算为规范名 |
| 能力 | `Capability` 的取值，如 `rewriteInput`、`stopGate`、`promptGate`；守卫在 `requires` 中列出必需的能力 |
| 停机门禁 | 能力 `stopGate`：停机前检查返回 `continue` 时，宿主不结束本轮；“停机继续”指该决策的输出 |
| 能力数据 | 每个目标一个 `TargetCapabilities` 数据模块，带宿主版本、核对日期与出处 |
| 目标数据 | 打包时注入入口的 `TargetRuntimeData`（插件名、工具名映射、能力、去重变量名），由宿主模块从能力数据与配置得出；入口不导入能力数据模块 |
| 入口 | 宿主调用的产物文件。子进程目标为 `hooks/uapa-<宿主>.mjs`；`claude-code:in-process` 为 `hooks/register.ts`，它只引入守卫文件 `hooks/uapa-guard.mjs`。入口源码指 `src/runtime/entries/<宿主>-<形态>.ts`，由 `bundle` 打包为入口或守卫文件。与包入口 `src/index.ts` 不同 |
| 产物 | 一次构建为各目标生成的文件，即各插件目录的内容；不含构建报告 `<outDir>/uapa-report.json` |
| 插件目录 | 宿主安装命令接收的一个目录，即插件包。默认每个宿主一个；同一宿主的多个目标写入同一插件目录 |
| 默认布局 | 每个宿主一个插件目录，写入前清空（模块接口 §8）；与合并布局相对 |
| 合并布局 | 两个以上宿主写入同一插件目录 |
| 跳过 | 目标不能承载某组件时不产出该组件，写入构建报告；组件 frontmatter 显式写了该目标时改为该目标失败 |
| 降级 | 守卫决策在目标上以较弱方式执行，写入构建报告；v0.1.0 只有一种：不能改写入参的目标把 `rewrite` 按 `fallbackReason` 拒绝 |
| 残余风险 | 构建成功、但守卫在某些条件下不生效的情况，如默认放行的宿主缺少 Node；写入构建报告 |
| 宿主校验 | 写出后调用宿主提供的校验命令（v0.1.0 只有 `claude plugin validate --strict`），结果写入报告的 `hostValidation`；没有可靠校验命令的宿主改在生成时做字段白名单检查 |
| 适配器 | hooks 适配文档中的用语，指 `src/runtime/` 中的换算与入口代码 |
| 安装单位 | 需要单独安装到某个位置的一组文件；v0.1.0 的每个目标恰好一个安装单位，即其插件目录 |
| 使用方 | 以 devDependency 引用 UAPA、在其中维护源项目的仓库；“首个使用方”指提出 v0.1.0 需求的仓库 |

## 0. 技术选型总览

| 层 | 选型 | 版本 | 依赖类别 |
|---|---|---|---|
| 语言 | TypeScript | 7.0.x | 开发 |
| 运行时 | Node.js | 构建器 ≥ 22.18；生成的子进程入口支持 ≥ 22 | 环境 |
| 打包 | rolldown | 1.2.x | 生产 |
| YAML | yaml | 2.9.x | 生产 |
| 输入校验 | zod | 4.6.x | 生产 |
| 命令行解析 | `util.parseArgs` | Node 内置 | 无 |
| 测试 | `node:test` | Node 内置 | 无 |
| 格式与检查 | Biome | 2.5.x | 开发 |
| 包管理 | pnpm | 12.x | 开发 |

| 冻结项 | 结论 |
|---|---|
| 首批目标 | v0.1.0 为 `claude-code:in-process`、`claude-code:subprocess`、`codex:subprocess`、`agy:subprocess`；ARCH-001 的五个试点目标已由 SD-25～SD-27 调整：增加 agy，`copilot-cli:subprocess` 与 `kimi:subprocess` 为预留 |
| 命令 hooks 入口运行时 | Node.js；入口打包为 ES2022 ESM 单文件，只用 `node:` 内置模块；构建报告写明 Node 要求与解释器缺失时各宿主的默认行为 |
| 源配置加载 | Node 类型剥离直接导入 `uapa.config.ts`；只能使用可擦除语法，相对导入写明 `.ts` 扩展名 |
| 目标能力数据 | TypeScript 数据模块，类型为 `TargetCapabilities`，带宿主版本、核对日期与出处 |
| 产物布局 | 默认每个宿主一个插件目录，同一宿主的多个目标（如 Claude Code 的两种形态）写入同一目录；可选合并布局，多个宿主写入同一插件目录：同名文件内容必须逐字一致，否则构建失败；按命名空间合并 JSON（F-03-07）为预留。ARCH-001 的“每个目标一个目录”已由 SD-13 改为按宿主 |
| 发布形态 | main 不提交 `dist/`；发布提交含 `dist/` 并打 `vX.Y.Z` tag；0.x 期间次版本号可含不兼容变更 |
| 公共导出面 | 包入口 `uapa` 导出 `defineConfig` 与公共类型；命令 `uapa build` 与 `uapa build --check` |

## 1. 组成与模块

UAPA 是一个命令行包，没有长期运行的服务。一次构建的调用顺序：

1. `cli` 解析命令，调用 `config` 加载并校验 `uapa.config.ts`，再调用 `build`（模块接口 §8）。
2. `build` 调用 `source` 读取源项目的组件、frontmatter 与 `overrides/<宿主>/`（v0.1.0 的组件
   只有 skills），并导入守卫逻辑、读取守卫声明；读取失败时返回输入错误，不构建任何目标。
3. `build` 经 `src/capabilities/index.ts` 取得每个已配置目标的能力数据，检查组件承载、守卫
   能力与命令 hooks 声明的事件承载，得出跳过项、降级项与失败的目标。
4. `build` 经 `src/targets/index.ts` 按宿主调用 `targets/<host>`，只传入通过检查的目标。
   宿主模块生成 manifest 与 hooks 配置，经 `bundle` 把守卫逻辑、`runtime/core` 与该目标的
   入口源码打包为单文件；没有可靠宿主校验命令的宿主对生成的文件做字段白名单检查；返回文件
   列表，同一宿主的目标合成一套文件。
5. `build` 放置 skills，用 `overrides/<宿主>/` 覆盖同名文件，再按产物布局写出：合并布局下，
   同名文件必须逐字一致（按命名空间合并 JSON 为预留，F-03-07）。写出后，对提供宿主
   校验命令的宿主调用该命令。`--check` 模式只比对，不写文件，也不调用宿主校验命令。
6. `build` 按 `src/report/types.ts` 填充构建报告，写出 `<outDir>/uapa-report.json`（`--check`
   不写），并把结果返回 `cli`；`cli` 调用 `report` 的 `formatSummary` 打印摘要，按模块接口 §8
   设置退出码。

| 模块 | 职责 | 可以依赖 | 硬约束 |
|---|---|---|---|
| `cli` | 命令、参数、终端输出与退出码 | `config`、`build`、`report` | 构建器中只有它读取命令行参数、向终端输出与设置退出码；插件产物中的入口不受此限 |
| `config` | `defineConfig`、配置加载与校验、目标名与宿主标识 | zod | 校验失败给出文件与字段位置 |
| `source` | 读取源项目组件、覆盖目录与守卫声明 | `config`（类型与目标名列表）、`runtime/core` 的类型、yaml、zod | 只读，不写文件 |
| `build` | 能力检查、按宿主调用宿主模块、放置 skills 与覆盖文件、产物布局与合并、写出与比对、调用宿主校验、写出构建报告 | `config`、`source`、`runtime/core` 的类型、`capabilities`（只经 `src/capabilities/index.ts` 与 `types.ts`）、`targets`（只经 `src/targets/index.ts` 与 `src/targets/types.ts`）、`bundle`、`report` | 不包含宿主格式知识；守卫 `requires` 中的能力目标不具备时该目标失败，其余缺失按 [hooks 适配 §6](../research/coding-agent-plugin-manifests/uapa-hook-adapters.md#6-能力缺失时的处理) 降级或记为残余风险；只写入各宿主的插件目录与 `<outDir>/uapa-report.json`：默认布局写入前清空该宿主的插件目录，合并布局不删除目录中的其他文件；`--check` 模式不写文件 |
| `capabilities` | 各目标的能力数据 | `config` 与 `runtime/core` 的类型 | 只含数据；每个模块写明宿主版本、核对日期与出处 |
| `targets/<host>` | 生成一个宿主的产物文件；有可靠宿主校验命令的宿主实现 `verify`（v0.1.0 为 Claude Code），其余宿主在生成时做字段白名单检查 | `src/targets/types.ts`；`config`、`source`、`runtime/core`、`capabilities` 与 `bundle` 的类型；yaml | `generate` 不读写磁盘，文件交给 `build` 写出；只为传入的目标生成；能力数据只经 `TargetPlan` 取得；打包经 `build` 传入的函数调用 `bundle`；宿主模块之间互不引用 |
| `runtime/core` | 公共类型、目标数据类型、工具名换算、守卫返回值检查 | 无 | 不做 I/O，不引用 Node 类型，由 `tsconfig.runtime-core.json` 检查 |
| `runtime/entries` | 各目标的入口源码与决策输出 | `runtime/core`；打包时注入的 `uapa:guard` 与 `uapa:target-data`；子进程入口源码另用 `node:` 内置模块；`claude-code-in-process.ts` 另用 `'claude-code'` | `<宿主>-<形态>.ts` 之间互不导入；`claude-code-in-process.ts` 不导入 `subprocess.ts` 与 `node:` 模块，不引用 Node 全局（如 `process`、`Buffer`），与 `runtime/core` 一起由 `tsconfig.runtime-core.json` 检查；收口全部异常：执行前与提示提交前检查按拒绝输出，停机前检查不阻止结束，执行后检查按扣留输出 |
| `bundle` | 调用 rolldown；`src/bundle/types.ts` 定义打包请求 | rolldown；`runtime/core` 的类型 | 仓库中唯一调用打包器的模块；在内存中生成单文件，不写文件；产物不导入 npm 包 |
| `report` | 构建报告的类型与终端摘要文本 | 无 | 不读写文件；由 `build` 填充并写出；报告写入能力数据的核对日期 |

`src/targets/types.ts` 只引用 `config`、`source`、`runtime/core`、`capabilities` 与 `bundle` 的类型；
`src/targets/index.ts` 只导入各宿主模块。两者由功能模块 03 维护，宿主模块只导入 `types.ts`。

全局约束：

- 插件产物运行时零依赖，不附带 UAPA 运行时；宿主缺少的能力不在运行时模拟。
- 未知目标名在构建时失败；不在运行时按环境变量推断宿主。
- 生产依赖只有 rolldown、yaml、zod；新增生产依赖需更新本文与 ARCH-001 的取舍。

## 2. 目录结构

```text
uapa/
├── src/
│   ├── index.ts             公共导出
│   ├── cli/
│   ├── config/              含 targets.ts：目标名与宿主标识；layout.ts：插件目录解析
│   ├── source/              含 guard.ts：读取守卫声明
│   ├── build/
│   ├── capabilities/        types.ts、index.ts 与每个目标一个数据模块
│   ├── targets/             types.ts、index.ts 与 claude-code/、codex/、agy/
│   ├── runtime/
│   │   ├── core/
│   │   └── entries/         subprocess.ts、每个目标一个入口与打包时名称的类型声明
│   ├── bundle/              types.ts（打包请求）与 index.ts
│   └── report/
├── test/                    node:test 测试
│   └── fixtures/            源项目夹具与各目标的期望产物
├── scripts/                 发布与检查脚本；仓库中只有这里允许手写 .mjs
├── docs/
│   ├── architecture/        本文、模块接口、入口与打包接口、构建报告、命令 hooks 声明、选型文档
│   ├── feature-list/        功能清单
│   └── research/coding-agent-plugin-manifests/   宿主调研与设计提案
├── dist/                    只出现在发布提交中
├── package.json
├── tsconfig.json
├── tsconfig.runtime-core.json
├── biome.json
└── pnpm-lock.yaml
```

- 手写代码一律 TypeScript；测试文件命名为 `*.test.ts`，由 `node --test` 直接运行。
- 新增目标时：在 `src/config/targets.ts` 登记目标名（新宿主另登记宿主标识）；新宿主在
  `src/config/types.ts` 的 `hosts` 中加入该宿主的键（至少含 `dir`）及其选项的类型与校验；在
  `src/capabilities/<宿主>-<形态>.ts` 写能力数据并在 `src/capabilities/index.ts` 登记；在
  `src/runtime/entries/<宿主>-<形态>.ts` 写入口源码与该目标的决策输出；在 `src/targets/<宿主>/`
  写 manifest、hooks 配置与字段检查（宿主已有目录时复用），并在 `src/targets/index.ts` 登记；
  在 `test/fixtures/` 加期望产物。构建编排与守卫运行时的接口不变。

## 3. 分发与发布

- 使用方以固定 tag 的 devDependency 引用：`"uapa": "github:xumetide-dev/uapa#vX.Y.Z"`，不引用分支；
  锁文件记录 tag 对应的提交。解析 tag 需要本地 git；npm 12 需以 `allow-git` 放行 git 依赖。
- `package.json` 不写 `prepare`、`install`、`postinstall`；`files` 列出 `dist/`；`bin` 为 `uapa`。
  `dist/` 含 `runtime/` 的编译结果（构建插件时由 `bundle` 打包）与公共导出的类型声明。
- 发布：运行全部检查（类型检查、Biome、测试）后，发布脚本在 main 之上创建含 `dist/` 的发布提交
  并打 `vX.Y.Z` tag。main 不提交 `dist/`。
- 发布脚本 `scripts/release.ts` 在 main 上以 Node 24 运行：
  `node scripts/release.ts --node22 <Node 22.0.0 的可执行文件>`。依次执行：
  1. 前置检查：工作区干净、tag 未存在、两个 Node 的版本；
  2. `pnpm check`；
  3. TA-14；
  4. 编译 `dist/`：沿用 `tsconfig.json` 的编译选项，另开 `rewriteRelativeImportExtensions` 与
     `declaration`，输入为 `src/`；
  5. 经临时索引创建发布提交（父提交为 main，树为 main 的树加 `dist/`）并打 annotated tag；
  6. 安装冒烟（F-10-05）。

  脚本不推送，main 与暂存区不变。安装冒烟的安装命令为
  `pnpm install --config.strict-dep-builds=true --config.dangerously-allow-all-builds=false`：任何
  依赖的构建脚本未获放行即安装失败，与使用方的 pnpm 配置无关。冒烟失败时脚本删除本次创建的 tag。
- 不部署服务，不使用 K8s；暂不配置 CI，复议条件见 ARCH-001。
