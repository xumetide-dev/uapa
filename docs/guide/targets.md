# 目标与宿主差异

本文说明四个目标各能承载什么、宿主缺少的能力怎样处理，以及 Claude Code 两种形态的
取舍。数值取自各目标的能力数据（`src/capabilities/`），宿主行为的出处见
[宿主调研](../research/coding-agent-plugin-manifests/README.md)；其他宿主的范围决策见
[SD-01](../feature-list/scope-decisions.md)。

## 目标一览

| 目标 | 宿主 | hooks 的运行方式 | 能力数据核对的宿主版本 |
|---|---|---|---|
| `claude-code:in-process` | Claude Code | hooks 模块 `hooks/register.ts`，在宿主内运行，不需要 Node | 2.1.296 |
| `claude-code:subprocess` | Claude Code | 命令 hooks，每个事件以 `node` 运行 `hooks/uapa-claude-code.mjs` | 2.1.296 |
| `codex:subprocess` | Codex | 命令 hooks，以 `node` 运行 `hooks/uapa-codex.mjs` | codex-cli 0.162.1 |
| `agy:subprocess` | Antigravity CLI | 命令 hooks，以 `node` 运行 `hooks/uapa-agy.mjs` | 1.3.4（agents 与 MCP 为 1.3.5） |

子进程入口打包为 ES2022 ESM 单文件，需要运行宿主的机器上有 Node ≥ 22。

## 组件与能力

| 项 | Claude Code（两个目标） | Codex | agy |
|---|---|---|---|
| skills | 承载 | 承载 | 承载 |
| agents | 承载 | 不承载，记为跳过 | 承载 |
| rules | 不承载，记为跳过 | 不承载，记为跳过 | 承载，frontmatter 换为 agy 的写法 |
| commands | 承载 | 承载，安装时转换为技能 | 不承载，记为跳过 |
| MCP 服务器 | 承载 | 承载；`command` 含 `{pluginRoot}` 的跳过 | 承载；`command` 含 `{pluginRoot}` 的跳过 |
| 守卫选项 | 写入 `userConfig`，取使用者设置的值 | 取 `default`，记为残余风险 | 取 `default`，记为残余风险 |
| `rewriteInput` | 有 | 有 | 有 |
| `replaceOutput` | 有 | 无 | 无 |
| `withholdOutput` | 有 | 有 | 无 |
| `stopGate` | 有 | 有 | 有 |
| `promptGate` | 有 | 有 | 无（没有提示提交事件） |

