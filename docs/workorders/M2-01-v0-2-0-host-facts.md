# 施工单 M2-01：v0.2.0 宿主事实与接口定稿

> 核对执行后检查、agents 与 MCP 服务器在三个宿主上的行为，结论写入调研文档与能力数据；据此
> 定下执行后检查的入口协议、agents 与 MCP 服务器的源项目模型与放置规则、构建报告的写法，并
> 补充范围决策、技术验收与夹具表。本单不实现功能。

| 项 | 内容 |
|---|---|
| 所属 Sprint | [M2-00](M2-00-v0-2-0-three-host-completion.md) |
| 覆盖功能点 | 无（调研文档、能力数据与接口文档；功能由 M2-02～M2-04 实现） |
| 依赖工单 | 无 |
| 关联 issue | 无 |
| 验收文件 | [M2-01](../acceptance/M2-01-v0-2-0-host-facts.md)（commit 号与验收结论只记在那里） |

## 现状（已定位）

- 已有且够用：
  - Claude Code：`PostToolUse` 的 stdin 含 `tool_response`（2.1.296 本地实测，见
    [本地实测记录](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#命令-hooks)）；
    官方文档记载 `updatedToolOutput` 可替换任意工具的输出（v2.1.121+）；Mods 指南记载
    `tool.call` 在 `next` 之后返回 `{ deny }` 扣留结果、返回 `{ result }` 须符合该工具的输出
    schema，`next` 结果的 `text` 为模型读到的文本。
  - Codex：官方文档记载 `PostToolUse` 返回 `decision: "block"` 时以反馈替换工具结果，
    `mcp.json` 要求每个服务器写明传输 `type`，见
    [Codex](../research/coding-agent-plugin-manifests/codex-plugins.md)。
  - agy：`PostToolUse` 的 stdin 不含工具输出，只能返回 `{}`；agents 为 `agents/<name>.md`
    （1.3.3 起另有根 `agents.json`），MCP 服务器写在根 `mcp_config.json`，远程服务器写
    `serverUrl`，见 [agy](../research/coding-agent-plugin-manifests/agy-plugins.md)。
- 已有但不对：
  - `src/capabilities/claude-code-in-process.ts` 与 `claude-code-subprocess.ts` 的
    `replaceOutput`、`withholdOutput` 为 `true`，没有实测出处；模块接口 §4 要求未实测的能力
    记为 `false`。
  - 设计提案第 4 节写“目标没有对应变量时该服务器构建失败”，与 F-11-08 的“列为跳过”不一致；
    文首的“仓库中还没有实现代码”与第 10 节的“Codex 待 TA-15 实测”已过时。
  - 构建报告的 `degraded` 写明 v0.1.0 只有一种；F-03-13 只列 `rewriteInput`、`stopGate`、
    `promptGate`；hooks 适配第 6 节的能力缺失表没有 agy 与 Codex 的执行后检查。
- 完全没有：
  - 执行后检查的入口协议：检查名、工具输出文本的取得、替换与扣留的输出写法、输入无法解析时
    的处理。
  - agents 与 MCP 服务器的源项目模型、放置规则与构建报告中跳过项的写法。
  - v0.2.0 的技术验收与夹具表条目。
- 宿主事实未核实：
  - Claude Code：`updatedToolOutput` 的取值类型、hooks 模块 `{ result }` 的形状、`.mcp.json`
    中 `${CLAUDE_PLUGIN_ROOT}` 是否展开、agents frontmatter 中未知键的处理。
  - Codex：`PostToolUse` 的 stdin 与输出字段、插件 MCP 文件的位置与格式、MCP 配置中插件根
    变量是否展开。
  - agy：MCP 配置中的变量与工作目录、`agents.json` 与 `agents/*.md` 同时存在时的处理。

## ⚠️ 关键落地约束（必须先验证）

- **实测只在容器中进行**：真实会话用 `test/container/run.sh shell`，临时插件放在 `mkdtemp`
  目录中；hooks 与 MCP 服务器只运行输出标记文本的命令（如 `echo uapa-after-tool-probe`），
  提示只要求模型运行这类命令。`claude -p` 同时写 `--permission-mode default` 与
  `--allowedTools`。
- **Codex 以源码核对为准**：rust-v0.162.1 的公开源码与上游测试，注明文件与测试名；在 Codex 中
  实测留到 M2-05，使用 Codex CLI 前须维护者确认。
- **agy 的插件安装只在容器中进行**：安装前确认没有并发的 agy 会话，结束后卸载；不删除认证卷
  `uapa-test-auth`。
- **得不出结论时**：对应能力记为不支持、组件承载记为 `none`，调研文档写明未核实项；接口文档
  不按推测写宿主格式。

## 硬约束核对

> 逐行判断本单是否触碰该约束，「是否触碰」只填 **是** 或 **否**。填「是」的行必须写明如何验证
> （测试名、夹具、入口用例或宿主实测步骤），验收 §1 会把这些行带成判定条目。
> 约束原文与依据见[施工单说明「硬约束」](README.md#硬约束)。

| 硬约束 | 是否触碰 | 如何验证 |
|---|---|---|
| 守卫不静默失效 | 否 | |
| 产物零依赖 | 否 | |
| 不在运行时推断宿主 | 否 | |
| 确定性输出 | 否 | |
| 不越权写入 | 否 | |
| 安装不运行脚本 | 否 | |
| 能力数据有出处 | 是 | TA-09 的单元测试通过；每个改动的取值在数据模块的注释中指向调研文档中带日期的实测或源码核对小节 |

## 任务

### 1. 宿主实测与源码核对（`docs/research/coding-agent-plugin-manifests/`）

- Claude Code（`claude-code-plugins.md`、`claude-code-local-tests.md`、
  `claude-code-mods-guide.md`）：
  - `PostToolUse` 的 `tool_response` 在 Bash 与 Read 上的形状；返回字符串与对象形式的
    `updatedToolOutput` 后模型读到的内容；hook 以退出码 1 结束与超时时原输出是否保留。
  - hooks 模块 `tool.call` 在 `next` 之后返回 `{ deny }` 与 `{ result }` 的效果，以及 `next`
    结果的字段；同一插件在 `tool.call` 上注册两个处理函数时的调用顺序。
  - `.mcp.json`：`${CLAUDE_PLUGIN_ROOT}` 在 `command`、`args`、`env` 中是否展开；远程服务器的
    `type` 与 `headers`。
  - agents：`agents/*.md` 的必填 frontmatter；frontmatter 含 `targets` 时 `validate --strict`
    的结果。
- Codex（`codex-source-review.md`）：`PostToolUse` 的 stdin 与输出字段、`decision: "block"` 的
  效果与 `reason` 的要求、出错与超时时的处理；兼容 manifest 插件的 MCP 文件位置、字段、
  `type` 取值与插件根变量；插件不承载 agents 的依据。
- agy（`agy-plugins.md`）：`agents/<name>.md` 的 frontmatter，与根 `agents.json` 同时存在时的
  处理；`mcp_config.json` 的字段、变量是否展开与服务器的工作目录。

### 2. 能力数据（`src/capabilities/*.ts`）

- 按第 1 项的结论修改 `replaceOutput`、`withholdOutput` 与 `components.agents`、
  `components.mcp`，注释写出处；`host.checked` 为核对日期。执行后检查的 `failureDefault` 条目
  随 `GuardCheck` 在 M2-02 加入，取值先写在调研文档中。

### 3. 范围决策与接口文档

- `scope-decisions.md` 新增 SD-29（执行后检查）：生成执行后 hook 的条件为 `withholdOutput`，
  缺失且 `requires` 不含时不生成并记为残余风险；`replaceOutput` 缺失且 `requires` 不含时
  `replace` 的处理与降级写法；守卫出错、返回值无效与输入无法解析时按扣留；工具输出文本的
  取得方式。
- `scope-decisions.md` 新增 SD-30（agents 与 MCP 服务器）：源文件格式、放置方（构建编排或
  宿主模块）、共用插件目录时的处理、跳过项的 `component` 写法、`{pluginRoot}` 无法换算时的
  处理。
- `module-interfaces.md` §3（`Agent`、`McpServer`、`SourceProject` 的新字段）与 §5
  （`TargetPlan` 的新字段、宿主模块写出 agents 与 MCP 文件的规则）。
- `runtime-interfaces.md` 第 2～4 节：检查名、`HostEvent` 的输出字段、协议中替换与扣留的方法、
  `checkAfterTool`。
- `build-report.md`：`degraded` 的新取值、执行后检查被省略时的残余风险、MCP 服务器的跳过项。
- hooks 适配第 4、6、7 节；功能清单中 F-03-13 的能力列举，以及按核对结论需要修订的 v0.2.0
  验收标准；设计提案的文首、第 4 节与第 10 节。

### 4. 技术验收与夹具表（`docs/feature-list/`）

- `technical-acceptance.md`：新增 TA-19（执行后检查的决策输出与异常收口）与 TA-20（agents 与
  MCP 服务器的写出），阶段 v0.2.0，层次为夹具；TA-14 加入 `after-tool` 夹具的入口用例；TA-04
  的能力检查单元测试覆盖 `replaceOutput`、`withholdOutput`。
- `modules/10-repo-release.md` 夹具表加入 `after-tool`（执行后检查，四个目标）与 `components`
  （agents 与 MCP 服务器，四个目标）两行，「加入比对」分别为 M2-02 与 M2-03（M2-04 加入 MCP
  服务器）。

### 不改的地方（红线）

- `src/` 中只改能力数据模块的取值与注释，其余代码不动。
- 不改 v0.1.0 功能条目的语义；F-03-13 只补 v0.2.0 的能力列举。
- 能力数据取值变化使夹具中打包的入口改变时，以 `node test/fixtures/update.ts <夹具>` 更新，
  核对 diff 只在内联的能力取值；夹具的 manifest、hooks 配置与构建报告不变。

### 测试

- 单元：TA-09 的能力数据可追溯测试通过。
- 夹具：现有 16 个夹具的比对与入口用例通过。
- 文档：`node scripts/check-feature-list.mjs` 通过；相对链接与锚点有效。

## 验收

```bash
pnpm check
node scripts/check-feature-list.mjs
```

宿主实测（容器 `shell`）：Claude Code 2.1.296 与 agy 1.3.4 的临时插件会话，记录写入对应调研
文档；Codex 为 rust-v0.162.1 源码核对。

验收文件 §3 会把这里的命令复制过去，逐条记录实际结果。

## 回报格式

1. 各检查与测试命令的结果（含测试计数）；
2. 宿主事实的结论、依据（实测步骤或源码位置）与未核实项；
3. 范围决策、接口文档与技术验收的改动清单；
4. 能力数据的改动及其出处；判断范围（文档 + 宿主实测）和已知限制。

## 边界

- 允许新增与修改：`docs/research/coding-agent-plugin-manifests/`、`docs/architecture/`、
  `docs/feature-list/`、`src/capabilities/*-*.ts` 的取值与注释、受影响夹具中打包生成的入口。
- 禁止修改：`src/` 的其他文件；v0.1.0 夹具的 manifest、hooks 配置与构建报告。

## 依赖

无。容器 `shell` 中的 Claude 令牌与 agy 登录由用户准备。
