# 施工单 M5-01：v0.4.0 宿主事实与接口定稿

> 本单做三件事：
> 1. 把覆盖审查中查到的宿主事实写入调研文档。
> 2. 在测试容器中实测 TA-25 的各项，按结论改写 SD-38～SD-41、SD-43 与相应的功能条目。
> 3. 把 v0.4.0 的接口写进架构文档。
>
> 本单不改源码。唯一的例外是 agy 能力数据的宿主版本与出处注释。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M5-00](M5-00-v0-4-0-host-coverage.md) |
| 覆盖功能点 | 无（TA-25，接口文档） |
| 依赖工单 | 无 |
| 关联 issue | 无 |
| 验收文件 | [M5-01](../acceptance/M5-01-v0-4-0-host-facts-and-interfaces.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 已有且够用：
  - 三个宿主的调研文档：`docs/research/coding-agent-plugin-manifests/` 下的 `agy-plugins.md`、
    `claude-code-plugins.md`、`claude-code-local-tests.md`、`claude-code-mods-guide.md`、
    `codex-plugins.md`、`codex-source-review.md`。
  - 容器入口 `test/container/run.sh shell`，含 Claude 令牌与 agy 登录。
  - 探测插件的做法见 M4-05 与 Codex「容器实测（0.162.1）」。
- 已有但不对：
  - agy 能力数据的 `host.version` 为 1.3.4，但 rules、agents、MCP 与 `Stop` 超时都在 1.3.5 上实测；
    `docs/guide/targets.md` 只写了“agents 与 MCP 为 1.3.5”。
  - `agy-plugins.md` 写“插件没有斜杠命令组件”，又写“直接放入的插件默认禁用”，与 CHANGELOG 1.2.7、
    1.2.11 不符。
  - `codex-plugins.md` 中有三处与源码或实测不符：
    - marketplace 的 `policy` 与 `category` 写为必填，源码中可以省略。
    - 写成“hooks 只对桌面端手动安装的插件生效”，与 0.162.1 的容器实测矛盾。
    - 写成“本地插件的版本记为 local”，源码先取 manifest 的 `version`，没有时才是 `local`。
  - `codex-source-review.md` 的 MCP 字段不全，没有记录本地服务器的环境隔离。
  - `claude-code-mods-guide.md` 只写了 `tool.call` 改写 Bash 的 `e.command`。
- 完全没有：
  - Claude Code 2.1.295～2.1.300 的 hooks 变化：`onFailure`、`UserPromptSubmit` 改在展开之前运行、
    `updatedInput` 的校验、hook 无法交接时改为拒绝。
  - Codex 的以下源码事实：`SessionEnd` 超时的压缩、`allow_managed_hooks_only`、
    `command_migration.rs` 的跳过条件、技能名长度与递归发现、marketplace 的读取顺序。
  - agy 的以下 CHANGELOG 事实：`PLUGIN_DATA`（1.3.2）、`bin/`、停机继续次数的上限（1.1.9）、
    `${extensionPath}`（1.0.7）。
  - v0.4.0 的接口：`files/`、`envVars`、`marketplace`、`hosts['claude-code'].manifest` 与
    `onFailure`、`Carrier` 的 `converted`、rules 换算的入口文件。
- 宿主事实的出处：
  - Claude Code：文档 `code.claude.com/docs/en/` 下的 skills、hooks、mcp、plugins reference、
    tools reference，以及 CHANGELOG。
  - Codex：`openai/codex` tag `rust-v0.162.1` 的源码。
  - agy：`antigravity.google/docs/` 与 `google-antigravity/antigravity-cli` 的 CHANGELOG。

## ⚠️ 关键落地约束（必须先验证）

- **实测只用无害的探测**：
  - 拒绝与改写只匹配标记命令，如 `echo uapa-deny-probe`。
  - 探测 MCP 服务器只报告标记变量 `UAPA_PROBE_ENV` 是否存在，不输出任何环境变量的值。
  - `claude -p` 同时写 `--permission-mode default` 与 `--allowedTools`。
  - 文件操作限定在临时目录。
- **Codex CLI**：不使用。Codex 各项按 rust-v0.162.1 源码核对；需要会话实测的项写明“待维护者
  确认后实测”，不按推测写成已核实。
- **结论不成立时**：对应功能条目改为预留，并另立 SD 写明理由；不在实现工单中按推测补救。
- **agy 用户级插件安装**：只在容器中安装，不在维护者机器上安装。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 否 | 不改守卫与入口 |
| 产物零依赖 | 否 | 不改入口与打包 |
| 不在运行时推断宿主 | 否 | 不改入口 |
| 确定性输出 | 否 | 不改生成逻辑 |
| 不越权写入 | 否 | 只改文档；“不越权写入”的范围扩展写进施工单说明，随 M5-06 实现 |
| 安装不运行脚本 | 否 | 不改 `package.json` |
| 能力数据有出处 | 是 | `agy-subprocess.ts` 的 `host.version` 改为 1.3.5，`host.checked` 改为实测日期，注释指向 1.3.5 的调研小节；TA-09 的测试照常通过 |

## 任务

### 1. 调研更正（`docs/research/coding-agent-plugin-manifests/`）

- `agy-plugins.md`：
  - 插件 skill 成为 `/<插件名>:<skill>` 斜杠命令。
  - 直接放入的插件只在 MCP 服务器需要配置变量时默认禁用。
  - agent frontmatter 的完整字段，以及 `tools` 写错时子代理可能挂起的已知问题。
  - `bin/` 与 sidecars（sidecars 只在 app 中可用）。
  - MCP 的 `disabled`、`disabledTools`、`oauth`；`url` 与 `${extensionPath}` 两处文档与 CHANGELOG
    的冲突。
  - 从 GitHub 子路径安装；只支持官方 marketplace。
  - PreInvocation 的输入与 `injectSteps`；停机继续次数的上限；空 decision 的处理；
    `/btw` 不运行用户与工作区 hooks。
  - 文档列出的工具入参。
  - 版本背景改为 1.3.5。
- `codex-plugins.md`：
  - 修正 marketplace 的必填说明，补读取顺序与 `ON_USE`、`products`。
  - 修正“hooks 只对桌面端手动安装的插件生效”。
  - 修正本地插件版本的说明。
  - 补 `hooks.state.<key>`、`[features].hooks`、6 个未用事件的输入与输出、IDE 扩展的限制。
- `codex-source-review.md`：
  - 补 MCP 的完整字段与本地服务器的环境隔离。
  - 关闭“未能由源码确定的项”中已能确定的三条。
  - 补以下各项：信任哈希的算法与 key、`allow_managed_hooks_only`、子代理结束触发 `SubagentStop`、
    同一事件的处理器并发执行、`SessionEnd` 超时的压缩告警、AgentPlugin 格式的占位符展开、
    技能的递归发现与名称长度、`command_migration.rs` 的跳过条件、marketplace 的读取顺序。
- `claude-code-plugins.md`：
  - 版本引用到 2.1.300（stable 渠道 2.1.292）。
  - hooks：`onFailure`、exec 形式、处理器类型与通用字段、`additionalContext` 及其上限、完整事件表、
    `SessionEnd` 的 1.5 秒预算、`@` 引用不触发 `PreToolUse`、`UserPromptSubmit` 的触发来源与时机、
    `updatedInput` 的校验。
  - manifest：保留名规则、透传字段、插件 agent 忽略的 frontmatter、变量的展开位置。
  - MCP 的完整字段；marketplace 的补充规则。
- `claude-code-mods-guide.md`：
  - `tool.call` 能改写任意工具的入参。
  - 补事件表、执行顺序与限制。
  - 2.1.299 的 `$.env.set` 与“值无法交接时拒绝”。
- `cross-platform-comparison.md`：工具名补 `Monitor`、`NotebookEdit`；修正 Codex 的 MCP 与
  桌面端限定的写法。
- `uapa-hook-adapters.md` §7：加入 `onFailure` 与 2.1.299 的 Windows 变化。

### 2. 容器实测（TA-25）

在 `test/container/run.sh shell` 中，每项的结论连同宿主版本写入对应调研文档的新小节：

| 编号 | 宿主 | 实测项 | 决定的功能 |
|---|---|---|---|
| 1 | Claude Code | `Monitor`、`NotebookEdit` 的 PreToolUse stdin 入参（记录入参的键名，标记命令） | F-05-22 |
| 2 | Claude Code | 本地 MCP 服务器是否继承会话环境（标记变量是否存在） | F-05-26 |
| 3 | Claude Code | 带 `paths` 与 `user-invocable: false` 的插件技能、`SessionStart` 纯文本输出在会话中的效果 | F-05-19 |
| 4 | Claude Code | 生成的 `.claude-plugin/marketplace.json`（`source` 为 `./claude-code` 与 `"./"` 两种）能否 `claude plugin marketplace add` 并安装 | F-05-24 |
| 5 | Claude Code | `onFailure: "block"` 在入口无法启动时阻断标记命令 | F-05-21 |
| 6 | agy | 插件 skill 以 `/<插件名>:<skill>` 调用，参数如何进入正文；安装时是否加载 `commands/`；技能是否被模型自动选用 | F-11-11 |
| 7 | agy | MCP `command` 中的 `${extensionPath}` 是否展开；本地服务器是否继承会话环境 | F-11-12 |
| 8 | agy | hook 进程的环境中是否有 `PLUGIN_DATA` | F-11-13 |
| 9 | agy | 内置子代理、插件 agent 与 `/btw` 中 PreToolUse 是否触发；停机继续次数的上限 | F-11-14 |

Codex 的对应项按源码核对：`SessionStart` 的纯文本输出、`env_vars`、marketplace 的字段与读取
顺序、commands 的跳过条件。会话实测写明待维护者确认。

### 3. 按结论改写功能清单

- SD-38～SD-41、SD-43 的状态改为已定，或按结论改写决定。
- 结论与功能条目不符时，改写该功能的验收标准；不成立时改为预留并另立 SD。
- F-11-01 的宿主版本改为 1.3.5；`agy-subprocess.ts` 的 `host.version`、`host.checked` 与出处注释
  同步。
- 改写已提交的验收骨架 §2 中受影响的验收要点。

### 4. 接口定稿（`docs/architecture/`）

- `module-interfaces.md`：
  - §2：`marketplace`、`hosts['claude-code'].manifest` 与 `onFailure`。
  - §3：`SourceProject.files`、本地服务器的 `envVars`。
  - §4：`Carrier` 的 `converted`。
  - §5：
    - 宿主模块取得 marketplace 信息并返回 marketplace 文件的方式。
    - rules 在 Claude Code 与 Codex 上的生成规则、commands 在 agy 上的生成规则。
    - `files/` 与生成文件的冲突。
  - §8：共用文件的放置顺序；marketplace 文件的写出与比对；插件目录是源项目根目录时 `files/` 的
    处理。
- `runtime-interfaces.md`：输出 `always` 规则的入口文件名、命令与打包方式；agy 入口的停机计数
  目录。
- `command-hooks.md`：Codex 的 `SessionEnd` 写 `timeout: 3`。
- `architecture.md`：依赖表与目录结构中新增的文件；`docs/workorders/README.md` 的“不越权写入”
  写明 marketplace 文件（随 SD-41）。

### 不改的地方（红线）

- 不改 `src/`，`src/capabilities/agy-subprocess.ts` 的版本与注释除外；不改夹具。
- 不改已发布版本的接口语义：v0.1.0～v0.3.0 的字段与产物写法不变，只追加 v0.4.0 的字段。
- 调研文档只写有出处的结论；推断标“未核实”。

### 测试

- 单元：TA-09 的能力数据出处测试照常通过。
- 宿主实测：任务 2 的 9 项，每项留存探测插件、命令与输出摘要（不含令牌与环境变量的值）。

## 验收

```bash
test/container/run.sh check
```

```bash
node scripts/check-feature-list.mjs
```

```bash
/usr/bin/python3 -I .claude/skills/doc-writing/scripts/check_links.py .
```

宿主实测（前置：容器中有 Claude 令牌与 agy 登录；Codex CLI 不使用）：

```bash
test/container/run.sh shell
```

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 最终实现方案、关键技术决策及其验证依据；
3. 主要改动点与涉及模块清单；
4. 测试覆盖、宿主实测结果、判断范围和已知限制；
5. 如适用，附生成的产物或入口的输入输出示例。

## 边界

- 允许新增与修改：`docs/research/coding-agent-plugin-manifests/`、`docs/architecture/`、
  `docs/feature-list/`、`docs/workorders/README.md`、`docs/guide/targets.md`、
  `src/capabilities/agy-subprocess.ts`（版本与注释）、M5 的验收骨架 §2。
- 禁止修改：其余 `src/`、`test/`、`test/container/run.sh` 的启动参数。

## 依赖

无。容器中的 Claude 令牌与 agy 登录由用户准备。
