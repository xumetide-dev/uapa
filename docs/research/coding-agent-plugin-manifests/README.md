# 编码代理插件开发方式与 manifest 调研

本目录回答两个问题：主流编码代理的插件（plugin）如何开发、manifest 是什么结构；一份插件
源项目能否构建出多个宿主各自的插件包。覆盖 Claude Code、OpenAI Codex、OpenCode、
DeepSeek Harness（DSH）、Kimi Code、腾讯 CodeBuddy / WorkBuddy、GitHub Copilot、Cursor、Kiro、
Antigravity CLI（agy）十个平台。事实核对日期为 2026-10-13（agy 为 2026-10-14）；各平台插件机制仍在快速变化，引用前以对应官方文档的
当前版本为准。

不在范围：MCP 协议本身、插件商店的商业条款、IDE 自身的扩展机制（如 VS Code `.vsix`）。

## 结论摘要

| 平台 | manifest |
|---|---|
| Claude Code | `.claude-plugin/plugin.json`，可选，仅 `name` 必填；`hooks.json` 可含进程内 hooks 模块 |
| Codex | 根 `plugin.json` + `extensions.com.openai`；`.codex-plugin/plugin.json` 兼容；0.162.1 只为兼容格式加载 hooks |
| GitHub Copilot | 带 `$schema` 的根 `plugin.json`；另识别 Copilot、Claude、OpenPlugin 旧格式 |
| Cursor | `.cursor-plugin/plugin.json`；根 `plugin.json` 只承载 skills 与 MCP |
| Kiro | Power 的根 `plugin.json`；旧版 `POWER.md` |
| CodeBuddy / WorkBuddy | `.codebuddy-plugin/`、`.workbuddy-plugin/`、`.claude-plugin/` 下的 `plugin.json` |
| Kimi Code | `kimi.plugin.json` 或 `.kimi-plugin/plugin.json` |
| agy | 根 `plugin.json`，只允许 `name`、`description`；hooks 在根 `hooks.json` |
| DSH | npm `package.json` 的 `dsh.bundle` + `cordis.patch.yml`（代码插件） |
| OpenCode | 无 manifest；JS/TS 模块，在 `opencode.json` 的 `plugin` 中启用（代码插件） |

- 五家读取根目录 `plugin.json`（Codex、Copilot、Cursor、Kiro、agy），但必填字段、允许字段与组件
  位置各不相同，manifest 需按宿主分别生成。
- `.claude-plugin/` 被多家读取：CodeBuddy / WorkBuddy 兼容其 `plugin.json`，VS Code、
  Copilot CLI、Codex 识别其 manifest 或 marketplace 位置。
