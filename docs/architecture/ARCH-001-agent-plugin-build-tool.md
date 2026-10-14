# ARCH-001: 编码代理插件构建工具技术选型（Agent Plugin Build Tool Tech Selection）

| 项 | 内容 |
|---|---|
| 状态 | accepted |
| 日期 | 2026-10-14 |
| 需求来源 | 口头：把 [设计提案](../research/coding-agent-plugin-manifests/unified-agent-plugin-architecture.md) 落为可发布的构建工具；首版覆盖首个使用方试点插件所用的宿主 |
| 项目规模 | small |
| 分发形态 | git tag（GitHub 公共仓库，tag 提交含构建后的 JS），不经 registry |
| K8s | no |
| 取代 / 被取代 | 无 |
| 回填目标 | architecture.md §0 §1 §2 §3 |

本文回答 UAPA 用什么语言与依赖实现、仓库怎么组织、怎么分发，以及否决了什么、什么条件下复议。
构建流程、目标列表与 hooks 适配的设计见 [设计提案](../research/coding-agent-plugin-manifests/unified-agent-plugin-architecture.md)
与 [hooks 适配](../research/coding-agent-plugin-manifests/uapa-hook-adapters.md)。

## 输入与约束

- 用户：插件作者。在自己的仓库里维护一份插件源项目，用 UAPA 构建各宿主的插件包。首个使用方是
  pnpm 管理、Node ≥ 22、ESM 的仓库，本身没有 npm 依赖；其试点插件手写了 Claude Code、Codex、
  Copilot CLI、Kimi Code 的 manifest 与命令 hooks（`UserPromptSubmit`、`PreToolUse`、`Stop`），
  四个宿主共用一个插件目录。
- 团队与既有栈：一名维护者加 AI 代理，使用 Node.js 与 TypeScript。按正式项目建设：手写代码一律
  TypeScript，`.mjs` 只用于明确的工具脚本。
- 时限与预算：无硬时限。预算为零：GitHub 公共仓库，暂不配 CI。
- 分发：使用方以固定到 git tag 的 devDependency 引用（`github:xumetide-dev/uapa#vX.Y.Z`），不经
  npm registry；tag 提交包含构建后的 JS，安装时不运行任何脚本。
- 产物：插件产物运行时零依赖，不附带 UAPA 运行时；Claude Code hooks 模块只能导入相对路径文件与
  `'claude-code'`。
- 运行环境：同一份守卫逻辑运行在 Claude Code hooks 模块环境（没有 Node）与各宿主命令 hooks 的
  Node 子进程中；后续目标还有 Bun 进程内（OpenCode）与 Node 进程内（DSH）。
