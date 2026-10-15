# 验收 M1-08：发布 v0.1.0

> 本文记录 M1-08 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M1-08](../workorders/M1-08-release-v0-1-0.md) |
| 覆盖功能点 | `F-10-04`、`F-10-05`（取自总览「工单构成」表） |
| 验收日期 | 2026-10-14 |
| 验收结论 | 有条件通过（公共仓库的 `v0.1.0` 与发布前的宿主实测待维护者完成，见 §7） |
| 判断范围 | 夹具与单元测试 |
| commit | `e2f51c2`、`7a908f8` |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | 本单未改 `src/`；TA-14 中 `throwing-guard` 的 11 个入口用例（守卫出错、缺少会话 id）在 Node 22.0.0 与 24 上的输出都与期望一致 |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | 安装冒烟从安装后的 `dist/` 构建出的 16 个文件（含构建报告）与 `full` 的期望产物逐字节一致，期望产物的导入由 `fixtures.test.ts` 的导入检查约束（子进程入口只含 `node:`，`uapa-guard.mjs` 只含 `claude-code`） |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | 本单未改 `src/`；整树比对仍由 `fixtures.test.ts` 覆盖（198 pass） |
| V4 | 能力数据含无出处的宿主行为 | 否 | `src/capabilities/` 未改动 |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：产物零依赖 | 安装冒烟中从 `dist/` 打包的入口只含 `node:` 导入 | 从安装后的 `dist/` 打包的 3 个子进程入口与 `uapa-guard.mjs` 与期望产物逐字节一致 | 发布脚本的安装冒烟；期望产物的导入检查见 `fixtures.test.ts` | ✅ |
| 2 | 硬约束：确定性输出 | TA-14：Node 22.0.0 与 Node 24 运行入口用例，输出逐字一致 | `throwing-guard` 11 个、`full` 15 个入口用例，在 v22.0.0 与 v24.20.0 上的退出码、stdout、stderr 都与用例期望逐字一致 | 发布脚本输出的两行 TA-14 结论 | ✅ |
| 3 | 硬约束：不越权写入 | 发布脚本只在仓库中写 `dist/` 与提交、tag；安装冒烟只写临时目录 | 运行后 main 的 HEAD 不变，`git status --porcelain` 为空，`--ignored` 只列出 `dist/` 与 `node_modules/`，暂存区不含 `dist/`；新增的引用只有 `v0.1.0`；安装冒烟在 `mkdtemp` 目录中进行，结束时删除（pnpm 另写入其内容寻址存储，属 pnpm 自身的缓存） | 在仓库的临时克隆中运行发布脚本后检查 | ✅ |
| 4 | 硬约束：安装不运行脚本 | TA-10：未放行构建脚本即安装成功 | `package.json` 没有生命周期脚本；冒烟以 `--config.strict-dep-builds=true --config.dangerously-allow-all-builds=false` 安装，pnpm 12.11.2 安装成功（`Packages: +7`），没有被忽略的构建脚本 | `test/package.test.ts`；发布脚本的安装冒烟 | ✅ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-10-04` | 发布脚本 | 工作区干净且检查通过后运行 TA-14，编译 `dist/`（含 `runtime/` 的编译结果与公共导出的类型声明），在 main 之上创建含 `dist/` 的发布提交并打 `vX.Y.Z` tag；不推送 | ✅ | 在仓库的临时克隆中运行 `node scripts/release.ts --node22 <路径>`，退出码 0：发布提交的父提交为 main 的 HEAD，相对 main 只新增 122 个 `dist/` 文件（`runtime/` 16 个，含 `index.d.ts`、`config/types.d.ts`、`runtime/core/types.d.ts`），annotated tag `v0.1.0` 指向它，未推送。前置检查：`test/release/release.test.ts` 5 个用例（缺少 `--node22`、未知参数、工作区不干净、tag 已存在、`--node22` 不是 22.0.0 时失败，提交数与引用不变） |
| `F-10-05` | 安装冒烟 | 发布脚本创建 tag 后，在临时项目中以 git 依赖指向本地仓库的该 tag 安装（不需要推送），安装命令写在发布脚本中；未放行任何构建脚本即安装成功，并能对 `full` 夹具运行 `uapa build`（入口从安装后的 `dist/` 打包；运行前把夹具配置改为以 `import { defineConfig } from 'uapa'` 包裹，覆盖值导入） | ✅ | 同一次运行：以 `git+file://<仓库>#v0.1.0` 安装（安装命令为脚本中的 `SMOKE_INSTALL`），配置改写为 `defineConfig({…})`；以安装后的 `bin`（`dist/cli/main.js`）运行 `build`，安装的包中没有 `src/`，入口只能从 `dist/runtime/entries/` 打包；退出码、stdout、stderr 与 `dist/` 下 16 个文件与 `full` 的期望一致 |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
pnpm check
node scripts/release.ts --node22 <Node 22.0.0 的路径>
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `pnpm check` | 通过：两次 `tsc` 无错误，Biome 检查 164 个文件无问题，`node --test` 198 pass / 0 fail，功能清单检查“93 个功能，18 条用户故事，18 项技术验收，关系检查通过” | 以 `test/container/run.sh check` 在容器中运行；发布脚本在 Node 24 上再运行一次，结果相同 |
| `node scripts/release.ts --node22 <Node 22.0.0 的路径>` | 退出码 0，输出 TA-14 两行结论、安装冒烟结论与“已创建发布提交 … 与 tag v0.1.0，未推送” | 维护者确认后下载 nodejs.org 的 `node-v22.0.0-darwin-arm64.tar.gz`（按 `SHASUMS256.txt` 校验）；Node v24.20.0、pnpm 12.11.2、git；在 mkdtemp 中的仓库克隆里运行，tag 不进入仓库本身 |