- 插件根目录变量没有通用写法：Copilot 展开 `${PLUGIN_ROOT}`，Cursor 不展开。
- hooks 的控制能力逐平台不同：Claude Code、Codex、Copilot CLI、Cursor、CodeBuddy、OpenCode、
  agy 能在执行前改写工具入参，Kimi Code、Kiro、DSH 不能；停机门禁在 Cursor、OpenCode 与 Kiro IDE
  上不可用。
  对照表见 [跨平台对比](cross-platform-comparison.md#hooks-控制能力)。
- Claude Code 的 hooks 模块与命令 hooks 在同一插件中并存时都会执行，需要按会话 id 去重
  （2.1.296 本地实测，见 [本地实测记录](claude-code-local-tests.md)）。
- 命令 hooks 出错（非预期退出码、超时、无法启动）时，多数宿主默认放行；Copilot CLI 的
  `preToolUse` 对非零退出码拒绝，agy 的 `PreToolUse` 出错即阻断（1.3.4 本地实测），Cursor 可设
  `failClosed`。执行前 hook 收到的工具名也逐平台
  不同（如 `Bash`、`Shell`、`execute_bash`），见
  [跨平台对比](cross-platform-comparison.md#工具名差异)。
- CodeBuddy 2.163.0 起默认开启 Mods（Beta），同样以 `hooks.json` 的 `modules` 键启用。
- 从一份插件源项目构建多宿主插件包的方案见 [UAPA 设计提案](unified-agent-plugin-architecture.md)
  与 [UAPA hooks 适配](uapa-hook-adapters.md)；实现以 `docs/architecture/` 与 `docs/feature-list/`
  为准，冲突时的依据见[仓库 README](../../../README.md#文档冲突时的依据)。

## 文档

| 文档 | 内容 | 状态 |
|---|---|---|
| [cross-platform-comparison.md](cross-platform-comparison.md) | 十平台横向对比：manifest 位置、hooks 控制能力、MCP 与路径变量差异、发布建议 | 已核实 |
| [claude-code-plugins.md](claude-code-plugins.md) | Claude Code 插件 manifest、命令 hooks 与 hooks 模块 | 已核实 |
| [claude-code-mods-guide.md](claude-code-mods-guide.md) | Claude Code hooks 模块（mod）开发指南 | 已核实 |
| [codex-plugins.md](codex-plugins.md) | OpenAI Codex | 已核实 |
| [opencode-plugins.md](opencode-plugins.md) | OpenCode | 已核实 |
| [dsh-plugins.md](dsh-plugins.md) | DeepSeek Harness 插件 manifest 与扩展点 | 已核实 |
| [dsh-cordis-plugin-guide.md](dsh-cordis-plugin-guide.md) | DSH Cordis 插件开发指南 | 已核实；示意代码未编译 |
| [kimi-code-plugins.md](kimi-code-plugins.md) | Kimi Code CLI | 已核实 |
| [agy-plugins.md](agy-plugins.md) | Antigravity CLI（agy） | 已核实；文档未写明处以 1.3.4 本地实测补充 |
| [workbuddy-codebuddy-plugins.md](workbuddy-codebuddy-plugins.md) | 腾讯 CodeBuddy / WorkBuddy | 已核实 |
| [github-copilot-plugins.md](github-copilot-plugins.md) | GitHub Copilot（VS Code、Copilot CLI） | 已核实 |
| [cursor-plugins.md](cursor-plugins.md) | Cursor | 已核实 |
| [kiro-powers.md](kiro-powers.md) | Kiro Powers | 已核实；官方文档存在矛盾处 |
| [unified-agent-plugin-architecture.md](unified-agent-plugin-architecture.md) | UAPA：定位、源项目、后续目标与产物 | 设计提案；实现以 `docs/architecture/` 与 `docs/feature-list/` 为准 |
| [uapa-hook-adapters.md](uapa-hook-adapters.md) | UAPA：守卫逻辑的公共类型与各宿主 hooks 适配 | v0.1.0 目标的部分为实现依据；其余为设计提案 |
| [modular-development.md](modular-development.md) | 扩展形态分层与迁移指南 | 示例与迁移步骤；UAPA v0.1.0 尚未实现 |
| [claude-code-local-tests.md](claude-code-local-tests.md) | Claude Code 本地实测记录 | 可复现 |
| [codex-source-review.md](codex-source-review.md) | Codex hooks 源码核对记录（rust-v0.162.1） | 源码与上游测试核对；未在宿主中运行 |

平台文档中未能核实或只有社区来源的内容，在原处标注“未核实”“经搜索摘要核对”或【社区】。

## 依据

- 官方文档与官方仓库为主证据；源码结论注明 tag 或提交，DSH 以上游提交 `d743267388` 为准。
- Claude Code 的部分行为以 2.1.296 本地实测为准，见 [本地实测记录](claude-code-local-tests.md)；
  agy 的部分行为以 1.3.4 本地实测为准，见 [agy](agy-plugins.md#本地实测)；Codex 的 hooks 行为以
  rust-v0.162.1 源码核对为准，见 [Codex hooks 源码核对记录](codex-source-review.md)。
- 社区来源标注【社区】，仅用于版本差异与实践补充。

## 维护

- 官方文档 URL 有迁移记录：Codex 文档由 `developers.openai.com/codex/*` 重定向至
  `learn.chatgpt.com/docs/*`；OpenCode 仓库由 `sst/opencode` 迁至 `anomalyco/opencode`；
  `copilot.tencent.com/docs` 跳转至 `codebuddy.cn`。CodeBuddy 文档站对不存在的路径也返回
  HTTP 200，更新前以页面内容确认链接有效。
- 新增或更新平台时，同步修改平台文档与 [cross-platform-comparison.md](cross-platform-comparison.md)；
  宿主行为变化影响 UAPA 映射时，同步修改 [uapa-hook-adapters.md](uapa-hook-adapters.md)；
  实现后同时更新 `src/capabilities/` 中对应目标的能力数据。
- “核实”须附官方文档 URL、公开源码位置或可复现的本地实测；设计评审结论标为“设计提案”。
