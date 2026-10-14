# 施工单 M1-01：仓库骨架

> 建立包结构与本地检查入口，使 `pnpm check` 在空实现上通过（里程碑 M1）。之后每张工单都以
> `pnpm check` 为最低验收命令。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M1-00](M1-00-v0-1-0-three-host-build.md) |
| 覆盖功能点 | `F-10-01`、`F-10-03` |
| 依赖工单 | 无 |
| 关联 issue | 无 |
| 验收文件 | [M1-01](../acceptance/M1-01-repo-skeleton.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 完全没有：`package.json`、`pnpm-lock.yaml`、`tsconfig.json`、`tsconfig.runtime-core.json`、
  `biome.json`、`src/`、`test/`。
- 已有且够用：`scripts/check-feature-list.mjs`（零依赖，`node scripts/check-feature-list.mjs`
  通过）；`.gitignore` 已忽略 `node_modules/` 与 `dist/`。
- 现有脚本的风格：两空格缩进、单引号、不写分号、最长行 84 字符；Biome 配置按此设定，避免
  无关的格式改动。

## ⚠️ 关键落地约束（必须先验证）

- TypeScript 7.0 的 `tsc`：确认 `typescript@7.0.x` 提供 `tsc` 命令，支持 `-p <配置>`、`--noEmit`、
  `allowImportingTsExtensions` 与 `erasableSyntaxOnly`（源配置与入口源码只用可擦除语法）。
  不支持时停下报告，按 ARCH-001 的复议条件处理，不降级到其他编译器。
- pnpm 12：`package.json` 写 `packageManager: "pnpm@12.11.2"`；本机 pnpm 11.22.0 按该字段切换
  版本。安装时不得运行任何依赖的构建脚本（rolldown 与 Biome 以可选依赖分发平台二进制）。
- `node --test` 直接运行 `.ts` 测试文件依赖 Node 的类型剥离（构建器要求 Node ≥ 22.18）。
- `@types/node` 是类型检查 `node:` 模块所需的开发依赖，版本取 22.x，避免使用 Node 22 没有的 API；
  在验收 §6 记录。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 否 | |
| 产物零依赖 | 否 | |
| 不在运行时推断宿主 | 否 | |
| 确定性输出 | 否 | |
| 不越权写入 | 否 | |
| 安装不运行脚本 | 是 | `test/package.test.ts` 断言没有生命周期脚本、生产依赖只有 rolldown、yaml、zod；`pnpm install` 输出中没有执行构建脚本的记录 |
| 能力数据有出处 | 否 | |

## 任务

### 1. 包结构（F-10-03）

- `package.json`：`name` 为 `uapa`，`version` 为 `0.1.0`，`type` 为 `module`，`license` 为
  `Apache-2.0`；`bin.uapa` 指向 `./dist/cli/main.js`；`exports["."]` 写 `types`
  （`./dist/index.d.ts`）与 `default`（`./dist/index.js`）；`files` 为 `["dist/"]`；
  `engines.node` 为 `>=22.18`；`packageManager` 为 `pnpm@12.11.2`。
- 生产依赖 `rolldown`、`yaml`、`zod` 按 1.2.x、2.9.x、4.6.x 锁定次版本（`~`）；开发依赖
  `typescript` 7.0.x、`@biomejs/biome` 2.5.x、`@types/node` 22.x。
- 不写 `preinstall`、`install`、`postinstall`、`prepare`、`prepublish`、`prepublishOnly`、
  `prepack`、`postpack` 等生命周期脚本。

### 2. 检查入口（F-10-01）

- `tsconfig.json`：`strict`、`noEmit`、`module`/`moduleResolution` 为 `nodenext`、`target`
  `es2022`、`allowImportingTsExtensions`、`erasableSyntaxOnly`、`verbatimModuleSyntax`、
  `types: ["node"]`；包含 `src/`、`test/` 与 `scripts/*.ts`。
- `tsconfig.runtime-core.json`：继承 `tsconfig.json`，`types: []`，`lib: ["es2022"]`，只包含
  `src/runtime/core/`（M1-07 加入 `src/runtime/entries/claude-code-in-process.ts`）。
- 两套配置都需要至少一个输入文件：建立 `src/index.ts` 与 `src/runtime/core/types.ts` 两个空模块
  （只含 `export {}`），由 M1-02 填充。
- `biome.json`：格式化与 lint 覆盖 `src/`、`test/`、`scripts/`；两空格、单引号、按需分号与
  箭头函数括号、行宽 88；忽略 `docs/`、`dist/`、`node_modules/`。
- `package.json` 的 `scripts.check` 依次运行 `tsc -p tsconfig.json`、
  `tsc -p tsconfig.runtime-core.json`、`biome check`、`node --test "test/**/*.test.ts"`、
  `node scripts/check-feature-list.mjs`，任一失败即以非零退出码结束。

### 3. README 状态

- 仓库 README 的状态改为“实现中”，写明 `pnpm check` 为本地检查入口。

### 不改的地方（红线）

- `scripts/check-feature-list.mjs` 的检查规则不变，只允许 Biome 的格式化改动。
- `docs/feature-list/`、`docs/architecture/` 的内容不变。
- 不加入 CI 配置，不加入生命周期脚本。

### 测试

- `test/package.test.ts`：读取 `package.json`，断言 `scripts` 中没有上述生命周期脚本；
  `dependencies` 的键恰为 `rolldown`、`yaml`、`zod`；`bin.uapa`、`exports["."].types`、
  `files`、`engines.node`、`packageManager` 取上文的值。
- 故意在临时副本中加入 `postinstall` 时，该测试失败（在验收中手动验证一次，不提交）。

## 验收

```bash
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` 以退出码 0 结束；任一子命令失败时整体以非零退出码结束（在验收中把一条测试改为
失败验证一次，不提交）。

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 最终实现方案、关键技术决策及其验证依据；
3. 主要改动点与涉及模块清单；
4. 测试覆盖、宿主实测结果、判断范围（夹具与单元测试 / 宿主实测）和已知限制；
5. 如适用，附生成的 manifest、hooks 配置或入口的输入输出示例。

## 边界

- 允许新增：`package.json`、`pnpm-lock.yaml`、`tsconfig.json`、`tsconfig.runtime-core.json`、
  `biome.json`、`src/index.ts`、`src/runtime/core/types.ts`、`test/package.test.ts`；修改
  `README.md` 的状态一节。
- 禁止修改：`docs/` 下除本 Sprint 文档外的文件。

## 依赖

无。
