# 验收 M5-02：共用文件与 Claude Code 的配置字段

> 本文记录 M5-02 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M5-02](../workorders/M5-02-shared-files-and-claude-code-config.md) |
| 覆盖功能点 | `F-01-12`、`F-01-14`、`F-03-17`、`F-05-20`、`F-05-25`（取自总览「工单构成」表） |
| 验收日期 | 2026-10-15 |
| 验收结论 | 通过 |
| 判断范围 | 夹具与单元测试 + 宿主实测 |
| commit | `25daca5` |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | 本单未改 `src/runtime/`、`src/bundle/` 与守卫读取；守卫相关的入口用例全部通过（`run.sh check` 312 pass） |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | 入口与打包未改；`fixtures.test.ts` 的导入检查对 21 个夹具通过；共用文件原样复制，不经打包 |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | `host-coverage` 比对运行后的整个源项目目录，共用文件只出现在三个插件目录中；插件目录是源项目根目录时不复制（`shared-files.test.ts`）；`--check` 用例前后目录快照一致（`layout.test.ts`） |
| V4 | 能力数据含无出处的宿主行为 | 否 | 本单未改 `src/capabilities/` |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：确定性输出 | `host-coverage` 夹具逐字节比对；共用文件按路径字典序复制，透传字段按插入顺序写出 | `夹具 host-coverage` 通过，`plugin.json` 末尾依次为 `homepage`、`license`；`readSharedFiles` 的列表按字典序（`.lsp.json`、`README.md`、`scripts/lib/util.mjs`、`scripts/server.mjs`） | `test/fixtures/fixtures.test.ts`、`test/source/shared.test.ts`、`test/targets/claude-code.test.ts`「manifest 透传字段按写入顺序追加在生成的字段之后」 | ✅ |
| 2 | 硬约束：不越权写入 | `host-coverage` 夹具比对运行后的整个源项目目录：共用文件只出现在插件目录中 | 运行后的目录为 `uapa.config.ts`、`files/scripts/server.mjs`、`dist/` 下三个插件目录与构建报告；`server.mjs` 只多出 `dist/claude-code/`、`dist/codex/`、`dist/agy/` 三份 | `test/fixtures/host-coverage/expected/tree/` | ✅ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| `F-01-12` | 读取共用文件 | 递归列出 `files/` 下的文件，路径相对 `files/`、POSIX 分隔、按字典序；没有 `files/` 时为空；本模块不复制文件（SD-37） | ✅ | `shared.test.ts`：不存在时为空；四个文件含子目录按字典序列出；`files` 为文件时报 `files 应为目录`，含符号链接时报不支持的文件类型；`readSource` 只列出路径，内容由构建编排读取 |
| `F-01-14` | 校验 v0.4.0 的配置字段 | `hosts['claude-code']` 可写 `manifest`（对象，不得含 SD-42 列出的键）与 `onFailure`（只取 `'block'`）；顶层可写 `marketplace`：`name` 为 kebab-case，`owner.name` 为非空字符串，`owner.email` 可省略，`dir` 相对配置文件所在目录、默认 `outDir`，不得等于或位于默认布局的插件目录内；`targets` 中没有 Claude Code 或 Codex 的目标时不得配置 `marketplace`；这两个宿主的插件目录须等于或位于 `marketplace.dir` 之内；违反时配置校验失败，`field` 写到键，如 `hosts.claude-code.manifest.name`（SD-41～SD-43） | ✅ | `validate.test.ts` 的四个用例：`manifest` 含 `name`、`version` 时各报一条，字段为 `hosts.claude-code.manifest.name` 等，不是对象时字段为 `hosts.claude-code.manifest`；`onFailure: 'none'` 报 `只能为 'block'`；`marketplace.name` 非 kebab-case、缺 `owner`、`owner.name` 为空与未知键；只有 agy 目标时字段为 `marketplace`；`dir` 位于 `dist/claude-code` 内、插件目录不在 `market` 内时字段为 `marketplace.dir`；合并布局的目录可作为 marketplace 目录 |
| `F-03-17` | 放置共用文件 | 构建编排把 `files/` 的全部文件复制到每个写出文件的插件目录，在宿主模块生成与组件放置之后、应用覆盖文件之前；与生成文件或组件文件同路径时，写入该目录的全部目标失败，错误写明文件并提示改用 `overrides/<宿主>/`；生成文件与组件文件同路径时同样失败；插件目录是源项目根目录而 `files/` 非空时，写入该目录的全部目标失败，错误提示把共用文件直接放在根目录或改用默认布局；覆盖文件可以替换共用文件，该文件写入报告的 `overridden`；`--check` 一并比对（SD-37） | ✅ | `shared-files.test.ts` 的六个用例：两个插件目录都得到共用文件且保留 `0o755`；`--check` 列出被改动的共用文件；覆盖文件替换共用文件并记入 `overridden`；与生成文件、复制的组件文件同路径时的错误逐字核对（含 `overrides/claude-code/` 提示与宿主模块的 `conflictHint`）；源项目根目录的合并布局在 `files/` 非空时失败，生成文件与原位的组件文件同路径时失败；`host-coverage` 夹具 |
| `F-05-20` | manifest 透传字段 | `hosts['claude-code'].manifest` 的字段按写入顺序追加在生成的字段之后，产物通过 `claude plugin validate --strict`（F-05-09）；透传字段引用的文件由 `files/` 或 `overrides/claude-code/` 提供（SD-42） | ✅ | `claude-code.test.ts`「manifest 透传字段按写入顺序追加在生成的字段之后」；`host-coverage` 的 `plugin.json` 逐字比对；容器中 Claude Code 2.1.296 构建该夹具时 `hostValidation` 为 `passed`，`claude plugin validate --strict dist/claude-code` 输出 `✔ Validation passed`（宿主实测） |
| `F-05-25` | 插件名按段检查保留词 | 名称中以 `-` 分隔的任一段为 `claude`、`anthropic`、`anthropics`，或名称以 `cc-plugin-` 开头时生成失败，原因写明 `claude plugin validate --strict` 拒绝；代替 F-05-02 中按前缀与全名的检查（Claude Code 文档「manifest reference」，SD-43） | ✅ | `claude-code.test.ts`：`team-claude-tools`、`my-anthropic`、`anthropics`、`claude-code` 等九个名称报 `含保留段 <段>：claude plugin validate --strict 拒绝该名称`，`cc-plugin-tools` 报保留前缀；`claudette`、`myclaude`、`anthropical-tools` 通过；现有 20 个夹具的期望产物未变 |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
test/container/run.sh check
```

```bash
test/container/run.sh exec node --test test/fixtures/fixtures.test.ts
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `test/container/run.sh check` | ✅ tsc 与 biome 通过；312 pass / 0 fail；功能清单关系检查通过 | Docker 可用 |
| `test/container/run.sh exec node --test test/fixtures/fixtures.test.ts` | ✅ 21 pass / 0 fail，含 `夹具 host-coverage` | Docker 可用 |
| `test/container/run.sh shell sh -c '…构建 host-coverage…; claude plugin validate --strict dist/claude-code'` | ✅ 构建以 0 结束，两个 Claude Code 目标的 `hostValidation` 为 `passed`；`✔ Validation passed` | 容器中的 Claude Code 2.1.296 |

