# 技术验收

本文列出用户故事看不到、但必须验证的能力。每项引用它承接的功能编号，引用的功能不晚于该项的
阶段；阶段为预留的项随对应宿主恢复排期（[SD-26、SD-27](scope-decisions.md)）。验证方法与通过
标准写成可执行的检查。“层次”说明每项在哪里运行：

| 层次 | 运行方式 | 是否在 `pnpm check` 中 |
|---|---|---|
| 单元 | `node --test`，不启动宿主，不访问网络 | 是 |
| 夹具 | `node --test` 构建 `test/fixtures/` 并与期望产物逐字比对；PATH 中不含宿主命令 | 是 |
| 发布前 | 发布脚本（F-10-04）在检查通过后运行 | 否 |
| 宿主实测 | 维护者在装有宿主的机器上手动运行，结果写入调研文档与能力数据 | 否；不阻塞日常测试与发布，TA-15 中 SD-22、SD-23 所列各项除外 |

| 编号 | 名称 | 阶段 | 层次 | 功能 | 验证方法 | 通过标准 |
|---|---|---|---|---|---|---|
| TA-01 | 产物入口不导入 npm 包 | v0.1.0 | 夹具 | F-04-06, F-04-07 | 解析各目标入口、守卫文件与 `hooks/register.ts` 的导入语句 | 子进程入口只导入 `node:` 内置模块；`hooks/uapa-guard.mjs` 只导入 `'claude-code'`；`hooks/register.ts` 只导入 `./uapa-guard.mjs` |
| TA-02 | 共享运行时不引用 Node | v0.1.0 | 单元 | F-02-01, F-04-01, F-04-02, F-05-05 | 运行 `tsc -p tsconfig.runtime-core.json --noEmit`，检查 `src/runtime/core/` 与 `src/runtime/entries/claude-code-in-process.ts`；另以继承该配置、只包含 `test/` 下一个引用 `process` 的文件的临时配置运行 `tsc` | 前者通过，后者报错 |
| TA-03 | 执行前检查失败即拒绝 | v0.1.0 | 夹具 | F-04-04, F-05-04, F-05-06, F-06-04, F-11-04 | 用 `throwing-guard` 夹具（三个子进程目标）构建，向各子进程入口输入执行前与停机前事件，只向能力数据把 `promptGate` 记为支持的目标输入提示提交前事件；另向每个入口输入一条缺少会话 id 的执行前事件；hooks 模块的异常收口由 TA-17 覆盖 | 守卫抛错时，执行前检查与已生成的提示提交前检查按该目标的拒绝写法输出（agy 为 stdout `decision: "deny"`、退出码 0，其余为退出码 2），原因为 `uapa: 守卫出错: throwing-guard`；缺字段输入的拒绝原因以 `uapa: 无法解析宿主输入` 开头；停机前检查以退出码 0 结束，stderr 含同一原因 |
| TA-04 | 能力缺失与未知目标在构建时失败 | v0.1.0 | 夹具 | F-01-03, F-01-05, F-03-02, F-03-13, F-09-02 | `requires-missing` 与 `invalid-config` 夹具；frontmatter 写未知目标名的单元测试；能力检查的单元测试以合成的 `TargetCapabilities` 覆盖五种能力在 `requires` 中与不在 `requires` 中两种情况；另以 `components.skills` 为 `'none'` 的合成能力数据覆盖 skill 未写 `targets` 与 `targets` 显式包含该目标两种情况 | 缺少能力的目标不产出，报告写明原因，其他目标照常产出，退出码 1；未知目标名以退出码 2 结束，不写任何文件；不能承载的 skill 未写 `targets` 时写入报告的 `skipped`（`component` 为 `skills/<name>`），显式包含该目标时该目标失败 |
| TA-05 | 入口不在运行时推断宿主 | v0.1.0 | 夹具 | F-04-06, F-05-04, F-06-04, F-11-04 | 对每个子进程入口运行 `full` 夹具的入口用例两次：第一次只设置本目标的数据目录变量；第二次另外设置 `CLAUDE_PLUGIN_DATA`、`PLUGIN_DATA`、`TMPDIR` 中不属于本目标的变量，各自指向不同的临时目录，并设置 `ANTIGRAVITY_CONVERSATION_ID` | 两次的退出码、stdout、stderr 逐字一致；状态文件只出现在本目标变量所指的目录中（agy 以 `TMPDIR` 指定系统临时目录，状态文件位于其下的 `uapa-<插件名>/`） |
| TA-06 | 产物确定性 | v0.1.0 | 夹具 | F-03-05, F-03-06, F-03-09 | 把 `full` 与 `merged` 夹具各自复制到两个不同的绝对路径下分别构建 | 两次的产物与 `uapa-report.json` 逐字节一致；其中不含构建机的绝对路径、用户名与时间 |
| TA-07 | 合并布局不越权写入 | v0.1.0 | 夹具 | F-03-06 | `merged` 与 `merged-conflict` 夹具 | 预置文件不被修改或删除；冲突时该目录不写入任何文件，构建失败并列出文件与目标 |
| TA-08 | 比对模式不写文件 | v0.1.0 | 夹具 | F-03-08, F-09-04 | `node --test` 测试代码：对 `full` 与 `merged` 夹具先运行 `uapa build`，再运行 `uapa build --check`；随后在 `full` 的产物中删除 `dist/agy/plugin.json`、修改 `dist/codex/.codex-plugin/plugin.json`、新建 `dist/claude-code/extra.txt`，在 `merged` 的源项目根目录新建一个无关文件，两者各再运行一次 `--check`；每次 `--check` 前后对目录做逐字节快照 | 首次 `--check` 退出码 0、stdout 为空；修改后 `full` 以退出码 1 结束，stdout 依次为 `added dist/agy/plugin.json`、`removed dist/claude-code/extra.txt`、`modified dist/codex/.codex-plugin/plugin.json`；`merged` 中的无关文件不产生差异，退出码 0；每次 `--check` 前后的快照一致 |
| TA-09 | 能力数据可追溯 | v0.1.0 | 单元 | F-03-01, F-03-09, F-05-01, F-05-14, F-06-01, F-11-01 | 检查每个能力数据模块与构建报告 | 每个模块写明宿主版本、核对日期与出处；报告带核对日期 |
| TA-10 | 安装不运行脚本 | v0.1.0 | 发布前 | F-10-03, F-10-05 | 检查 `package.json`；按 F-10-05 的步骤安装 | 没有生命周期脚本；未放行构建脚本即安装成功 |
| TA-11 | 双形态去重 | v0.1.0 | 宿主实测 | F-05-08, F-05-10 | 在 Claude Code 上同时加载两种形态；在会话的 Bash 中启动嵌套会话；命令入口提前退出的分支另由 `claude-both` 夹具的入口用例覆盖 | 同一事件只由模块执行；嵌套会话的命令 hooks 不被误跳过 |
| TA-12 | Claude Code 产物通过宿主校验 | v0.1.0 | 宿主实测 | F-01-06, F-03-12, F-05-02, F-05-03, F-05-05, F-05-06, F-05-07, F-05-09 | 对夹具的 Claude Code 产物运行 `claude plugin validate --strict`；夹具在 `overrides/claude-code/hooks/` 中提供 `*.test.ts`（拒绝、放行、停机继续与提示阻断各一例），复制进产物后运行 `claude plugin test` | 两个命令都通过 |
| TA-13 | Kimi Code 的 hook 规则字段 | 预留 | 单元 | F-08-03, F-08-05 | 检查生成的规则；向字段检查输入含额外字段的规则 | 规则字段不超出 `event`、`matcher`、`command`、`timeout`；额外字段使该目标失败 |
| TA-14 | 入口在 Node 22 与 24 上运行 | v0.1.0 | 发布前 | F-04-06 | 发布脚本以 `--node22 <路径>` 接收 Node 22.0.0 的可执行文件（子进程入口支持的最低版本），分别用它与运行发布脚本的 Node 24 运行 TA-03 与 `full` 夹具的入口用例；缺少该参数时发布脚本失败 | 退出码、stdout、stderr 逐字一致 |
| TA-15 | 宿主行为实测 | v0.1.0 | 宿主实测 | F-02-02, F-04-03, F-05-03, F-05-04, F-06-03, F-06-04, F-11-03, F-11-04 | 在各宿主中挂记录输入的 hook。入口前提（SD-22）：Claude Code 与 Codex 子进程目标的 stdin 中会话 id、工具入参（含 shell 命令字段）与提示文本的字段名；Codex 决策 JSON 的层级；Claude Code 改写输出是否另需 `permissionDecision` 等字段；Codex 插件 hooks 文件的 JSON 结构。发布前（SD-23）：Codex 命令处理器是否经 shell 执行；省略 matcher 时 Claude Code 与 Codex 的执行前 hook 是否匹配全部工具。其余：提示事件能否阻断；Codex 读取含 `modules` 键的 `hooks/hooks.json` 时的行为，以及指定 `extensions.com.openai.hooks` 后是否仍读取默认 `hooks/hooks.json`；Claude Code 与 Codex 的超时字段名，Codex hooks 处理器的字段集合。agy 的入口前提与失败默认已于 1.3.4 实测（[agy「本地实测」](../research/coding-agent-plugin-manifests/agy-plugins.md#本地实测)）；Claude Code 的各项已于 2.1.296 实测（[Claude Code 本地实测记录](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#命令-hooks)）；Codex 的各项已按 rust-v0.162.1 的源码与上游测试核对（[Codex hooks 源码核对记录](../research/coding-agent-plugin-manifests/codex-source-review.md)），在 Codex 中安装插件的确认见 M1-05 验收；Copilot CLI 与 Kimi Code 的实测项见 SD-26、SD-27 | 每个问题在对应宿主的调研文档中有一条结论，写明宿主版本、日期与实测方法（开源宿主可按对应 tag 的源码与上游测试核对，记为源码核对）；能力数据引用该结论；结论改变产物时，在同一提交中更新期望产物与受影响的功能条目。入口前提各项没有结论时，对应宿主的子进程入口不开始实现；入口前提与发布前各项没有结论时，v0.1.0 不发布；其余各项有结论之前，相关能力在能力数据中记为不支持 |
| TA-16 | 会话状态按会话隔离 | v0.1.0 | 夹具 | F-04-05 | `node --test` 测试代码，用 `single-claude`（M3 起）与 `full` 夹具的各子进程入口，数据目录指向临时目录（agy 以 `TMPDIR` 指定系统临时目录）：会话 `a` 触发停机前检查三次，在第一次与第二次之间插入会话 `b` 的一次，然后会话 `a` 再触发一次；另以会话 id `x/../y` 触发一次 | 会话 `a` 依次输出继续、继续、结束、继续，`uapa-stop-a.json` 中的计数依次为 1、2、0、1；会话 `b` 输出继续，计数为 1；会话 id `x/../y` 的状态文件为数据目录下的 `uapa-stop-x%2F..%2Fy.json` |
| TA-17 | hooks 模块的决策与异常收口 | v0.1.0 | 单元 | F-05-05, F-05-06, F-05-07, F-05-08 | 测试以 `node:module` 的解析钩子把 `'claude-code'` 解析到 `test/` 下的桩模块（提供 Mods 指南记载的 `atom`、`update` 等导入，以及记录处理函数与 `.catch` 处理器的 `on`），加载 `claude-both` 夹具产物中的 `hooks/uapa-guard.mjs`，调用 `register` 后逐一调用记录到的处理函数 | `tool.call` 的放行、拒绝、`Bash` 改写与非 `Bash` 改写，`prompt.submit` 的阻断，`classic.Stop` 的继续与结束，返回值符合 F-05-05；守卫抛错且 `next.called` 为假时 `.catch` 返回 `{ deny }`、`{ drop }`，`classic.Stop` 不阻止结束；`session.start` 以 `UAPA_MODULE_SESSION_<插件名>` 调用 `$.env.set`。桩只模拟 Mods 指南记载的接口，宿主中的实际行为由 TA-12 验证 |
| TA-18 | 命令 hooks 声明的写入 | v0.1.0 | 夹具 | F-01-09, F-03-15, F-05-15, F-06-08, F-11-06 | 用 `command-hooks` 夹具构建；F-03-15 的单元测试另覆盖显式限定的目标不承载该事件时失败 | 三个子进程目标的 hooks 配置含声明的 `SessionStart` 命令，事件名与 `{pluginRoot}` 的替换符合命令 hooks 声明第 2、3 节，排在守卫条目之后；`SessionEnd` 声明只出现在 `claude-code:subprocess` 与 `agy:subprocess` 的 `skipped` 中；`claude-code:in-process` 的 `skipped` 不含命令 hooks 声明 |
