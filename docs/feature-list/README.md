# UAPA 功能清单

本目录列出 UAPA 各版本交付的软件功能，按模块分文件。每个功能有唯一编号、阶段、子模块、验收
标准与依赖，并由 [用户故事](stories.md) 或 [技术验收](technical-acceptance.md) 承接；取舍记录在
[范围决策](scope-decisions.md)。技术约束见 [架构](../architecture/architecture.md)，构建流程与 hooks
适配见 [设计提案](../research/coding-agent-plugin-manifests/unified-agent-plugin-architecture.md) 与
[hooks 适配](../research/coding-agent-plugin-manifests/uapa-hook-adapters.md)。本清单不含估时。

## 阶段

| 阶段 | 范围 |
|---|---|
| v0.1.0 | 五个目标：`claude-code:in-process`、`claude-code:subprocess`、`codex:subprocess`、`copilot-cli:subprocess`、`kimi:subprocess`；组件只含 skills 与守卫 hooks；守卫检查含执行前、提示提交前与停机前 |
| v0.2.0 | 同一批目标补全 agents、MCP 服务器与执行后检查 |

其余目标与组件的安排见 [SD-01、SD-02](scope-decisions.md)。

## 端

全部功能落在同一个端：`uapa` 命令行（[ARCH-001](../architecture/ARCH-001-agent-plugin-build-tool.md)）。
打包进插件产物的运行时代码随命令行包发布，不单列端。

## 模块

| 编号 | 模块 | 职责 | 代码位置 |
|---|---|---|---|
| 01 | [源项目与配置](modules/01-source-config.md) | 构建配置、组件读取、目标覆盖目录 | `src/config/`、`src/source/` |
| 02 | [守卫接口](modules/02-guard-api.md) | 守卫公共类型；构建时读取守卫声明 | `src/index.ts`、`src/runtime/core/` |
| 03 | [构建编排](modules/03-build.md) | 能力检查、逐目标构建、组件放置、产物布局与合并、比对、构建报告 | `src/build/`、`src/capabilities/types.ts`、`src/report/` |
| 04 | [守卫运行时](modules/04-guard-runtime.md) | 工具名与入参换算、子进程入口的公共部分、打包 | `src/runtime/`、`src/bundle/` |
| 05 | [Claude Code 目标](modules/05-claude-code.md) | 两种形态的能力数据、manifest、hooks 配置、入口；两种形态合为一个插件包并去重 | `src/targets/claude-code/` |
| 06 | [Codex 目标](modules/06-codex.md) | 能力数据、`$schema` 格式 manifest、hooks 配置与入口 | `src/targets/codex/` |
| 07 | [Copilot CLI 目标](modules/07-copilot-cli.md) | 能力数据、`$schema` 格式 manifest、hooks 配置与入口 | `src/targets/copilot-cli/` |
| 08 | [Kimi Code 目标](modules/08-kimi-code.md) | 能力数据、`kimi.plugin.json`、hook 规则与入口 | `src/targets/kimi/` |
| 09 | [命令行](modules/09-cli.md) | 命令、参数与退出码 | `src/cli/` |
| 10 | [仓库工程与发布](modules/10-repo-release.md) | 本地检查、测试夹具、包结构、发布与安装冒烟 | `scripts/`、`test/fixtures/`、`package.json` |

宿主模块（05～08）各自的能力数据放在 `src/capabilities/`，入口放在 `src/runtime/entries/`。

### 划分原则

- **宿主无关模块与宿主模块分开。** 01～04、09～10 不包含任何宿主的格式知识；每个宿主一个模块，
  负责该宿主的能力数据、manifest、hooks 配置、入口的决策输出与产物校验。
- **依赖只指向宿主无关模块。** 宿主模块依赖 01～04；构建编排通过宿主模块提交的文件列表工作，
  不引用具体宿主。共用文件（如 Codex 与 Copilot CLI 的根 `plugin.json`）由宿主模块声明为可合并，
  由构建编排按命名空间合并。
- **新增目标只新增一个宿主模块。** 新目标需要能力数据、manifest 与 hooks 生成、入口与产物校验，
  不修改宿主无关模块的接口；需要新的守卫能力时先扩展 02 的公共类型。
- **阶段内依赖不跨到后续阶段。** v0.1.0 的功能不依赖 v0.2.0 的功能。

## 编号

- 功能编号为 `F-XX-NN`，`XX` 是模块编号，`NN` 在模块内递增；编号一经分配不复用。
- 角色为 `P-NN`，用户故事为 `US-NN`，技术验收为 `TA-NN`，范围决策为 `SD-NN`。

## 检查

编号、依赖与承接关系由脚本检查：编号格式与唯一性、依赖存在且无环、v0.1.0 不依赖 v0.2.0、
故事与技术验收的引用存在、每个功能至少被一条故事或技术验收承接。该检查是 `pnpm check` 的一步（F-10-01）。

```bash
node scripts/check-feature-list.mjs
```