- 安全语义：多数宿主在 hook 进程启动失败、崩溃或超时时放行（[hooks 适配 §7](../research/coding-agent-plugin-manifests/uapa-hook-adapters.md#7-失败处理)），
  守卫失效对用户不可见。
- 宿主变化：宿主频繁发版，hooks 字段与默认行为随版本变化。

## 端拆分

| 端 | 形态 | 面向谁 | 为什么单独一个端 | 模块 |
|---|---|---|---|---|
| uapa | cli | 插件作者，在其仓库中以 devDependency 运行 | 唯一的构建与发布单元：命令行、公共类型与打包进产物的运行时代码同版本发布 | cli, config, source, capabilities, targets, runtime-core, runtime-entries, bundle, report |

- 运行时代码（`runtime-core`、`runtime-entries`）与构建器的运行环境不同，但不单独发布：构建插件时
  它与插件作者的守卫逻辑一起打包进各目标产物。决策换算与能力数据成对变化，分开发布会出现版本错配。
- 不拆出公共类型包：守卫逻辑以 `import type` 引用公共类型，打包时擦除，构建器不会进入产物。

### 模块组织

```text
src/
├── index.ts        公共导出：defineConfig 与公共类型
├── cli/            命令行：build 与 build --check，参数解析与退出码
├── config/         defineConfig、加载 uapa.config.ts、配置校验
├── source/         读取源项目：skills、mcp、rules、agents、commands 与 frontmatter
├── capabilities/   目标能力数据：每个目标一个数据模块，带宿主版本、核对日期与出处
├── targets/        每个宿主一个子目录：manifest 生成、组件换算、hooks 配置、产物校验
│   ├── claude-code/
│   ├── codex/
│   ├── copilot-cli/
│   └── kimi/
├── runtime/        打包进产物、在宿主中运行的代码
│   ├── core/       公共类型、工具名换算、决策换算；不做 I/O，不引用 Node 类型
│   └── entries/    各目标入口：读取宿主输入、调用守卫逻辑、按宿主协议输出、收口异常
├── bundle/         打包适配层：仓库中唯一直接调用打包器的位置
└── report/         构建报告
```

## 目录结构

**仓库形态**：单包仓库（pnpm，无 workspace）—— 使用方以 git tag 安装，包管理器默认安装仓库根目录
的包；引用子目录包在 pnpm 需要 `path:` 参数，npm 文档未记载。一名维护者、同一发布节奏，拆包没有收益。

```text
uapa/
├── src/                     见「模块组织」
├── test/                    node:test 测试
│   └── fixtures/            源项目夹具与各目标的期望产物
├── scripts/                 明确的工具脚本（发布）；仓库中只有这里允许手写 .mjs
├── docs/
│   ├── architecture/        选型文档与权威架构文档
│   └── research/coding-agent-plugin-manifests/   宿主调研与设计提案
├── dist/                    只出现在发布 tag 的提交中：编译后的 JS 与类型声明
├── package.json             bin、exports、engines；不含任何生命周期脚本
├── tsconfig.json            构建器与入口代码
├── tsconfig.runtime-core.json   单独检查 src/runtime/core/：不含 Node 类型
├── biome.json
└── pnpm-lock.yaml
```

- `src/`：构建器与运行时代码，全部 TypeScript。`runtime/core/` 只依赖语言内置对象，由
  `tsconfig.runtime-core.json`（`types: []`、`lib: ["ES2022"]`）检查，误用 Node API 时类型检查失败。
- `test/`：守卫逻辑、工具名与决策换算的单元测试；各目标对夹具构建后与期望产物逐字比对。
- `scripts/`：发布脚本。生成 `dist/`、在 main 之上创建发布提交并打 tag；不推送。
- `dist/`：main 上不提交；`.gitignore` 忽略，发布脚本强制加入发布提交。
- `package.json`：不写 `prepare`、`install`、`postinstall`。git 依赖含这类脚本时，npm 会为它安装
  devDependencies 并完整构建；pnpm 自 10.26 起要求使用方以 `allowBuilds` 放行，否则安装失败。
  `files` 字段列出 `dist/`，安装时生效。

## 分发方式

| 候选 | 类型 | 免费额度 / 成本 | 硬限制 | 判定 |
|---|---|---|---|---|
| GitHub 公共仓库 git tag，tag 提交含 `dist/` | paas-free | 免费 | 只能固定到 tag，没有版本范围解析；解析 tag 需要本地 git；npm 12 默认禁止 git 依赖，需以 `allow-git` 放行 | adopt |
| npm 公共 registry | paas-free | 免费 | 需维护 npm 账号与发布凭据；目前只有一个使用方，版本范围解析用不上 | reject |
| GitHub Packages（npm） | paas-free | 公共包免费 | 安装公共包也需要认证令牌 | reject |
| git 子模块，或复制进使用方仓库 | local | 无 | git 文档说明子模块对同一仓库多 worktree 的支持不完整；复制没有版本记录 | reject |

> **结论**：git tag —— 零成本、无需发布凭据，锁文件记录 tag 对应的提交与归档地址，满足单一使用方的固定版本引用。

## K8s 判定

| 判据 | 本项目 |
|---|---|
| 长期运行的服务 ≥ 5 个且需独立伸缩 | 否 |
| 有 SLA 承诺，需多副本与滚动发布 | 否 |
| 多租户 / ≥3 套环境隔离 | 否 |
| 团队已有人在运维 K8s | 否 |
| 已有集群可复用 | 否 |
| 合规要求 GitOps 审计发布 | 否 |

> **结论**：no —— UAPA 是构建期命令行工具，没有长期运行的服务。

复议条件：提供在线构建服务时复议。

## 语言与框架

| 端 / 层 | 语言 | 框架 | TypeScript | 理由 |
|---|---|---|---|---|
| uapa（构建器） | TypeScript，运行于 Node.js ≥ 22.18 | 无框架：Node 内置模块加打包器 | yes | 源配置 `uapa.config.ts` 与守卫逻辑都是 TypeScript，构建器与它们共享公共类型；使用方是 Node 与 pnpm 仓库 |
| runtime-core（打包进产物） | TypeScript，编译为 ES2022 | 无 | yes | 同一份代码运行于 Claude Code hooks 模块环境与 Node 子进程，只能用语言内置对象 |
| runtime-entries（命令 hooks 入口） | TypeScript，打包为 ES2022 ESM 单文件 | 无，只用 `node:` 内置模块 | yes | 维护者决定以 Node 作为命令 hooks 的解释器；产物中的 `.mjs` 是编译结果，不手写 |

## 技术栈

| 层 | 技术项 | 来源 | 版本 | 许可证 | 最近发布 | 维护状态 | 成熟度 | 判定 | 替换成本 |
|---|---|---|---|---|---|---|---|---|---|
| 语言 | TypeScript | npm:typescript | 7.0.x | Apache-2.0 | 2026-07-08 | active | Microsoft 维护；7.0 为原生编译器，2026-07-08 正式发布，输出 JS 与声明文件 | adopt | 只用 `tsc` 命令行做类型检查与编译；7.0 没有稳定的编程 API，本项目不依赖它 |
| 运行时 | Node.js | github:nodejs/node | ≥ 22.18，开发用 24 | MIT | 2026-10-07 | active | OpenJS 基金会；22 维护期至 2027-04-30，24 至 2028-04-30 | adopt | 不适用 |
| 打包 | rolldown | npm:rolldown | 1.2.x | MIT | 2026-10-07 | active | Vite 8 的打包器；1.0 于 2026-05-07 发布，1.x API 锁定；维护方 VoidZero 已并入 Cloudflare；周下载约 1.1 亿；2 个零依赖的依赖，无安装脚本 | adopt | 只在 `src/bundle/` 调用，更换只改该目录 |
| 打包 | esbuild | npm:esbuild | 0.28.x | MIT | 2026-08-08 | active | 周下载约 3 亿，采用面广；近一年提交几乎全部来自一人；带 postinstall 脚本 | reject | 同上 |
| YAML | yaml | npm:yaml | 2.9.x | ISC | 2026-09-11 | active | 2011 年起维护；支持 YAML 1.1 与 1.2，通过 yaml-test-suite，保留注释；0 个依赖；实际一名维护者 | adopt | 只在 `source/` 与 `targets/` 读写 |
| YAML | js-yaml | npm:js-yaml | 5.4.x | MIT | 2026-10-05 | active | 采用面广；1 个依赖；5.4.0 以次版本号改变输出格式 | reject | 同上 |
| 输入校验 | zod | npm:zod | 4.6.x | MIT | 2026-10-12 | active | 周下载约 3.5 亿；内置 JSON Schema 导出与可读错误格式；0 个依赖；npm 上一名维护者 | adopt | 只在 `config/` 与 `source/`，schema 同时给出类型 |
| 输入校验 | valibot | npm:valibot | 1.5.x | MIT | 2026-09-09 | active | 1.0 于 2025-03-19 发布；周下载约 2250 万；JSON Schema 导出需另装包；0 个依赖 | reject | 同上 |
| 命令行解析 | `util.parseArgs` | github:nodejs/node | Node 内置 | MIT | 2026-10-07 | active | Node 内置，v20.0.0 起稳定 | adopt | 只有 `cli/` 使用 |
| 测试 | `node:test` | github:nodejs/node | Node 内置 | MIT | 2026-10-07 | active | Node 内置；默认匹配 `*.test.ts`，由类型剥离直接运行；快照断言自 22.13 稳定 | adopt | 测试改写成本随用例数增长 |
| 格式与检查 | Biome | npm:@biomejs/biome | 2.5.x | MIT OR Apache-2.0 | 2026-09-30 | active | 格式化与 Prettier 约 97% 兼容；检查规则不依赖 TypeScript 编译器 API；0 个依赖，无安装脚本 | adopt | 只影响开发流程 |
| 包管理 | pnpm | npm:pnpm | 12.x | MIT | 2026-10-09 | active | 首个使用方同样使用 pnpm | adopt | 换包管理器只改锁文件 |

- 生产依赖只有 rolldown、yaml、zod 三项；其余为开发依赖，使用方安装 git 依赖时不会安装。
- rolldown 以 `rolldown()` 加 `generate()` 调用（`build()` 仍标为实验性），显式设置
  `transform.target: 'es2022'`（默认 `esnext`，且不读取 tsconfig）与 `codeSplitting: false`。

## 领域专项

| 考量 | 本项目约束 | 对选型的影响 |
|---|---|---|
| 守卫失效的可见性 | 多数宿主在 hook 进程无法启动、崩溃或超时时放行 | 入口必须是不导入 npm 包的单文件，缺模块即启动失败；入口统一收口异常并按拒绝或扣留输出；能力缺失在构建时报错 |
| 宿主版本漂移 | 宿主频繁发版，字段与默认行为随版本变化 | 能力数据与构建器代码分离，写成带类型的 TypeScript 数据模块，由类型检查保证字段齐全 |
| 安装面与供应链 | 使用方以 devDependency 安装 UAPA 及其传递依赖，使用方自身没有 npm 依赖 | 生产依赖限三项且无安装脚本；命令行解析与测试用 Node 内置；不写生命周期脚本 |
| 运行环境差异 | 守卫逻辑运行于没有 Node 的模块环境与 Node 子进程 | `runtime/core/` 单独做类型检查；打包时按目标选择平台与外部模块 |

## 实现前冻结项

| 冻结项 | 结论 | 状态 | 依据 / 负责人 |
|---|---|---|---|
| 首批目标 | v0.1.0 为 `claude-code:in-process`、`claude-code:subprocess`、`codex:subprocess`、`copilot-cli:subprocess`、`kimi:subprocess` | 已冻结 | 维护者，2026-10-14 |
| 命令 hooks 入口运行时 | Node.js。入口由 TypeScript 打包为 ES2022 ESM 单文件，只用 `node:` 内置模块；声明支持 Node ≥ 22，构建报告写明该要求与解释器缺失时各宿主的默认行为；不做单文件可执行程序 | 已冻结 | 维护者，2026-10-14 |
| 构建器运行环境 | Node.js ≥ 22.18 | 已冻结 | 本文「技术栈」：该版本起 22.x 默认启用类型剥离 |
| 源配置加载 | 由 Node 类型剥离直接导入 `uapa.config.ts`；配置及其导入的本地文件只能使用可擦除的 TypeScript 语法，相对导入写明 `.ts` 扩展名 | 已冻结 | 本文「被否决的方案」 |
| 目标能力数据格式 | TypeScript 数据模块，类型为 `TargetCapabilities`，每个模块带宿主版本、核对日期与出处；取代设计提案第 8 节的 YAML 示意 | 已冻结 | 本文「领域专项」 |
| 产物布局 | 默认每个目标一个目录；可选合并布局：多个目标写入同一插件目录，同名文件内容必须逐字一致，否则构建失败 | 已冻结 | 维护者，2026-10-14；首个使用方的四个宿主共用一个插件目录 |
| 发布形态 | main 不提交 `dist/`；发布脚本在 main 之上生成含 `dist/` 的发布提交并打 `vX.Y.Z` tag；0.x 期间次版本号可含不兼容变更，变更写入发布说明 | 已冻结 | 本文「分发方式」 |
| 公共导出面 | 包入口 `uapa` 导出 `defineConfig` 与公共类型；命令 `uapa build`（生成）与 `uapa build --check`（只比对不写入，有差异时以非零退出码结束） | 已冻结 | 本文；`--check` 供使用方在门禁中比对已提交的产物 |

## 被否决的方案

| 方案 | 否决理由 | 重新考虑的条件 |
|---|---|---|
| Go 或 Rust 编写的单二进制构建工具 | 使用方以 npm 包管理器引用，二进制需按平台分包或安装脚本；源配置与守卫逻辑都是 TypeScript，需要共享类型 | 使用方不再是 Node 项目，或构建耗时成为瓶颈 |
| 多包仓库（公共类型、构建器、各目标分包） | git 依赖默认只安装仓库根目录的包；运行时与构建器必须同版本 | 改为经 registry 发布，或外部使用方只需要部分目标 |
| npm 公共 registry 发布 | 当前只有一个使用方，固定 tag 已满足；registry 需维护发布凭据 | 出现第二个外部使用方，或需要版本范围解析 |
| 单文件可执行程序作为命令 hooks 入口 | 每个系统与架构各需一份，体积大，macOS 需签名；维护者选定 Node | 使用方的最终用户普遍没有 Node，或出现守卫因缺少解释器失效的报告 |
| esbuild | 带 postinstall 脚本：pnpm 11 起默认在依赖的构建脚本未获放行时安装失败，作为传递依赖同样触发；0.x 版本号，近一年提交几乎全部来自一人 | esbuild 移除 postinstall，且 rolldown 出现阻断性缺陷或停止维护 |
| js-yaml | 多 1 个传递依赖；5.4.0 以次版本号改变输出格式，生成文件的 diff 不稳定 | yaml 停止维护 |
| valibot | 采用面小于 zod；JSON Schema 导出需另装包；本项目对包体积不敏感 | zod 出现不兼容的大版本或停止维护 |
| ajv 与 JSON Schema | 输入格式以 TypeScript 类型为源，JSON Schema 需另维护一份；4 个依赖 | 需要发布源配置的 JSON Schema 供编辑器补全 |
| commander、cac | 只有一个命令，`util.parseArgs` 已够用 | 命令超过 3 个，或需要子命令帮助生成 |
| vitest | 依赖多；`node:test` 已覆盖单元测试与快照 | 需要浏览器环境或大量模块替身 |
| ESLint 加 Prettier | 两套工具与插件，依赖多；Biome 一项覆盖格式与检查 | 需要 Biome 不支持的检查规则 |
| jiti、tsx 加载配置 | Node ≥ 22.18 已能直接导入 TypeScript 配置，不再增加加载器 | 配置需要使用不可擦除的语法 |
| 打包器把配置编译为临时 `.mjs` 后导入 | 临时文件须写在配置旁才能解析包名导入，在只读目录与沙箱构建中失败；增加缓存与调试映射的处理 | 配置需要使用不可擦除的语法，且 jiti 等加载器也不适用 |
| YAML 写能力数据（设计提案第 8 节示意） | 需要解析器，字段缺失只能在运行时发现 | 能力数据改由非 TypeScript 工具链维护 |
| GitHub Actions CI | 公共仓库的标准托管 runner 免费，但维护者决定暂不配置；本地运行检查 | 出现外部贡献者，或发布前需在多个 Node 版本上验证 |
| 首版覆盖设计提案的全部十个目标 | 首个使用方只用到五个目标；其余目标没有比对基准 | 首版在使用方完成切换后，按目标逐个增加 |

## 风险与待确认

| # | 事项 | 状态 | 影响章节 |
|---|---|---|---|
| 1 | 试点插件在 `UserPromptSubmit` 上检查提示内容，公共类型没有对应入口 | 待确认 | 公共导出面 |
| 2 | 合并布局下 `hooks/hooks.json` 被多个宿主共读；加入 `claude-code:in-process` 后该文件含 `modules` 键，Codex 与 Copilot CLI 对未知顶层键的处理未实测 | 待确认 | 产物布局 |
| 3 | Claude Code 双形态去重依赖 2.1.296 的本地实测，宿主升级可能改变行为 | 待确认 | 端拆分 |
| 4 | 不配 CI，回归只在本地运行；发布脚本须先运行全部检查 | 已接受 | 分发方式 |
| 5 | 单一维护者 | 已接受 | 输入与约束 |
| 6 | rolldown 1.x 发布时间较短；同一进程内反复调用打包时内存持续增长（rolldown#10984，未关闭）；一次构建只打包少数入口，影响有限 | 已接受 | 技术栈 |
| 7 | zod、yaml 实际各只有一名维护者 | 已接受 | 技术栈 |

## 回填清单

| 本文章节 | architecture.md 章节 | 状态 |
|---|---|---|
| 技术栈、实现前冻结项 | §0 技术选型总览 | 已回填 |
| 端拆分、语言与框架 | §1 组成与模块 | 已回填 |
| 目录结构 | §2 目录结构 | 已回填 |
| 分发方式、K8s 判定 | §3 分发与发布 | 已回填 |