缺少能力时的处理见[编写守卫「能力缺失时的处理」](guards.md#能力缺失时的处理)：守卫在
`requires` 中列出的能力缺失时该目标失败；未列出时决策降级或不生成对应 hook，写入构建报告。

## hook 出错与超时

子进程目标生成的 hooks 超时都为 30 秒。入口无法启动、崩溃或超时时的宿主行为：

| 目标 | 执行前检查 | 提示提交前检查 | 停机前检查 | 执行后检查 |
|---|---|---|---|---|
| `claude-code:subprocess` | 放行 | 放行 | 照常结束 | 保留原输出 |
| `codex:subprocess` | 放行 | 放行 | 照常结束 | 保留原输出 |
| `agy:subprocess` | 阻断 | 不生成 | 照常结束 | 不生成 |

- 放行与照常结束意味着守卫在该条件下不生效，构建报告按检查各写一条残余风险，如“缺少 Node ≥ 22
  或入口无法启动时，执行前检查不生效”。
- agy 的 `PreToolUse` 在出错、超时或 stdout 不是 JSON 时阻断工具调用（agy 1.3.4 本地实测）；
  `Stop` 出错、超时与输出无法解析时本轮照常结束（1.3.5 容器实测）。
- Codex 四个事件以 1 退出与超时时都放行，工具输出保留（codex-cli 0.162.1 容器实测）。
- `claude-code:in-process` 不启动进程：hooks 模块中守卫抛错时按拒绝处理，见
  [hooks 适配 §7](../research/coding-agent-plugin-manifests/uapa-hook-adapters.md#7-失败处理)。

## Claude Code 的两种形态

`claude-code:in-process` 与 `claude-code:subprocess` 写入同一个插件目录：`hooks/hooks.json`
同时含 `modules`（hooks 模块）与 `hooks`（命令 hooks）。

| Claude Code 版本 | 行为 |
|---|---|
| 2.1.287 及以上 | 两种形态都加载；模块生效的会话中，命令入口跳过，同一事件只处理一次（2.1.296 实测） |
| 2.1.271 至 2.1.286 | `modules` 被提示为已忽略的未知键，命令 hooks 照常运行 |
| 2.1.271 之前 | 对未知顶层键的处理未核实 |

- 去重：模块在会话开始时把会话 id 写入环境变量 `UAPA_MODULE_SESSION_<插件名>`（插件名转为大写、
  `-` 换为 `_`），命令入口在该变量等于 stdin 的 `session_id` 时跳过。`/clear`、`/resume`、
  `/branch` 之后与嵌套会话中的去重已实测，见
  [双形态去重的会话实测](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#双形态去重的会话实测)。
- 只配置 `claude-code:in-process`：不需要 Node，构建报告没有“缺少 Node”的残余风险，但只在
  2.1.287 及以上生效。
- 只配置 `claude-code:subprocess`：适用于不支持 hooks 模块的版本，需要 Node ≥ 22。
- 两者都配置：支持模块的版本用模块，较旧的版本用命令 hooks；[快速上手](getting-started.md)的
  配置采用这种写法。
- 写出后，PATH 中有 `claude` 时 UAPA 运行 `claude plugin validate --strict <插件目录>`，结果写入
  构建报告的 `hostValidation`；没有 `claude` 时为 `skipped`。

## Codex

- 只运行已信任的 hooks：安装后与 hooks 配置改动后，须在 TUI 启动时出现的 “Hooks need review”
  对话框中信任；信任之前 Codex 静默跳过插件的 hooks，守卫不生效。步骤见
  [安装与分发「Codex」](install.md#codex)。
- 含 hooks 的插件不能进入 Codex 的公开插件目录（构建报告的残余风险）。
- 只对执行成功的工具调用触发 `PostToolUse`；处理器报错与 MCP 结果 `isError` 为真的调用不受执行后
  检查。
- 安装插件时把 `commands/` 中的命令转换为技能；正文含 `$ARGUMENTS` 等模板写法或转换结果超过
  4000 字节的命令被跳过（rust-v0.162.1 源码核对）。转换后的技能以
  `$<插件名>:source-command-<命令名>` 调用，TUI 中键入 `$` 与名称片段时出现在补全列表；模型也按
  `description` 选用（codex-cli 0.162.1 容器实测）。

## agy

- 全局安装的插件对本机该用户的全部 agy 会话生效，hooks 也是（agy 1.3.4 本地实测）。
- 没有提示提交与会话结束事件；执行后 hook 不能替换或扣留输出，因此不生成。
- 宿主没有插件数据目录：停机计数存放在系统临时目录下的 `uapa-<插件名>/`，该目录被清理时归零。
- rules 以 `trigger` 与逗号分隔的 `globs` 生效（agy 1.3.5 实测）；`globs` 按文件的绝对路径
  匹配，含 `/` 的模式生成时加 `**/` 前缀。`agy plugin install` 与 `validate` 的输出不列出
  rules。单个规则文件上限 24,000 字节，超出部分被截断，生成的规则超过
  上限时构建报告写为残余风险。
- `agy plugin validate` 对结构错误的插件也报告 `[ok]`，不能作为校验手段；UAPA 在生成时对
  `plugin.json`、`hooks.json` 与 `mcp_config.json` 做字段白名单检查。

## 参考

- 能力数据的字段：[模块接口 §4](../architecture/module-interfaces.md#4-目标能力数据)。
- 决策在各宿主中的输出：
  [hooks 适配 §4](../research/coding-agent-plugin-manifests/uapa-hook-adapters.md#4-决策到宿主输出的映射)。
