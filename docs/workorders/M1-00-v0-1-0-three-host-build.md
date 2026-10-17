# Sprint 总览 M1-00：v0.1.0 三个宿主的插件构建

> 本 Sprint 结束时，`uapa build` 能从一份源项目构建出 Claude Code（两种形态）、Codex 与 agy 的
> 插件目录与构建报告，`uapa build --check` 能在门禁中比对，并以 git tag 发布 v0.1.0。

| 项 | 内容 |
|---|---|
| Sprint 目标 | 功能清单阶段 v0.1.0 的全部功能（[功能清单](../feature-list/README.md)「阶段」） |
| 范围来源 | 功能清单里程碑 M1～M6（[建议实现顺序](../feature-list/README.md#建议实现顺序)）；里程碑 M4 拆为 M1-04～M1-06 |
| 前置 | 架构选型 ARCH-001 已接受；范围决策 SD-25～SD-27（目标改为 Claude Code、Codex 与 agy） |
| 周期 | 2026-10-14 起，按工单顺序推进，不设截止日期 |
| 关联 issue | 无 |
| 收口文件 | `docs/acceptance/M1-00-v0-1-0-three-host-build.md`（全部工单完成后建立） |

Sprint 编号 `M1` 与功能清单的里程碑 M1～M6 是两套编号；本目录提到功能清单里程碑时一律写
「里程碑 Mx」，工单编号写作 `M1-NN`。

## 目标与已定决策

- 技术栈以[架构 §0](../architecture/architecture.md#0-技术选型总览) 为准：TypeScript 7.0、
  rolldown 1.2、yaml 2.9、zod 4.6、Biome 2.5、pnpm 12；构建器 Node ≥ 22.18，子进程入口支持
  Node ≥ 22；测试用 `node:test`，不配 CI。
- 目标为 `claude-code:in-process`、`claude-code:subprocess`、`codex:subprocess`、
  `agy:subprocess`；功能模块 07、08 与 F-03-07 为预留，本 Sprint 不实现（SD-26、SD-27）。
- 本 Sprint 共 8 张工单，超过 7 张：Codex 目标依赖维护者在 Codex 桌面端完成的宿主实测，单列一张
  （M1-05），使 agy 目标与其他工单不被它阻塞。
- 每张工单验收通过后推送 `main`；创建发布提交与 `v0.1.0` tag 前须维护者确认。

## 现状（已定位）

2026-10-14 读出：

| 项 | 状态 |
|---|---|
| 源码、测试、`package.json`、`tsconfig*.json`、`biome.json` | 完全没有 |
| 文档 | `docs/architecture/` 6 份、`docs/feature-list/` 4 份与 11 个模块文件、调研 19 份 |
| 脚本 | `scripts/check-feature-list.mjs`：零依赖 ESM，93 个功能、18 条故事、18 项技术验收通过 |
| `.gitignore` | `.DS_Store`、`node_modules/`、`dist/` |
| 本机 Node | 默认 v24.20.0；另有 v22.17.0～v22.23.2；没有 v22.0.0（TA-14 需要） |
| 本机 pnpm | 11.22.0；corepack 0.35.0 |
| registry 最新版本 | typescript 7.0.2、@biomejs/biome 2.5.15、rolldown 1.2.13、yaml 2.9.1、zod 4.6.7、pnpm 12.11.2 |
| 本机宿主 | Claude Code 2.1.296、Codex CLI 0.162.1、agy 1.3.4 |

## 关键落地约束（必须先验证）

| 约束 | 验证方式 | 得不出结论时 |
|---|---|---|
| TA-15 中 Claude Code 的入口前提（SD-22）：stdin 中会话 id、工具入参与提示文本的字段名，改写输出是否另需 `permissionDecision` | 在 M1-03 之前，用 `claude -p --plugin-dir` 加载记录输入的临时插件，不安装 | M1-03 不开始实现 |
| TA-15 中 Codex 的入口前提：stdin 字段名、决策 JSON 层级、插件 hooks 文件的 JSON 结构 | 插件 hooks 只对 Codex 桌面端手动安装的插件生效，需要维护者在桌面端安装记录插件并信任 hooks | M1-05 停在该步；其余工单照常推进 |
| SD-23 的两项：Codex 命令是否经 shell 执行；省略 matcher 时 Claude Code 与 Codex 的执行前 hook 是否匹配全部工具 | 与上两项一起实测 | 不发布 v0.1.0 |
| agy 的入口前提与失败默认 | 已于 1.3.4 实测（[agy「本地实测」](../research/coding-agent-plugin-manifests/agy-local-tests.md#本地实测)） | — |
| TypeScript 7 的 `tsc` 支持两套配置与 `--noEmit` | M1-01 中实测 | 按 ARCH-001 复议 |
| TA-14 需要 Node 22.0.0 的可执行文件 | M1-08 前由维护者确认下载 | 不发布 v0.1.0 |

## 工单构成

| 工单 | 名称 | 覆盖功能编号 | 依赖 | 可并行性 |
|---|---|---|---|---|
| [M1-01](M1-01-repo-skeleton.md) | 仓库骨架 | `F-10-01`、`F-10-03` | 无 | 最先动工 |
| [M1-02](M1-02-skills-end-to-end.md) | skills 端到端 | `F-02-01`、`F-02-02`、`F-02-03`、`F-01-01`、`F-01-02`、`F-01-03`、`F-01-04`、`F-01-05`、`F-03-01`、`F-03-02`、`F-03-03`、`F-03-04`、`F-03-05`、`F-03-09`、`F-03-10`、`F-03-11`、`F-05-01`、`F-05-02`、`F-09-01`、`F-09-02`、`F-09-03`、`F-10-02` | M1-01 | 串行 |
| [M1-03](M1-03-claude-code-command-hooks-guard.md) | 守卫端到端（Claude Code 命令 hooks） | `F-03-13`、`F-03-14`、`F-04-01`、`F-04-02`、`F-04-03`、`F-04-04`、`F-04-05`、`F-04-06`、`F-05-03`、`F-05-04`、`F-05-09` | M1-02 | 串行；前提为 Claude Code 的 TA-15 入口前提 |
| [M1-04](M1-04-agy-target.md) | agy 目标 | `F-11-01`、`F-11-02`、`F-11-03`、`F-11-04`、`F-11-05` | M1-03 | 与 M1-05、M1-07 并行 |
| [M1-05](M1-05-codex-target.md) | Codex 目标 | `F-06-01`、`F-06-02`、`F-06-03`、`F-06-04`、`F-06-05` | M1-03 | 与 M1-04、M1-07 并行；前提为 Codex 的 TA-15 入口前提 |
| [M1-06](M1-06-layout-overrides-check-command-hooks.md) | 合并布局、覆盖文件、比对与命令 hooks | `F-01-06`、`F-03-06`、`F-03-08`、`F-03-12`、`F-09-04`、`F-01-09`、`F-03-15`、`F-05-15`、`F-06-08`、`F-11-06` | M1-04、M1-05 | 串行 |
| [M1-07](M1-07-claude-code-hooks-module.md) | Claude Code hooks 模块与四目标夹具 | `F-04-07`、`F-05-05`、`F-05-06`、`F-05-07`、`F-05-08`、`F-05-10`、`F-05-14` | M1-03 | hooks 模块可与 M1-04、M1-05 并行；四目标夹具在 M1-06 之后加入 |
| [M1-08](M1-08-release-v0-1-0.md) | 发布 v0.1.0 | `F-10-04`、`F-10-05` | M1-06、M1-07 | 最后；创建 tag 前须维护者确认 |

功能编号取自[功能清单](../feature-list/README.md)的模块文件。本表是本 Sprint 覆盖哪些功能、
工单之间如何依赖的权威源；工单表头与验收 §2 是它的副本，不一致时以本表为准。

## Sprint 完成判定

| # | 判定条目 | 证据形式 |
|---|---|---|
| 1 | `pnpm check` 通过：两套 `tsc` 配置、Biome、`node --test`、功能清单关系检查 | 命令输出与测试计数 |
| 2 | [夹具表](../feature-list/modules/10-repo-release.md#夹具) 的全部夹具比对与入口用例通过 | `node --test` 中夹具测试的计数 |
| 3 | TA-15 的入口前提与发布前各项（SD-22、SD-23）在对应调研文档中有结论 | 调研文档的实测小节与日期 |
| 4 | TA-12：Claude Code 夹具产物通过 `claude plugin validate --strict` 与 `claude plugin test` | 维护者本机的命令输出（宿主实测） |
| 5 | 发布脚本生成发布提交与 `v0.1.0` tag，TA-14 与安装冒烟（F-10-05）通过 | 发布脚本输出 |
| 6 | M1-01～M1-08 的验收结论均为通过，表头有 commit 号 | 各验收文件 |

## 边界

- 不实现阶段为 v0.2.0 与预留的功能；不改变 F 编号，不重写 ARCH-001。
- 不配置 CI；不发布到 npm registry。
- 功能清单或接口文档需要改动时，与实现放在同一工单内提交，并在验收 §5 写明偏差。

## 依赖

- Claude Code 与 agy 的宿主实测由维护者授权在本机进行，会话使用维护者的额度。
- Codex 的插件 hooks 实测需要维护者在 Codex 桌面端操作。
- 发布提交与 tag 需要维护者确认。
