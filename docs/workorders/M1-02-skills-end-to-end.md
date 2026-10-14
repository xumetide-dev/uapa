# 施工单 M1-02：skills 端到端

> 打通“读取配置与源项目 → 能力检查 → 宿主模块生成 → 写出 → 构建报告 → 终端摘要”的整条路径，
> 以 `claude-code:subprocess` 的 manifest 与 skills 为第一个产物（里程碑 M2）。守卫只做到类型与
> 声明读取，hooks 与入口在 M1-03。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M1-00](M1-00-v0-1-0-three-host-build.md) |
| 覆盖功能点 | `F-02-01`、`F-02-02`、`F-02-03`、`F-01-01`、`F-01-02`、`F-01-03`、`F-01-04`、`F-01-05`、`F-03-01`、`F-03-02`、`F-03-03`、`F-03-04`、`F-03-05`、`F-03-09`、`F-03-10`、`F-03-11`、`F-05-01`、`F-05-02`、`F-09-01`、`F-09-02`、`F-09-03`、`F-10-02` |
| 依赖工单 | [M1-01](M1-01-repo-skeleton.md) |
| 关联 issue | 无 |
| 验收文件 | [M1-02](../acceptance/M1-02-skills-end-to-end.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 完全没有：`src/config/`、`src/source/`、`src/build/`、`src/capabilities/`、`src/targets/`、
  `src/report/`、`src/cli/`、`test/fixtures/`。M1-01 之后只有空的 `src/index.ts` 与
  `src/runtime/core/types.ts`。
- 接口已定义，按文档实现，不另行设计：名称与配置（[模块接口](../architecture/module-interfaces.md)
  §1、§2）、源项目与守卫声明（§3）、能力数据（§4）、宿主模块接口（§5）、写出与退出码（§8）、
  构建报告（[构建报告](../architecture/build-report.md)）、守卫公共类型
  （[hooks 适配 §2](../research/coding-agent-plugin-manifests/uapa-hook-adapters.md#2-公共类型)）。

## ⚠️ 关键落地约束（必须先验证）

- 配置加载用 Node 类型剥离直接 `import()` `uapa.config.ts`：不可擦除语法与缺 `.ts` 扩展名的
  相对导入要转成 `InputIssue`（F-01-02）。先用一个含 `enum` 的配置与一个缺扩展名的导入实测
  Node 24 抛出的错误类型，再决定如何识别。
- zod 4 的错误路径要转成模块接口 §8 的字段路径写法（`targets[2]`、`hosts.codex.hooksFile`）。
- 本工单只登记 `claude-code:subprocess`（F-05-01）；`TargetName` 的完整取值按模块接口 §1 定义，
  未登记的目标名按未知目标名处理。
- `F-03-11` 的 `bundle` 函数在 M1-03 之前抛出“未实现”；本工单的夹具都不配守卫，不会调用它。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 是 | 读取守卫声明的单元测试：默认导出不符合 `GuardPlugin`、含 `afterTool`、`requires` 含 `replaceOutput` 时返回 `InputIssue`（F-02-03） |
| 产物零依赖 | 否 | 本工单不生成入口 |
| 不在运行时推断宿主 | 否 | 本工单不生成入口 |
| 确定性输出 | 是 | 夹具在临时目录中构建并与期望产物逐字节比对；报告中没有绝对路径与时间 |
| 不越权写入 | 是 | `resolvePluginDirs` 的单元测试覆盖插件目录等于或包含源项目根、`outDir`、另一宿主目录时校验失败；夹具比对整个源项目目录 |
| 安装不运行脚本 | 否 | |
| 能力数据有出处 | 是 | `src/capabilities/claude-code-subprocess.ts` 写宿主版本 2.1.296、核对日期与出处文件名；TA-09 的单元测试检查每个已登记的数据模块 |

## 任务

### 1. 配置（`src/config/`）

- `targets.ts`：目标名与宿主标识列表（F-01-01）；登记 `claude-code:subprocess` 与 `claude-code`。
- `types.ts`：`UapaConfig`、`defineConfig`；`issues.ts`：`InputIssue`、`Loaded<T>`。
- `load.ts`：`loadConfig`（F-01-02），校验（F-01-03）；`layout.ts`：`resolvePluginDirs`。

### 2. 源项目与守卫声明（`src/source/`、`src/runtime/core/types.ts`）

- 守卫公共类型与 `GuardCheck`、`CanonicalTool`、`ToolNameMap`、`TargetRuntimeData`
  （F-02-01、F-02-02）。
- `index.ts`：`readSource`，读取 skills 与 frontmatter `targets`（F-01-04、F-01-05）。
- `guard.ts`：`readGuard`（F-02-03）。

### 3. 能力数据与宿主模块接口（`src/capabilities/`、`src/targets/`、`src/bundle/types.ts`）

- `capabilities/types.ts`、`index.ts`（F-03-01）；`claude-code-subprocess.ts`（F-05-01，取值依据
  hooks 适配第 4、6、7、8 节与跨平台对比「工具名差异」）。
- `targets/types.ts`、`index.ts`（F-03-11）；`bundle/types.ts` 的 `BundleRequest`。
- `targets/claude-code/`：`generate` 只生成 `.claude-plugin/plugin.json`（F-05-02）。

### 4. 构建编排与报告（`src/build/`、`src/report/`）

- 组件承载检查（F-03-02）、按宿主构建（F-03-03）、放置 skills（F-03-04）、默认布局写出（F-03-05）、
  构建报告（F-03-09）、`formatSummary`（F-03-10）。内部函数以参数接收两个登记处。

### 5. 命令行（`src/cli/`）

- `main.ts`：`uapa build`、`--config`、`--help`、`--version`；退出码只由 `BuildOutcome` 与捕获的
  异常决定（F-09-01～F-09-03）。

### 6. 夹具运行器（`test/fixtures/`）

- 运行器与更新命令按[夹具](../feature-list/modules/10-repo-release.md#夹具)一节实现，更新命令
  写在 `test/fixtures/README.md`；加入 `no-guard`、`empty`、`invalid-config`、`usage-error`
  （F-10-02）。

### 不改的地方（红线）

- M1-01 的 `test/package.test.ts` 持续通过；`package.json` 不新增生产依赖。
- 模块依赖方向按[架构 §1](../architecture/architecture.md#1-组成与模块)：`src/build/` 不导入
  具体宿主模块；宿主模块不导入 `src/build/`。
- 不实现 hooks 配置、入口与打包（M1-03）。

### 测试

- 单元：配置校验的每条失败分支（未知目标名、重复目标、未知字段、`hosts` 中未配置的宿主、路径
  规则）给出期望的字段路径；`readSource` 的 skills 与 frontmatter 分支；`readGuard` 的拒绝分支；
  能力检查用合成的 `TargetCapabilities`（`components.skills` 为 `'none'` 时的两种情况，TA-04）；
  `build` 用测试用宿主模块与能力数据；退出码表的每一行（F-09-02）。
- 夹具：四个里程碑 M2 夹具的退出码、整个源项目目录、stdout、stderr 逐字节比对。

## 验收

```bash
pnpm check
node --test test/fixtures/fixtures.test.ts
node src/cli/main.ts --help
node src/cli/main.ts --version
```

`no-guard` 的产物只含 `.claude-plugin/plugin.json` 与 `skills/`；`invalid-config` 以退出码 2 结束
且不写任何文件；`usage-error` 以退出码 2 结束。

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 最终实现方案、关键技术决策及其验证依据；
3. 主要改动点与涉及模块清单；
4. 测试覆盖、宿主实测结果、判断范围（夹具与单元测试 / 宿主实测）和已知限制；
5. 如适用，附生成的 manifest、hooks 配置或入口的输入输出示例。

## 边界

- 允许新增与修改：`src/` 下本工单列出的目录、`test/`；`src/index.ts` 的导出。
- 禁止修改：功能清单与接口文档的语义；需要改时在验收 §5 写明并同一提交更新文档。

## 依赖

M1-01。
