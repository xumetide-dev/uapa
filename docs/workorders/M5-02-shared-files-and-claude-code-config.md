# 施工单 M5-02：共用文件与 Claude Code 的配置字段

> 源项目增加 `files/`：其中的文件原样写入每个插件目录。配置增加 v0.4.0 的字段：
> `hosts['claude-code'].manifest`、`hosts['claude-code'].onFailure` 与 `marketplace`。本单只实现
> manifest 透传，后两个字段只做校验，由 M5-05、M5-06 生效。Claude Code 的插件名改为按 `-` 分隔的
> 段检查保留词。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M5-00](M5-00-v0-4-0-host-coverage.md) |
| 覆盖功能点 | `F-01-12`、`F-01-14`、`F-03-17`、`F-05-20`、`F-05-25` |
| 依赖工单 | [M5-01](M5-01-v0-4-0-host-facts-and-interfaces.md) |
| 关联 issue | 无 |
| 验收文件 | [M5-02](../acceptance/M5-02-shared-files-and-claude-code-config.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 已有且够用：
  - `listFiles`（`src/source/files.ts`）递归列出文件；`readOverrides`（`src/source/overrides.ts`）
    是读取目录的先例。
  - `hostView`（`src/build/outputs.ts`）按“生成文件、复制的组件、覆盖文件”的顺序组装插件目录的
    文件表。
  - `validateConfig`（`src/config/validate.ts`）用 zod 严格对象校验配置。
- 已有但不对：
  - `hosts['claude-code']` 的 zod 对象只允许 `dir`、`displayName`、`userConfig`、`dependencies`、
    `$schema`。
  - `RESERVED_PREFIXES`、`RESERVED_NAMES`（`src/targets/claude-code/manifest.ts`）按前缀与全名
    检查，漏掉中间段为保留词的名称。
  - `hostView` 中复制的组件会被同路径的后来者静默替换，没有冲突检查。
  - `src/build/outputs.ts` 已有 207 行。
- 完全没有：`SourceProject.files`、`files/` 的放置与冲突、manifest 透传、`marketplace` 与
  `onFailure` 的配置字段。
- 宿主事实：Claude Code 文档「manifest reference」的保留名规则与字段表，以 M5-01 写入
  `claude-code-plugins.md` 的小节为准。

## ⚠️ 关键落地约束（必须先验证）

- **共用文件不覆盖生成文件**：`files/` 中的文件与生成文件或组件文件同路径时，该目录的全部目标
  失败，错误写明文件；覆盖文件仍可替换共用文件（SD-37）。冲突检查放在组装文件表时，不依赖写出
  阶段。
- **插件目录是源项目根目录时**：按 M5-01 定稿的[写出、比对与退出码](../architecture/build-output.md)
  执行：组件不复制；`files/` 非空时写入该目录的全部目标失败，不向源项目根目录复制。
- **透传字段的键序**：按配置对象的插入顺序写出，同一输入逐字节相同；`validate --strict` 由
  F-05-09 在写出后调用，本单不另做字段白名单。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 否 | 不改守卫与入口 |
| 产物零依赖 | 否 | 不改入口与打包 |
| 不在运行时推断宿主 | 否 | 不改入口 |
| 确定性输出 | 是 | `host-coverage` 夹具逐字节比对；共用文件按路径字典序复制，透传字段按插入顺序写出 |
| 不越权写入 | 是 | `host-coverage` 夹具比对运行后的整个源项目目录：共用文件只出现在插件目录中 |
| 安装不运行脚本 | 否 | 不改 `package.json` |
| 能力数据有出处 | 否 | 不改能力数据 |

## 任务

### 1. 源项目与配置（`src/source/`、`src/config/`）

- `files.ts` 或新文件 `shared.ts`：按 F-01-12 读取 `files/`，`SourceProject` 增加 `files`。
- `types.ts`、`validate.ts`：按 F-01-14 增加 `hosts['claude-code'].manifest`、
  `hosts['claude-code'].onFailure` 与 `marketplace`；manifest 中的保留键、`marketplace.dir`
  位于默认布局的插件目录内时，返回 `InputIssue`。

### 2. 放置共用文件（`src/build/`）

- 先把 `hostView` 与冲突处理从 `outputs.ts` 拆到单独的文件，行为不变。
- 按 F-03-17：在生成文件与组件文件之后、覆盖文件之前加入共用文件；同路径时写入该目录的全部
  目标失败，错误提示改用 `overrides/<宿主>/`。生成文件与组件文件同路径的检查一并加入，此前
  组件静默替换生成文件；现有夹具没有这种情形，期望产物不变。

### 3. Claude Code 的 manifest（`src/targets/claude-code/manifest.ts`）

- 按 F-05-20 追加透传字段。
- 按 F-05-25 改为按段检查保留词，原因写明 `claude plugin validate --strict` 拒绝。

### 4. 帮助文档（`docs/guide/`）

- `source-project.md` 写 `files/`；`configuration.md` 写三个新字段（`onFailure` 与
  `marketplace` 注明在 M5-05、M5-06 之后生效）。

### 不改的地方（红线）

- 现有 20 个夹具的期望产物不变：保留名的新规则不拒绝任何现有夹具的插件名。
- 覆盖文件的语义与 `overridden` 的填写不变。
- 不改入口、打包、守卫接口与其他宿主模块。

### 测试

- 单元：
  - `files/` 不存在、为文件、含子目录。
  - manifest 透传含保留键时失败，键序保持。
  - `onFailure` 与 `marketplace` 的非法取值；`marketplace.dir` 位于插件目录内。
  - 插件名的保留段：`team-claude-tools`、`anthropics`、`my-anthropic` 失败，`claudette` 通过。
  - 共用文件与生成文件、组件文件同路径时失败。
- 夹具：新增 `host-coverage`，本单只含 `files/scripts/server.mjs` 与
  `hosts['claude-code'].manifest`（`homepage`、`license`），四个目标，默认布局。

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

- 允许新增与修改：`src/source/`、`src/config/`、`src/build/`、
  `src/targets/claude-code/manifest.ts`、`test/`、`docs/guide/`、夹具表中本单涉及的段落。
- 禁止修改：`src/runtime/`、`src/bundle/`、Codex 与 agy 的宿主模块。

## 依赖

M5-01 的接口定稿（模块接口 §2、§3、§8）。
