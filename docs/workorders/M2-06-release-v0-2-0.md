# 施工单 M2-06：发布 v0.2.0

> 版本号改为 0.2.0，TA-14 加入执行后检查夹具的入口用例，在公共仓库检出中运行发布脚本生成
> 发布提交与 `v0.2.0` tag；推送后从 GitHub 以 pnpm 与 npm 12 各安装一次。创建与推送 tag 须
> 维护者确认。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M2-00](M2-00-v0-2-0-three-host-completion.md) |
| 覆盖功能点 | 无（沿用 v0.1.0 的发布脚本 F-10-04 与安装冒烟 F-10-05） |
| 依赖工单 | [M2-05](M2-05-three-host-live-tests.md) |
| 关联 issue | 无 |
| 验收文件 | [M2-06](../acceptance/M2-06-release-v0-2-0.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 已有且够用：
  - `scripts/release.ts` 的前置检查、`pnpm check`、TA-14、编译 `dist/`、经临时索引创建发布
    提交与 annotated tag、安装冒烟；`v0.1.0` 以此发布，见
    [M1-08 验收](../acceptance/M1-08-release-v0-1-0.md)。
  - 公共仓库的 pre-push 钩子只放行新建的发布 tag，且发布提交的父提交须已在公共仓库的 `main`
    上。
- 已有但不对：`package.json` 的 `version` 为 `0.1.0`；`scripts/release.ts` 的 `TA14_FIXTURES`
  只有 `throwing-guard` 与 `full`；README 的状态与安装示例写的是 v0.1.0。
- 完全没有：npm 12 的安装实测（v0.1.0 发布时本机为 npm 11.19.0）。

## ⚠️ 关键落地约束（必须先验证）

- **发布前须有结论**：M2-05 的宿主实测完成且结论写入调研文档；缺任一项时不创建 tag。
- **Node 22.0.0**：确认 v0.1.0 发布时下载的可执行文件仍在且 `--version` 为 `v22.0.0`；不在时
  请维护者确认后重新下载。
- **安装冒烟沿用 `full`**：F-10-05 不变；v0.2.0 的组件与执行后检查由夹具比对与 M2-05 的宿主
  实测覆盖。
- **npm 12**：在容器 `shell` 中安装 npm 12 后，以 `allow-git=root` 从 GitHub 安装 `v0.2.0`；
  不改宿主机的全局 npm。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 否 | |
| 产物零依赖 | 是 | 安装冒烟中从 `dist/` 打包的入口只含 `node:` 导入 |
| 不在运行时推断宿主 | 否 | |
| 确定性输出 | 是 | TA-14：Node 22.0.0 与 Node 24 运行 `throwing-guard`、`full`、`after-tool` 的入口用例，输出逐字一致 |
| 不越权写入 | 是 | 发布脚本只在仓库中写 `dist/` 与提交、tag；安装冒烟与 GitHub 安装只写临时目录 |
| 安装不运行脚本 | 是 | TA-10：未放行构建脚本即安装成功；pnpm 与 npm 12 从 GitHub 安装时同样不放行脚本 |
| 能力数据有出处 | 否 | |

## 任务

### 1. 版本与发布脚本（`package.json`、`scripts/release.ts`、`test/release/`）

- `version` 改为 `0.2.0`；`TA14_FIXTURES` 按修订后的 TA-14 加入 `after-tool`；发布脚本的单元
  测试照常通过。

### 2. README

- 状态一节写明 v0.2.0 的范围与发布方式；安装示例改为 `v0.2.0`；“v0.1.0 范围”一节改为当前
  版本的范围（目标不变，组件加 agents 与 MCP 服务器，守卫加执行后检查）。
- 写明 MCP 服务器与命令 hooks 经 `{pluginRoot}` 引用的文件不由构建复制，经
  `overrides/<宿主>/` 放入插件目录（承接
  [M2-04 验收 §7](../acceptance/M2-04-mcp-servers.md#7-已知限制与技术债) 第 3 行）。

### 3. 发布与发布后核验

- 同步本 Sprint 的提交到公共仓库并推送 `main` 后，在公共仓库检出中运行发布脚本；维护者确认后
  单独推送 `v0.2.0`。
- 推送后在容器中各用 pnpm 与 npm 12 从 `github:xumetide-dev/uapa#v0.2.0` 安装，对 `full` 夹具
  运行 `uapa build`，产物与期望一致。

### 不改的地方（红线）

- `main` 不提交 `dist/`；不发布到 npm registry，不配置 CI。
- 发布脚本的前置检查、提交方式与安装冒烟的步骤不变。

### 测试

- 发布脚本的单元测试：缺少 `--node22`、未知参数、工作区不干净、tag 已存在、`--node22` 版本
  不符时失败，不创建提交与 tag。
- TA-14 的 3 个夹具入口用例在两个 Node 版本上逐字一致。

## 验收

```bash
pnpm check
node --test test/release/release.test.ts
node scripts/release.ts --node22 <Node 22.0.0 的路径>
```

发布后核验（容器 `shell`）：pnpm 与 npm 12 各从 `github:xumetide-dev/uapa#v0.2.0` 安装一次并
构建 `full` 夹具。

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 发布脚本的输出：TA-14 的用例数、发布提交新增的 `dist/` 文件数、安装冒烟结果；
3. 推送结果与 GitHub 安装的记录；
4. 判断范围和已知限制。

## 边界

- 允许新增与修改：`package.json`、`scripts/release.ts`、`test/release/`、`README.md`、与发布
  相关的架构文档。
- 禁止修改：`src/` 的行为。

## 依赖

M2-05；维护者确认创建与推送 `v0.2.0` tag。
