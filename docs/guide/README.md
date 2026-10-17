# UAPA 帮助文档

本目录说明怎样用 UAPA 从一份源项目构建 Claude Code、Codex 与 Antigravity CLI（agy）的插件：
写源项目、配置目标、编写守卫、构建与检查、在宿主中安装。内容对应 v0.4.0。

字段、文件位置与退出码的权威定义在[架构文档](../architecture/architecture.md)与
[模块接口](../architecture/module-interfaces.md)，宿主行为的出处在
[宿主调研](../research/coding-agent-plugin-manifests/README.md)。本目录引用它们、不另作定义；
两者不一致时以架构文档与调研文档为准。

## 站点地图

| 页面 | 回答的问题 | 读者 |
|---|---|---|
| [快速上手](getting-started.md) | 安装 UAPA，从最小的源项目构建出三个宿主的插件，并在宿主中加载 | 插件作者 |
| [源项目结构](source-project.md) | skills、agents、rules、commands、MCP 服务器、共用文件与覆盖文件放在哪里，各宿主怎样承载 | 插件作者 |
| [构建配置](configuration.md) | `uapa.config.ts` 的字段、宿主选项与两种产物布局 | 插件作者 |
| [编写守卫](guards.md) | 执行前、提示提交前、执行后与停机前检查的写法、约束与测试 | 插件作者 |
| [命令 hooks](command-hooks.md) | 不经守卫、原样写入宿主 hooks 配置的命令 | 插件作者 |
| [目标与宿主差异](targets.md) | 四个目标的能力、降级与残余风险，Claude Code 的两种形态 | 插件作者 |
| [构建、检查与报告](build-and-check.md) | `uapa build` 与 `--check` 的输出、退出码、构建报告与持续集成中的用法 | 插件作者 |
| [安装与分发](install.md) | 在各宿主中加载产物、信任 hooks、分发给团队 | 插件作者 |
| [常见错误](troubleshooting.md) | 构建与安装时的错误信息、原因与处理办法 | 插件作者 |
| [开发 UAPA](developing-uapa.md) | 仓库结构、检查与测试、宿主升级时怎样更新能力数据 | UAPA 开发者 |

## 阅读顺序

- 第一次使用：[快速上手](getting-started.md) → [源项目结构](source-project.md) →
  [构建配置](configuration.md) → [编写守卫](guards.md) → [安装与分发](install.md)。
- 插件已能构建，要弄清某个宿主上守卫是否完整生效：[目标与宿主差异](targets.md) →
  [构建、检查与报告](build-and-check.md)。
- 修改 UAPA 本身：[开发 UAPA](developing-uapa.md) → [架构](../architecture/architecture.md) →
  [功能清单](../feature-list/README.md)。

## 基本概念

| 术语 | 含义 |
|---|---|
| 宿主 | 加载插件的编码代理：`claude-code`、`codex`、`agy` |
| 目标 | `<宿主>:<形态>`，如 `codex:subprocess`；`subprocess` 为每个事件启动一个 Node 子进程的命令 hooks，`in-process` 为 Claude Code 的 hooks 模块 |
| 源项目 | 插件作者维护的目录：`uapa.config.ts`、skills、agents、rules、commands、MCP 服务器、守卫逻辑、共用文件与覆盖文件 |
| 插件目录 | 一个宿主的安装命令接收的目录；默认为 `dist/<宿主>`，同一宿主的目标写入同一目录 |
| 守卫 | 插件在工具调用、提示提交与停机前做出的放行、拒绝、改写或阻断判断；由 `guard` 指定的文件实现 |
| 能力 | 目标能否改写入参、替换或扣留输出、阻止停机、拦截提示；缺少时决策降级或不生成对应 hook |
| 降级 | 守卫的决策在目标上以较弱的方式执行，如不能改写入参时把改写按拒绝处理 |
| 残余风险 | 构建成功、但守卫在某些条件下不生效的情况，如宿主机器缺少 Node 时 |

完整术语表见[架构「术语」](../architecture/architecture.md#术语)。