## 4. 交付物

- 源项目：`src/source/shared.ts`（`readSharedFiles`），`SourceProject.files`。
- 配置：`src/config/types.ts`（`manifest`、`onFailure`、`MarketplaceConfig`、
  `MANIFEST_RESERVED_KEYS`），`src/config/validate.ts`，`src/config/marketplace.ts`
  （`marketplaceDirOf`、`checkMarketplace`，M5-06 复用）。
- 构建：`src/build/placement.ts`（各宿主的文件表与同路径冲突，自 `outputs.ts` 拆出），
  `src/build/components.ts` 的 `componentPaths`，`src/build/outputs.ts` 的根目录检查。
- Claude Code：`src/targets/claude-code/manifest.ts` 的透传字段与按段检查。
- 测试：`test/source/shared.test.ts`、`test/build/shared-files.test.ts`，`validate.test.ts` 与
  `claude-code.test.ts` 的新用例，夹具 `host-coverage`。
- 文档：`docs/guide/source-project.md`「共用文件」，`docs/guide/configuration.md` 的
  `marketplace`、`manifest`、`onFailure` 与插件名规则，`docs/architecture/architecture.md`
  的目录结构。

## 5. 与计划的偏差

- 施工单的边界未列 `docs/architecture/`：目录结构中补了新文件，并把“仓库中只有 `scripts/`
  允许手写 `.mjs`”改为除去夹具源项目的 `files/`，因为功能清单的夹具表要求
  `files/scripts/server.mjs`。
- 插件目录是源项目根目录时，生成文件与原位的组件文件同路径的检查按构建产物文档一并实现；
  现有夹具没有这种情形，期望产物不变。

## 6. 技术决策

| 决策 | 依据 | 回填状态 |
|---|---|---|
| 组件与共用文件的冲突每个目录检查一次，提示列出该目录全部宿主的 `overrides/<宿主>/`；生成文件的冲突按宿主检查 | 组件与共用文件与宿主无关，按宿主检查会在合并布局中重复报告 | 实现即文档，构建产物文档无需改动 |
| 共用文件在构建开始时读取一次，各插件目录共用 | 内容与目录无关 | 同上 |
| `marketplace.dir` 未配置时不检查它与默认布局插件目录的关系 | 默认值为 `outDir`，默认布局的插件目录不得等于或包含 `outDir` 已由插件目录检查报告，避免同一问题报两次 | 同上 |
| Claude Code 生成文件与组件同路径时附上宿主模块的 `conflictHint` | 与合并布局冲突的提示一致；M5-03 的规则技能与同名 skill 冲突时可给出改名提示 | 同上 |

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|
| 1 | `onFailure` 与 `marketplace` 只做校验，不影响产物 | 配置了也不生成对应内容；帮助文档已注明 | [M5-05](../workorders/M5-05-guard-reliability-and-risks.md)、[M5-06](../workorders/M5-06-marketplace-files.md) |

每条写明去向；没有去向的不入账。不属于任何 Sprint 的改动记入 [`tech-debt.md`](tech-debt.md)。

## 8. 风险与下一步

- 透传字段只由 `claude plugin validate --strict` 校验，UAPA 不检查字段名；写错的字段在
  F-05-09 的宿主校验中使目标失败。
- 下一步：M5-03 rules 的换算承载与 agy 的 commands。
