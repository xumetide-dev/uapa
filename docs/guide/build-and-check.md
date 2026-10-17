# 构建、检查与报告

本文说明 `uapa build` 与 `uapa build --check` 的输出与退出码、构建报告的读法，以及在持续集成中
的用法。退出码与报告字段的权威定义见
[模块接口 §8](../architecture/module-interfaces.md#8-写出比对与退出码)与
[构建报告](../architecture/build-report.md)。

## 命令

```text
用法：uapa build [--config <路径>] [--check]
      uapa --help | --version
```

| 选项 | 说明 |
|---|---|
| `--config <路径>` | 构建配置文件，默认为当前目录下的 `uapa.config.ts`；相对路径以当前目录为基准 |
| `--check` | 只比对产物与磁盘，不写文件；列出差异，有差异时以退出码 1 结束 |
| `--help` | 显示帮助 |
| `--version` | 显示 UAPA 的版本 |

一次构建依次：加载并校验配置 → 读取源项目与守卫 → 检查各目标的组件承载与守卫能力 → 按宿主生成
manifest、hooks 配置与入口 → 放置 skills、agents 与覆盖文件 → 写出 → 运行宿主校验 → 写出构建
报告。

## 输出与退出码

构建时 stdout 每个目标一行摘要，最后一行是报告路径：

```text
成功 claude-code:subprocess：跳过 0，降级 0，残余风险 3
成功 codex:subprocess：跳过 0，降级 0，残余风险 5
失败 agy:subprocess：跳过 0，降级 0，残余风险 0
构建报告：dist/uapa-report.json
```

错误写到 stderr，每行以 `uapa: ` 开头：目标的错误写作 `uapa: <目标>: <原因>`，配置与源项目的
错误写作 `uapa: <文件>: <字段>: <原因>`。

```text
uapa: agy:subprocess: 守卫的 requires 声明了 promptGate，本目标缺少该能力
```

| 退出码 | 条件 | 写文件 |
|---|---|---|
| 0 | 全部目标成功；`--check` 时另须无差异 | 构建时写出；`--check` 不写 |
| 1 | 至少一个目标失败（能力检查、生成与字段检查、合并冲突、宿主校验），或 `--check` 有差异 | 成功的目标照常写出 |
| 2 | 命令行用法错误；配置、源项目或守卫加载失败；未预期的异常 | 不构建任何目标，不写报告 |

一个目标失败不影响其他宿主的目标；同一宿主的生成出错时，该宿主的目标全部失败。

## 比对模式 `--check`

`--check` 在内存中生成全部产物，与磁盘逐字节比对，不写文件、不写报告、不运行宿主校验。没有差异
时 stdout 为空；有差异时每行一个文件，按路径排序：

```text
removed dist/agy/extra.txt
modified dist/codex/skills/commit-message/SKILL.md
```

- `added`：将新增的文件；`modified`：内容不同的文件；`removed`：默认布局下写入前会被清除的文件。
- 合并布局只比对生成的文件，不列出目录中的其他文件。
- 目标失败时 stderr 照常写出错误，以退出码 1 结束。

同样的输入总是生成逐字节相同的产物与报告：报告不含时间、绝对路径与用户名。因此可以把产物提交
进仓库，并在持续集成中用 `--check` 确认它们与源项目一致。

## 构建报告

报告写在 `<outDir>/uapa-report.json`，每个目标一项，按配置中的目标顺序排列。下例取自
[`full` 夹具](../../test/fixtures/full/expected/tree/dist/uapa-report.json)的 agy 目标：

```json
{
  "target": "agy:subprocess",
  "status": "ok",
  "errors": [],
  "host": {
    "name": "agy",
    "version": "1.3.5",
    "checked": "2026-10-15",
    "source": "agy-plugins.md"
  },
  "units": [{ "kind": "plugin", "path": "dist/agy" }],
  "skipped": [],
  "degraded": [],
  "overridden": [],
  "hostValidation": "none",
  "residualRisks": [
    "缺少 Node ≥ 22 或入口无法启动时，停机前检查不生效（宿主在 hook 出错时放行）",
    "本目标缺少 promptGate，未生成提示提交前检查的 hook：提示不受检查",
    "停机计数存放在系统临时目录下的 uapa-<插件名>/，该目录被清理时停机计数归零"
  ]
}
```

| 字段 | 含义 |
|---|---|
| `status`、`errors` | `ok` 或 `failed`，以及失败的原因 |
| `host` | 能力数据核对的宿主版本、日期与出处文档 |
| `units` | 该目标的插件目录；失败且未写出文件的目标为空 |
| `skipped` | 未产出的组件与原因，如 Codex 的 `agents/<name>.md`、`mcpServers.<名称>`、`commandHooks[<下标>]` |
| `degraded` | 以较弱方式执行的决策，如 `{ "decision": "replace", "as": "withhold" }` |
| `overridden` | 被覆盖文件覆盖或新增的文件，相对插件目录 |
| `hostValidation` | `passed`、`failed`、`skipped`（如 PATH 中没有 `claude`）或 `none`（该宿主没有校验命令，或未写出文件） |
| `residualRisks` | 构建成功但守卫在某些条件下不生效的情况 |

### 怎样处理残余风险

残余风险不使构建失败，由插件作者判断能否接受：

- “缺少 Node ≥ 22 或入口无法启动时 … 不生效”：确认使用者的机器上有 Node ≥ 22；Claude Code 可
  同时配置 `claude-code:in-process`，见[目标与宿主差异](targets.md#claude-code-的两种形态)。
- “本目标缺少 <能力> …”：该检查在此目标上不生效。必须生效时把能力写进守卫的 `requires`，让该
  目标构建失败，而不是带着缺口发布。
- Codex 的“只运行已信任的 hooks”：在安装说明中写明信任步骤，见[安装与分发](install.md#codex)。

## 在持续集成中使用

在 `package.json` 中加脚本：

```json
{
  "scripts": {
    "plugin:build": "uapa build",
    "plugin:check": "uapa build --check"
  }
}
```

产物提交进仓库时，持续集成运行：

```bash
pnpm run plugin:check
```

以退出码 1 结束说明源项目改了但产物没有重新构建，或某个目标失败；按 stdout 的差异行与 stderr
的错误处理。守卫的单元测试另行运行，见[编写守卫「测试守卫」](guards.md#测试守卫)。
