# UAPA 架构

| 项 | 内容 |
|---|---|
| 选型依据 | [ARCH-001](ARCH-001-agent-plugin-build-tool.md) |
| 更新日期 | 2026-10-14 |
| 变更记录 | 无 |

本文是 UAPA 的权威架构文档：由哪些模块组成、模块之间的依赖方向、各层的硬约束、目录与发布方式。
选型理由与被否决的方案见 [ARCH-001](ARCH-001-agent-plugin-build-tool.md)；构建流程、目标列表与
hooks 适配见 [设计提案](../research/coding-agent-plugin-manifests/unified-agent-plugin-architecture.md)
与 [hooks 适配](../research/coding-agent-plugin-manifests/uapa-hook-adapters.md)。

## 0. 技术选型总览

| 层 | 选型 | 版本 | 依赖类别 |
|---|---|---|---|
| 语言 | TypeScript | 7.0.x | 开发 |
| 运行时 | Node.js | 构建器 ≥ 22.18；生成的入口声明支持 ≥ 22 | 环境 |
| 打包 | rolldown | 1.2.x | 生产 |
| YAML | yaml | 2.9.x | 生产 |
| 输入校验 | zod | 4.6.x | 生产 |
| 命令行解析 | `util.parseArgs` | Node 内置 | 无 |
| 测试 | `node:test` | Node 内置 | 无 |
| 格式与检查 | Biome | 2.5.x | 开发 |
| 包管理 | pnpm | 12.x | 开发 |

| 冻结项 | 结论 |
|---|---|
| 首批目标 | v0.1.0 为 `claude-code:in-process`、`claude-code:subprocess`、`codex:subprocess`、`copilot-cli:subprocess`、`kimi:subprocess` |
| 命令 hooks 入口运行时 | Node.js；入口打包为 ES2022 ESM 单文件，只用 `node:` 内置模块；构建报告写明 Node 要求与解释器缺失时各宿主的默认行为 |
| 源配置加载 | Node 类型剥离直接导入 `uapa.config.ts`；只能使用可擦除语法，相对导入写明 `.ts` 扩展名 |
| 目标能力数据 | TypeScript 数据模块，类型为 `TargetCapabilities`，带宿主版本、核对日期与出处 |
| 产物布局 | 默认每个目标一个目录；可选合并布局，多个目标写入同一插件目录，同名文件内容必须逐字一致，否则构建失败 |
| 发布形态 | main 不提交 `dist/`；发布提交含 `dist/` 并打 `vX.Y.Z` tag；0.x 期间次版本号可含不兼容变更 |
| 公共导出面 | 包入口 `uapa` 导出 `defineConfig` 与公共类型；命令 `uapa build` 与 `uapa build --check` |

## 1. 组成与模块

UAPA 是一个命令行包，没有长期运行的服务。一次构建的调用顺序：

1. `cli` 解析命令，调用 `config` 加载并校验 `uapa.config.ts`。
2. `source` 读取源项目的 skills、MCP、rules、agents、commands 与 frontmatter。
3. 对每个目标：`targets/<host>` 读取 `capabilities` 中的能力数据，检查组件与守卫能力，生成
   manifest、组件文件与 hooks 配置；`bundle` 把守卫逻辑、`runtime/core` 与该目标的
   `runtime/entries` 打包为单文件入口；随后校验产物。
4. `report` 汇总各目标的产物、跳过项、降级项与残余风险。`--check` 模式只比对不写入。

| 模块 | 职责 | 可以依赖 | 硬约束 |
|---|---|---|---|
| `cli` | 命令、参数与退出码 | `config`、`source`、`targets`、`report` | 只有它读取命令行参数与设置退出码 |
| `config` | `defineConfig`、配置加载与校验 | zod | 校验失败给出文件与字段位置 |
| `source` | 读取源项目组件 | yaml、zod | 只读，不写文件 |
| `capabilities` | 各目标的能力数据 | `runtime/core` 的类型 | 只含数据；每个模块写明宿主版本、核对日期与出处 |
| `targets/<host>` | 生成与校验一个宿主的产物 | `capabilities`、`source`、`bundle`、yaml | 一个目标失败不影响其他目标；能力缺失且未声明降级时失败 |
| `runtime/core` | 公共类型、工具名换算、决策换算 | 无 | 不做 I/O，不引用 Node 类型，由 `tsconfig.runtime-core.json` 检查 |
| `runtime/entries` | 各目标的入口 | `runtime/core`；子进程入口另用 `node:` 内置模块；Claude Code 模块入口另用 `'claude-code'` | 收口全部异常：执行前检查按拒绝输出，执行后检查按扣留输出 |
| `bundle` | 调用 rolldown | rolldown | 仓库中唯一调用打包器的模块；产物为单文件，不导入 npm 包 |
| `report` | 构建报告 | 无 | 报告写入能力数据的核对日期 |

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
│   ├── config/
│   ├── source/
│   ├── capabilities/
│   ├── targets/             claude-code/、codex/、copilot-cli/、kimi/
│   ├── runtime/
│   │   ├── core/
│   │   └── entries/
│   ├── bundle/
│   └── report/
├── test/                    node:test 测试
│   └── fixtures/            源项目夹具与各目标的期望产物
├── scripts/                 发布脚本；仓库中只有这里允许手写 .mjs
├── docs/
│   ├── architecture/        本文与选型文档
│   └── research/coding-agent-plugin-manifests/   宿主调研与设计提案
├── dist/                    只出现在发布提交中
├── package.json
├── tsconfig.json
├── tsconfig.runtime-core.json
├── biome.json
└── pnpm-lock.yaml
```

- 手写代码一律 TypeScript；测试文件命名为 `*.test.ts`，由 `node --test` 直接运行。
- 新增目标时在 `src/targets/` 与 `src/capabilities/` 各加一项，并在 `test/fixtures/` 加期望产物。

## 3. 分发与发布

- 使用方以固定 tag 的 devDependency 引用：`"uapa": "github:xumetide-dev/uapa#vX.Y.Z"`，不引用分支；
  锁文件记录 tag 对应的提交。解析 tag 需要本地 git；npm 12 需以 `allow-git` 放行 git 依赖。
- `package.json` 不写 `prepare`、`install`、`postinstall`；`files` 列出 `dist/`；`bin` 为 `uapa`。
- 发布：运行全部检查（类型检查、Biome、测试）后，发布脚本在 main 之上创建含 `dist/` 的发布提交
  并打 `vX.Y.Z` tag。main 不提交 `dist/`。
- 不部署服务，不使用 K8s；暂不配置 CI，复议条件见 ARCH-001。
