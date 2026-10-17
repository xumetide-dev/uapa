# Codex 实测记录

本文记录在 Codex 中安装插件运行的实测，供复现。源码核对见
[Codex hooks 源码核对记录](codex-source-review.md)，文档结论见 [Codex 插件](codex-plugins.md)。

## 容器实测（0.162.1）

2026-10-15，Linux 测试容器中的 codex-cli 0.162.1，模型服务为本机配置的 provider。产物为夹具
期望树中插件目录的副本，写入本地 marketplace 后安装；守卫的提示只要求运行标记命令，命令转换的
实测在临时 git 仓库中审查一行改动。

```bash
codex plugin marketplace add <marketplace 根目录>
```

```bash
codex plugin add <插件名>@<marketplace 名>
```

- 安装后插件位于 `~/.codex/plugins/cache/<marketplace>/<插件>/<版本>/`。
- 信任：安装后首次启动 TUI 时出现 “Hooks need review” 对话框，列出新增或改动的 hooks 数量；
  选 “Trust all and continue” 后用户层 `config.toml` 中每个 hook 记一条 `trusted_hash`，之后的
  `codex exec` 运行这些 hooks。信任之前 `codex exec` 静默跳过插件的 hooks，拒绝的标记命令照常
  执行。
- 探测插件只在 TUI 中信任一次，之后在同一容器中改模式文件，四个 hook 照常运行：信任不受脚本
  文件内容影响。
- 容器中运行 TUI：镜像没有 `ps`，需加 `--no-daemon`；provider 配置写了 `requires_openai_auth`
  时 TUI 先显示登录界面，写入信任时以 `-c model_providers.<provider>.requires_openai_auth=false`
  跳过。
- 容器中 `codex exec -s read-only` 的命令都不执行：沙箱的 bwrap 不能创建 namespace。实测沿用
  容器配置的 `danger-full-access`。

| 项目 | 做法 | 结果 |
|---|---|---|
| 拒绝 | `full` 产物，要求运行 `echo uapa-deny-probe > deny.txt` | 命令不执行，`deny.txt` 不存在；日志为 `Command blocked by PreToolUse hook: 拒绝标记命令 uapa-deny-probe`，模型报告该命令被 hook 拦下 |
| 改写 | 要求运行 `echo uapa-rewrite-probe x > rewrite.txt` | 执行的是 `echo uapa-rewritten x > rewrite.txt` |
| 停机继续 | 同一会话 | 模型按停机原因继续两轮后结束，计数文件归零 |
| 提示阻断 | `full` 产物，`codex exec --json` 提交含 `API_KEY=uapa-prompt-probe` 的提示 | 只有 `turn.started` 与 `turn.completed` 两个事件，`usage` 的输入与输出 token 都为 0，没有模型回复：提示被拦下，未调用模型。exec 的文本输出只有 `hook: UserPromptSubmit Blocked`，不含原因；TUI 中显示 `Blocked by hook` 与原因 `提示中含疑似密钥`。不含标记的对照提示得到模型回复 |
| hook 以 1 退出 | 探测插件在 `PreToolUse`、`UserPromptSubmit`、`PostToolUse`、`Stop` 上运行同一个脚本（`timeout` 为 3），提示要求运行 `date +uapa-%s \| tee probe.txt` 并回复其输出 | 四个 hook 都运行并以 1 退出：命令执行，`probe.txt` 写入，提示送达模型，模型回复与 `probe.txt` 相同（工具输出保留），本轮照常结束 |
| hook 超时 | 同上，脚本等待 10 秒 | 四个 hook 都启动，都没有写出结束记录（超时时被终止）；命令执行、提示送达、工具输出保留、本轮结束，同上 |
| stdout 不是 JSON | 同上，`PreToolUse` 与 `PostToolUse` 输出 `uapa-not-json` | 命令执行，工具输出保留，本轮照常结束 |
| `UserPromptSubmit` 输出纯文本 | 同上，`UserPromptSubmit` 以 0 退出并输出 `uapa-not-json` | 两次运行都在 300 秒内没有调用模型，事件只有 `turn.started`；按源码该文本作为附加上下文。UAPA 的入口放行时以 0 退出、不输出文本 |
| 扣留 | `after-tool` 产物，运行 `echo uapa-withhold-probe` | 工具结果为扣留原因（日志 `error=扣留标记输出 uapa-withhold-probe`）；模型回复 `uapa-withhold-probe`，与原因中的标记相同，单看回复不能区分 |
| 替换降级为扣留 | 运行 `echo uapa-replace-probe` | 工具结果为替换文本，模型回复 `uapa-replaced`，读不到原输出 |
| MCP 服务器 | `components` 产物，`mcp/` 中另放桩服务器 | `codex mcp list` 列出 `docs`、`plain`、`remote`（`launcher` 已由 UAPA 跳过）；`docs` 的工作目录为插件目录（`"cwd": "."`），`./mcp/server.mjs` 按它解析，`UAPA_DATA` 原样为 `./data`；远程服务器连接失败只记错误日志 |
| `"mcpServers": {}` | 两个只含 `.mcp.json` 的插件，manifest 分别写 `{}` 与不写 `mcpServers` | 写 `{}` 的插件不加载 `.mcp.json` 中的服务器；不写的插件加载 |
| 命令转换 | `rules-commands` 产物，含 `commands/review.md`（`description` 为“审查当前改动并列出问题”）；安装后查看插件目录 | 新增 `.codex-plugin/migrated-command-skills/source-command-review/SKILL.md`，`commands/review.md` 保留。frontmatter 为 `name: "source-command-review"` 与命令的 `description`；正文为一句英文说明，其后 `## Command Template` 下为命令正文 |
| 技能列表 | `codex exec` 要求列出可用技能 | 列出 `rules-commands:source-command-review` 与其描述 |
| 显式调用 | `codex exec '$rules-commands:source-command-review'` | SKILL.md 全文以 `<skill>` 包裹作为用户消息加入会话；模型按命令正文审查工作区改动并回复结论 |
| 不带插件名 | `codex exec '$source-command-review'` | 不加入 SKILL.md；模型从技能列表认出该技能，改用命令读取 SKILL.md |
| 隐式调用 | 提示“请审查当前工作区的改动并列出问题。” | 模型按描述选用该技能，读取 SKILL.md 后审查，指出新增的一行 |
| TUI 中调用 | 输入框中键入 `$source-command` | 补全列表显示 `[Skill] 审查当前改动并列出问题`；Tab 补全为 `$rules-commands:source-command-review`，提交后与显式调用相同 |