## 4. 交付物

- 发布脚本：`scripts/release.ts`（前置检查、`pnpm check`、TA-14、编译 `dist/`、发布提交与 tag、
  安装冒烟）。
- 测试：`test/release/release.test.ts`（前置检查 5 个用例）；`test/fixtures/run.ts` 的
  `runEntryCase` 改为选项参数 `{ extraEnv, node }`，`host-inference.test.ts` 随之调整。
- 容器：`test/container/Dockerfile` 的 base 镜像加入 git（发布脚本的测试使用），README 更新镜像大小。
- 文档：`README.md` 新增「安装」一节（P-02 的关闭条件）；架构文档「分发与发布」写明发布脚本的步骤
  与安装冒烟的安装命令。

## 5. 与计划的偏差

- 没有新增 `tsconfig` 文件：`dist/` 的编译配置由发布脚本写在临时目录中，`extends` 仓库的
  `tsconfig.json`，只改输出相关的项，编译选项只保存在一处。
- 修改了施工单边界之外的架构文档「分发与发布」，记录发布脚本的步骤；`src/` 未改动。
- 实现分两个提交：首次验收运行发现冒烟项目没有 `packageManager` 字段，安装用了全局的 pnpm 11.22.0，
  补充提交改为沿用本仓库的 `packageManager`，之后重新运行验收。
- base 镜像加入 git 后镜像标签改变，agent 镜像需要重建（重建时 agy 安装包的下载两次中断，第三次
  成功，与本单改动无关）。

## 6. 技术决策

- 编译：TypeScript 7.0.2 以 `rewriteRelativeImportExtensions` 改写 `.js` 文件中的相对导入；临时
  配置中须写绝对路径的 `typeRoots`，否则找不到 `@types/node`（TS2688，实测）。声明文件中的导入保留
  `.ts` 扩展名；在容器中以 `module: nodenext`、`skipLibCheck: false` 对安装后的包做使用方类型检查，
  `defineConfig`、`UapaConfig`、`GuardPlugin` 解析正常，只有故意写错的配置报错（一次性核对，未写入
  脚本）。
- 发布提交经临时索引创建：以 HEAD 的树为底强制加入被忽略的 `dist/`，以 `commit-tree` 生成，父提交
  为 main；tag 为 annotated。安装冒烟失败时脚本删除本次创建的 tag。
- 发布脚本要求以 Node 24 运行，`--node22` 的 `--version` 须为 `v22.0.0`；TA-14 把两次运行分别与
  用例期望比较。
- 安装：pnpm 12 对项目直接声明的 git 依赖不需要设置，`blockExoticSubdeps`（pnpm 11 起默认开启）
  只拦截传递依赖中的 git 依赖；npm 12.0.0 起 `allow-git` 默认为 `none`，取值 `none`、`root`、
  `all`。依据 pnpm 与 npm 的官方文档及源码（npm v12.2.0、pnpm v12.13.0），README 据此写明。
- SD-22、SD-23 已定，TA-15 的入口前提与发布前两项有结论。
- 承接 [M1-03 验收 §7](M1-03-claude-code-command-hooks-guard.md#7-已知限制与技术债) 第 2 行（已关闭）：
  安装后的包只含 `dist/`，`bundle` 按 `import.meta.url` 定位到 `dist/runtime/entries/` 中编译后的入口，
  安装冒烟的打包结果与期望一致（F-04-06）。

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|
| 1 | 验收运行的 `v0.1.0` 只建在临时克隆中；公共仓库的发布（同步各工单提交、在公共仓库检出中运行发布脚本、推送 tag）未进行 | 使用方暂不能安装 v0.1.0 | 已关闭：2026-10-14 在公共仓库检出中运行发布脚本，推送 `main` 与 tag `v0.1.0` |
| 2 | 发布前的宿主实测未做：[M1-05 验收 §7](M1-05-codex-target.md#7-已知限制与技术债) 第 1 行（Codex 安装 `full` 产物）与 [M1-07 验收 §7](M1-07-claude-code-hooks-module.md#7-已知限制与技术债) 第 1、2 行（嵌套会话与 `/clear` 后的去重、`claude plugin test`） | 按施工单约束，公共 tag 须在其后创建 | 维护者决定先发布 v0.1.0；三项实测转入 [M2-05](../workorders/M2-05-three-host-live-tests.md) |
| 3 | 安装冒烟只验证 `git+file://` 的本地 tag；从 GitHub 以 `github:xumetide-dev/uapa#v0.1.0` 安装未验证 | 远端解析与下载路径未覆盖 | 已关闭：2026-10-14 在容器中以 pnpm 12.11.2 安装 `github:xumetide-dev/uapa#v0.1.0`，构建 `full` 夹具的产物与期望一致 |
| 4 | README 中 npm 12 的 `allow-git` 用法来自官方文档，本机为 npm 11.19.0，未实测 | npm 使用方的安装步骤未覆盖 | 转入 [M2-06](../workorders/M2-06-release-v0-2-0.md)：在容器中安装 npm 12 后安装 |

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- 风险：发布脚本依赖维护者机器上的 Node 22.0.0、Node 24 与 pnpm；缺任一项时脚本在前置检查或运行
  对应步骤时失败，不会创建 tag。
- 下一步：M1-08 是 Sprint M1 的最后一张工单，接着做 Sprint 收口，把 §7 的四项与各工单尚未关闭的
  欠账汇总到收口文件。
