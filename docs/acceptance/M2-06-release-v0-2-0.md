# 验收 M2-06：发布 v0.2.0

> 本文记录 M2-06 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M2-06](../workorders/M2-06-release-v0-2-0.md) |
| 覆盖功能点 | 无（沿用 F-10-04、F-10-05）（取自总览「工单构成」表） |
| 验收日期 | 2026-10-15 |
| 验收结论 | 通过 |
| 判断范围 | 夹具与单元测试 |
| commit | `632242c` |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | 本单未改 `src/`；TA-14 中 `throwing-guard` 的 11 个入口用例（守卫出错、缺少会话 id）在 Node 22.0.0 与 24 上的输出都与期望一致 |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | 安装冒烟从安装后的 `dist/` 构建的 `full` 产物与期望逐字节一致；期望产物的导入由 `fixtures.test.ts` 的导入检查约束（子进程入口只含 `node:`，`uapa-guard.mjs` 只含 `claude-code`） |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | 本单未改 `src/`；整树比对由 `fixtures.test.ts` 覆盖（`pnpm check` 247 pass） |
| V4 | 能力数据含无出处的宿主行为 | 否 | `src/capabilities/` 未改动 |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：产物零依赖 | 安装冒烟中从 `dist/` 打包的入口只含 `node:` 导入 | 从安装后的 `dist/` 构建 `full` 夹具，3 个子进程入口与 `uapa-guard.mjs` 等产物与期望逐字节一致 | 发布脚本的安装冒烟；期望产物的导入检查见 `fixtures.test.ts` | ✅ |
| 2 | 硬约束：确定性输出 | TA-14：Node 22.0.0 与 Node 24 运行 `throwing-guard`、`full`、`after-tool` 的入口用例，输出逐字一致 | `throwing-guard` 11 个、`full` 15 个、`after-tool` 14 个入口用例，在 v22.0.0 与 v24.20.0 上的退出码、stdout、stderr 都与用例期望逐字一致 | 发布脚本输出的三行 TA-14 结论 | ✅ |
| 3 | 硬约束：不越权写入 | 发布脚本只在仓库中写 `dist/` 与提交、tag；安装冒烟与 GitHub 安装只写临时目录 | 公共仓库检出中：发布提交的父提交为公共 `main` 的 HEAD，相对父提交只新增 136 个文件，全部在 `dist/` 下（`dist/runtime/` 18 个）；运行后 `git status --porcelain` 为空，tag 只新增 annotated tag `v0.2.0`；安装冒烟在 `mkdtemp` 目录中进行；GitHub 安装在一次性容器的 `mktemp -d` 目录中进行 | 运行发布脚本后以 `git diff --name-status`、`git cat-file -t`、`git tag --list` 检查；推送时 pre-push 钩子按契约 `release_tag` 检查通过 | ✅ |
| 4 | 硬约束：安装不运行脚本 | TA-10：未放行构建脚本即安装成功；pnpm 与 npm 12 从 GitHub 安装时同样不放行脚本 | `package.json` 没有生命周期脚本；冒烟以 `--config.strict-dep-builds=true --config.dangerously-allow-all-builds=false` 安装，pnpm 12.11.2 安装成功（`Packages: +7`）。从 GitHub 安装：pnpm 12.11.2 以同样的设置、npm 12.2.0 以 `allow-git=root` 各安装成功，安装的包中没有 `preinstall`、`install`、`postinstall`、`prepare` 脚本 | `test/package.test.ts`；发布脚本的安装冒烟；容器中的 GitHub 安装 | ✅ |

## 2. 功能点逐条验收

