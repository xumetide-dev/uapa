# 施工单 M5-06：marketplace 文件

> 配置 `marketplace` 时，构建为 Claude Code 写 `.claude-plugin/marketplace.json`，为 Codex 写
> `.agents/plugins/marketplace.json`。两个文件位于 `marketplace.dir`，各含一个指向本宿主插件目录的
> 条目；`--check` 一并比对。agy 只支持官方 marketplace，不生成，安装指南写明从 git 地址安装。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M5-00](M5-00-v0-4-0-host-coverage.md) |
| 覆盖功能点 | `F-03-18`、`F-05-24`、`F-06-15` |
| 依赖工单 | [M5-02](M5-02-shared-files-and-claude-code-config.md) |
| 关联 issue | 无 |
| 验收文件 | [M5-06](../acceptance/M5-06-marketplace-files.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 已有且够用：
  - 写出、清空与比对按插件目录进行（`src/build/write.ts`、`src/build/compare.ts`）。
  - 构建报告写在 `<outDir>/uapa-report.json`，不清空 `outDir`。
  - `marketplace` 的配置字段与校验由 M5-02 提供。
- 已有但不对：
  - 施工单说明的“不越权写入”只列插件目录与构建报告；M5-01 按 SD-41 写明 marketplace 文件后，
    以本单为准实现。
- 完全没有：宿主模块返回 marketplace 文件的接口、写出位置、比对，以及两个宿主的 marketplace
  格式。
- 宿主事实：
  - Claude Code 文档「plugin marketplaces」。
  - Codex rust-v0.162.1 `core-plugins/src/marketplace.rs`。
  - TA-25 第 4 项的结论。

## ⚠️ 关键落地约束（必须先验证）

- **相对路径**：
  - `source` 是从 `marketplace.dir` 到插件目录的相对路径，以 `./` 开头，POSIX 分隔。
  - 两者相同时，Claude Code 写 `"./"`；Codex 的写法以 M5-01 的核对为准。
  - 插件目录不在 `marketplace.dir` 之内时，配置校验失败。
- **不清空**：marketplace 文件逐个写出，不清空所在目录；默认布局的插件目录不得包含
  `marketplace.dir`（M5-02 的校验）。
- **Codex 的读取顺序**：同时生成两个文件时，Codex 先读 `.agents/plugins/marketplace.json`，不会把
  Claude Code 的产物当作插件安装；只配置 Claude Code 时，安装指南写明这一风险。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 否 | 不改守卫与入口 |
| 产物零依赖 | 否 | 不改入口与打包 |
| 不在运行时推断宿主 | 否 | 不改入口 |
| 确定性输出 | 是 | `host-coverage` 夹具逐字节比对；条目字段顺序固定 |
| 不越权写入 | 是 | `host-coverage` 夹具比对运行后的整个源项目目录：只多出两个 marketplace 文件；`--check` 的单元测试断言不写文件；施工单说明与 TA-07 的写法同步 |
| 安装不运行脚本 | 否 | 不改 `package.json` |
| 能力数据有出处 | 否 | 不改能力数据；格式的出处写在宿主模块的注释中 |

## 任务

### 1. 构建编排（`src/build/`、`src/targets/types.ts`）

- 按 M5-01 定稿的接口，宿主模块返回 marketplace 文件。
- 按 F-03-18 写出、比对与失败处理，并更新 `docs/workorders/README.md` 的“不越权写入”。

### 2. 宿主模块

- Claude Code（`src/targets/claude-code/`）：按 F-05-24 生成。
- Codex（`src/targets/codex/`）：按 F-06-15 生成。

### 3. 帮助文档（`docs/guide/`）

- `install.md`：用生成的 marketplace 安装 Claude Code 与 Codex 插件；agy 从 git 地址安装（子路径的
  写法以 M5-01 的调研为准）；只配置 Claude Code 时 Codex 的误装风险。
- `build-and-check.md`：`--check` 比对 marketplace 文件。

### 不改的地方（红线）

- 不配置 `marketplace` 时，产物与比对结果不变，现有夹具不变。
- 插件目录的清空规则不变。

### 测试

- 单元：
  - 相对路径：插件目录与 `marketplace.dir` 相同、位于其子目录。
  - 宿主全部失败时不写。
  - `--check` 报告 marketplace 文件的 `added` 与 `modified`。
  - 与插件目录中的文件同路径时失败。
- 夹具：`host-coverage` 配置 `marketplace`，期望树含两个 marketplace 文件。

## 验收

```bash
test/container/run.sh check
```

```bash
test/container/run.sh exec node --test test/fixtures/fixtures.test.ts
```

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 最终实现方案、关键技术决策及其验证依据；
3. 主要改动点与涉及模块清单；
4. 测试覆盖、宿主实测结果、判断范围和已知限制；
5. 如适用，附生成的产物或入口的输入输出示例。

## 边界

- 允许新增与修改：`src/build/`、`src/targets/types.ts`、`src/targets/claude-code/`、
  `src/targets/codex/`、`test/`、`docs/guide/`、`docs/workorders/README.md`（硬约束的写法）、
  `docs/feature-list/technical-acceptance.md` 中 TA-07 的写法。
- 禁止修改：`src/runtime/`、`src/bundle/`、agy 的宿主模块。

## 依赖

M5-01 的接口定稿与 TA-25 第 4 项；M5-02 的 `marketplace` 配置字段。
