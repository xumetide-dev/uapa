# 验收 M1-01：仓库骨架

> 本文记录 M1-01 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M1-01](../workorders/M1-01-repo-skeleton.md) |
| 覆盖功能点 | `F-10-01`、`F-10-03`（取自总览「工单构成」表） |
| 验收日期 | 2026-10-14 |
| 验收结论 | 通过 |
| 判断范围 | 不涉及宿主行为判断 |
| commit | ca5a61e |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | 提交 ca5a61e 不含守卫运行时与入口：`src/` 只有两个 `export {}` 模块 |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | 本单不生成插件产物；`test/package.test.ts` 断言生产依赖恰为 rolldown、yaml、zod |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | 本单没有构建与写出代码 |
| V4 | 能力数据含无出处的宿主行为 | 否 | 本单没有能力数据模块（`src/capabilities/` 不存在） |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：安装不运行脚本 | `test/package.test.ts` 断言没有生命周期脚本、生产依赖只有 rolldown、yaml、zod；`pnpm install` 输出中没有执行构建脚本的记录 | 3 pass / 0 fail；`pnpm install` 输出只有解析、下载与 `Packages: +12`，没有运行或忽略构建脚本的提示；临时副本加入 `postinstall` 后 2 pass / 1 fail（失败项为“package.json 不含生命周期脚本”） | `node --test test/package.test.ts`；临时副本未提交 | ✅ |
| 2 | 关键落地约束：TypeScript 7 的 `tsc` 支持两套配置与本单用到的选项 | `-p` 两套配置、`noEmit`、`allowImportingTsExtensions`、`erasableSyntaxOnly` 可用；不可擦除语法与 runtime-core 中的 Node API 报错 | `tsc --version` 为 7.0.2；两套配置在仓库中均无输出通过；临时目录中 `enum` 报 TS1294（`erasableSyntaxOnly`），runtime-core 配置中引用 `process` 报 TS2591 | `pnpm check` 输出；临时目录的 `tsc -p` 输出 | ✅ |
| 3 | 关键落地约束：pnpm 按 `packageManager` 切换版本，安装不运行依赖的构建脚本 | 本机 pnpm 11.22.0 切换到 12.11.2 | corepack 下载 pnpm 12.11.2，`pnpm --version` 输出 12.11.2；锁文件 `packageManagerDependencies` 记录 12.11.2；rolldown、Biome、TypeScript 以平台二进制可选依赖安装，无构建脚本 | `pnpm install` 输出；`pnpm-lock.yaml` 第 8～11 行 | ✅ |
| 4 | 任一子命令失败时 `pnpm check` 以非零退出码结束 | 退出码非 0 | 临时加入一个断言失败的测试文件后 `pnpm check` 退出码为 1；删除后为 0 | 本机运行记录；测试文件未提交 | ✅ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-10-01` | 本地检查入口 | `pnpm check` 依次运行两套 `tsc` 配置、Biome、`node --test` 与功能清单关系检查，任一失败即以非零退出码结束 | ✅ | `package.json` 的 `scripts.check` 以 `&&` 串联五个命令；`pnpm check` 退出码 0（Biome 检查 5 个文件，测试 3 pass，关系检查 93 个功能通过）；§1 第 4 行 |
| `F-10-03` | 包入口与安装面 | `package.json` 声明 `bin`、`exports`（写明 `types`）、`files`、`engines`，不含任何生命周期脚本；生产依赖只有 rolldown、yaml、zod | ✅ | `test/package.test.ts` 三个用例逐项断言 `bin`、`exports["."]`、`files`、`engines.node`、`packageManager`、生命周期脚本与生产依赖；3 pass / 0 fail |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
pnpm install --frozen-lockfile
pnpm check
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `pnpm install --frozen-lockfile` | ✅ “Lockfile is up to date”，pnpm v12.11.2，退出码 0 | 可访问 npm registry |
| `pnpm check` | ✅ 两套 `tsc` 无输出；Biome “Checked 5 files”；`node --test` 3 pass / 0 fail；“✓ 93 个功能，18 条用户故事，18 项技术验收，关系检查通过”；退出码 0 | 无 |

## 4. 交付物

- 新增 `package.json`、`pnpm-lock.yaml`、`tsconfig.json`、`tsconfig.runtime-core.json`、
  `biome.json`、`src/index.ts`、`src/runtime/core/types.ts`、`test/package.test.ts`。
- `README.md`：状态改为“实现中”，新增「本地检查」一节。
- `scripts/check-feature-list.mjs`：只有 Biome 的格式化改动（导入排序、长行折行）。

## 5. 与计划的偏差

- `package.json` 另写 `description`、`repository` 与 `private: true`。`private` 阻止误发布到 npm
  registry（总览边界：不发布到 registry），不影响以 git 依赖安装。
- `tsconfig.json` 另开 `noUncheckedIndexedAccess`（按下标取值时类型含 `undefined`，适用于表格与
  stdin 解析）与 `skipLibCheck`（不检查依赖的声明文件）。
- 生命周期脚本列表另含 `preprepare`、`postprepare`；测试另断言没有 `optionalDependencies` 与
  `peerDependencies`。
- `biome.json` 用 `linter.rules.preset: "recommended"`：Biome 2.5 把 `recommended` 字段标为弃用。

## 6. 技术决策

- `@types/node` 取 22.x 的最新版 22.20.5，避免类型中出现 Node 22 没有的 API；Node 22.0 与
  22.20 之间新增的 API 由 TA-14（M1-08）在 Node 22.0.0 上运行入口兜底。
- pnpm 固定为 12.11.2：它是 registry 的 `latest` 标签；12.13.0 位于 `next-12` 标签，不使用。
- Biome 关闭 `complexity/useLiteralKeys`：关系检查脚本以中文列名为键读取表格单元格，保留方括号
  写法表示“按列名取值”。
- Biome 按显示宽度计算行宽（中文字符计 2），含中文的长行会被折行；以 Biome 的格式化结果为准。
- 架构文档回填：架构 §0 的技术栈（TypeScript 7.0、Biome 2.5、pnpm 12、`node:test`）与本单一致，
  无需回填。

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|

无。

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- `bin` 与 `exports` 指向的 `dist/` 只在发布提交中存在；在 main 上以 `node src/cli/main.ts` 运行
  命令行（M1-02 起）。安装后的入口由 M1-08 的安装冒烟验证。
- 下一步：M1-02（skills 端到端）。