本单在总览「工单构成」表中不挂功能点，本节没有条目；交付以 §1 与 §3 判定。

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
pnpm check
node --test test/release/release.test.ts
node scripts/release.ts --node22 <Node 22.0.0 的路径>
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `pnpm check` | 通过：两次 `tsc` 无错误，Biome 检查 182 个文件无问题，`node --test` 247 pass / 0 fail，功能清单检查“93 个功能，18 条用户故事，20 项技术验收，关系检查通过” | 以 `test/container/run.sh check` 在容器中运行；发布脚本在 Node 24 上再运行一次，结果相同 |
| `node --test test/release/release.test.ts` | 5 pass / 0 fail | 以 `test/container/run.sh exec` 在容器中运行 |
| `node scripts/release.ts --node22 <Node 22.0.0 的路径>` | 预演：在私有仓库的临时克隆中运行，退出码 0。正式运行：在公共仓库检出中运行，`pnpm check` 通过，输出 TA-14 三行结论、“安装冒烟：以 git 依赖安装 v0.2.0，对 full 夹具的构建结果与期望一致”与“已创建发布提交 … 与 tag v0.2.0，未推送”；维护者确认后单独推送 tag，远端 `refs/tags/v0.2.0^{}` 指向该发布提交 | 维护者确认；Node 22.0.0 的可执行文件（v0.1.0 发布时下载，`--version` 为 `v22.0.0`）、Node v24.20.0、pnpm 12.11.2、git 2.55.0；本 Sprint 的提交已同步并推送公共 `main` |
| 发布后核验（容器 `shell`） | 通过：pnpm 12.11.2 以 `pnpm add -D github:xumetide-dev/uapa#v0.2.0` 安装 0.2.0；npm 12.2.0 不写 `allow-git` 时以 `EALLOWGIT` 拒绝（退出码 1），`npm config set allow-git=root --location=project` 后以 `npm install -D` 安装成功，`package-lock.json` 记录 tag 对应的提交；两次对 `full` 夹具运行 `uapa build`（`PATH` 为空目录），退出码 0，stdout、stderr 与 `dist/` 下 16 个文件与期望一致 | 已推送 `v0.2.0`；容器中 Node v22.23.3、git 2.39.5，容器内以 `npm install -g npm@12` 安装 npm 12；安装命令取自 README |

## 4. 交付物

- 版本：`package.json` 的 `version` 为 `0.2.0`。
- 发布脚本：`scripts/release.ts` 的 `TA14_FIXTURES` 加入 `after-tool`，注释随之更新。
- README：状态一节写明 v0.2.0 以 tag 发布及其实现所在的 Sprint；「v0.2.0 范围」一节的组件加入
  agents 与 MCP 服务器，守卫加入执行后检查；安装示例改为 `v0.2.0`；新增「使用要点」一节，写明
  经 `{pluginRoot}` 引用的文件经 `overrides/<宿主>/` 放入插件目录、Codex 须在 TUI 启动时的 hooks
  审核对话框或 `/hooks` 中信任 hooks（信任前被静默跳过）、构建报告的默认位置。
- 架构文档：状态一行写明 v0.1.0 以 tag 发布、v0.2.0 按 Sprint M2 实现。
- 测试：`test/cli/run.test.ts` 的版本用例改为读取 `package.json` 的 `version`。

## 5. 与计划的偏差

- 修改了施工单边界之外的 `test/cli/run.test.ts`：该用例把 `--version` 的输出写死为 `0.1.0`，改版本后
  失败（246 pass / 1 fail）；改为与 `package.json` 比较后不再随版本修改。`src/` 未改动。
- 发布脚本先在私有仓库的临时克隆中预演；公共仓库检出中的正式运行在本 Sprint 的提交同步并推送
  公共 `main` 之后进行。

## 6. 技术决策

- TA-14 的夹具为 `throwing-guard`（守卫出错与缺少会话 id）、`full`（三个宿主的执行前检查、提示与
  停机）与 `after-tool`（执行后检查的替换与扣留），三者覆盖全部子进程入口的分支；安装冒烟仍只用
  `full`（F-10-05 不变）。
- npm 12 的安装实测放在容器 `shell` 中，在容器内安装 npm 12，不改宿主机的全局 npm。实测确认
  README 的写法：npm 12.2.0 默认拒绝 git 依赖（`EALLOWGIT`），项目 `.npmrc` 写 `allow-git=root` 后
  放行项目直接声明的 git 依赖。

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|
| 1 | `v0.2.0` 只建在临时克隆中；公共仓库检出中的发布与 tag 推送未进行 | 使用方暂不能安装 v0.2.0 | 已关闭：2026-10-15 维护者确认后在公共仓库检出中运行发布脚本，推送 `main` 与 tag `v0.2.0` |
| 2 | 从 GitHub 以 pnpm 与 npm 12 安装 `v0.2.0` 未进行（承接 [M1-08 验收 §7](M1-08-release-v0-1-0.md#7-已知限制与技术债) 第 4 行） | 远端安装路径与 npm 12 的 `allow-git` 用法未覆盖 | 已关闭：2026-10-15 在容器中以 pnpm 12.11.2 与 npm 12.2.0 各安装一次，构建 `full` 夹具的产物与期望一致 |

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- 风险：发布脚本依赖维护者机器上的 Node 22.0.0、Node 24 与 pnpm；缺任一项时脚本在前置检查或运行
  对应步骤时失败，不会创建 tag。
- 下一步：M2-06 是 Sprint M2 的最后一张工单，接着做 Sprint 收口，把各工单尚未关闭的欠账汇总到
  收口文件。
