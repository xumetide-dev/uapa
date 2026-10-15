# 常见错误

本文按出现的阶段列出构建与安装时的常见错误：现象、原因与处理办法。错误信息的格式见
[构建、检查与报告「输出与退出码」](build-and-check.md#输出与退出码)；文中 `<…>` 为占位。

## 命令行与配置（退出码 2）

以下错误发生在构建任何目标之前，不写产物与报告。

| 错误信息 | 原因 | 处理 |
|---|---|---|
| `uapa: 缺少命令（运行 uapa --help 查看用法）`、`uapa: 未知选项 <选项>（…）` | 命令行用法错误 | 运行 `uapa build`，选项见 `uapa --help` |
| `uapa: uapa.config.ts: 文件不存在` | 当前目录下没有配置文件 | 在源项目根目录运行，或以 `--config <路径>` 指定 |
| `uapa: <文件>: 相对导入缺少 .ts 扩展名：<路径>` | 配置或守卫中的相对导入没写扩展名 | 写成 `import { x } from './rules.ts'` |
| `uapa: <文件>: 使用了 Node 类型剥离不支持的语法：…` | 用了 `enum`、`namespace`、参数属性等 | 改用对象常量与普通字段 |
| `uapa: <文件>: 找不到导入的模块：<路径>` | 导入的文件不存在 | 核对路径；`'uapa'` 找不到时确认已在源项目中安装 UAPA |
| `uapa: uapa.config.ts: 默认导出缺失或不是对象` | 配置没有 `export default` | 以 `export default defineConfig({ … })` 导出 |
| `uapa: uapa.config.ts: <字段>: 缺少必填字段` | 缺 `name`、`version`、`description` 或 `targets` | 补上字段，见[构建配置](configuration.md#字段) |
| `uapa: uapa.config.ts: version: 不是 semver 版本号` | 如 `1.0` | 写成 `1.0.0` |
| `uapa: uapa.config.ts: targets[<n>]: 未知目标名 "<名称>"` | 目标名拼写错误，或该宿主不在 v0.2.0 中 | 取值见[目标与宿主差异](targets.md#目标一览) |
| `uapa: uapa.config.ts: <字段>: 未知字段` | 字段名拼写错误，或命令 hooks 写了 `matcher`、`timeout` | 删除或改正该字段 |
| `uapa: uapa.config.ts: hosts.<宿主>: targets 中没有该宿主的目标` | `hosts` 中的宿主没有配置任何目标 | 删除该宿主的选项，或在 `targets` 中加入它的目标 |
| `uapa: uapa.config.ts: <字段>: <宿主> 的插件目录 <目录> 写入前会被清空，不能等于或包含<…>` | 默认布局的插件目录覆盖了源项目根目录、`outDir` 或另一个插件目录 | 改用其他目录；要写入源项目根目录时让两个以上宿主共用它（合并布局） |

## 源项目（退出码 2）

| 错误信息 | 原因 | 处理 |
|---|---|---|
| `uapa: skills/<目录>: 缺少 SKILL.md` | skill 目录中没有 `SKILL.md` | 补上文件，或把该目录移出 `skills/` |
| `uapa: <文件>: 缺少以 --- 包围的 frontmatter` | `SKILL.md` 或 agent 文件开头没有 frontmatter | 在文件开头写 `---` 包围的 `name` 与 `description` |
| `uapa: skills/<目录>/SKILL.md: name: 与目录名 <目录> 不一致` | frontmatter 的 `name` 与目录名不同 | 改成相同；agent 的 `name` 与文件名相同 |
| `uapa: <文件>: targets[<n>]: 未知目标名 <名称>` | frontmatter 的 `targets` 写错 | 写已登记的目标名，如 `[agy:subprocess]` |
| `uapa: overrides/<目录>: 不是已配置的宿主（已配置：<…>）` | 覆盖目录名不是已配置目标的宿主 | 目录名改为 `claude-code`、`codex` 或 `agy`，或删除该目录 |
| `uapa: mcp/servers.json: mcpServers.<名称>: 服务器名只能含字母、数字、_、-` | 服务器名含其他字符 | 改名 |
| `uapa: mcp/servers.json: mcpServers.<名称>: 本地服务器（command、args、env）与远程服务器（url、headers）的字段混用` | 一个服务器同时写了两类字段 | 拆成两个服务器 |
| `uapa: <守卫文件>: 默认导出缺失或不是 GuardPlugin 对象` | 守卫文件没有默认导出对象 | `export default guard` |
| `uapa: <守卫文件>: requires[<n>]: 未知能力 <名称>` | `requires` 中的能力名写错 | 取值见[编写守卫](guards.md#能力缺失时的处理) |

## 目标失败（退出码 1）

一个目标失败不影响其他宿主；成功的目标照常写出。

| 错误信息 | 原因 | 处理 |
|---|---|---|
| `uapa: <目标>: 插件名 <名称> 不是 kebab-case：…` | Claude Code 与 Codex 要求 kebab-case | 改配置的 `name`，规则见[构建配置](configuration.md#字段) |
| `uapa: <目标>: 配置未写 author：…` | 含 Claude Code 目标时缺少 `author` | 写 `author: { name: '…' }` |
| `uapa: <目标>: 守卫的 requires 声明了 <能力>，本目标缺少该能力` | 守卫要求的能力该目标没有 | 接受该目标不构建，或从 `requires` 中去掉该能力并接受降级 |
| `uapa: <目标>: 合并布局冲突：<文件> 由 <宿主> 生成，内容不同；…` | 合并布局中两个宿主生成了同名而内容不同的文件 | 按错误中的提示处理，如为 Codex 设置 `hooksFile` |
| `uapa: claude-code:<形态>: 宿主校验失败：claude plugin validate --strict 以退出码 1 结束` | Claude Code 的校验未通过，后续行是校验的输出 | 按输出修改配置或覆盖文件；已写出的文件保留，便于检查 |
| `uapa: <目标>: 打包结果含不允许的外部导入：<模块>（…）` | 守卫导入了 Node 内置模块等 | 守卫中不导入 Node 与宿主 API，见[编写守卫「约束」](guards.md#约束) |

## 安装后守卫不生效

| 现象 | 原因 | 处理 |
|---|---|---|
| Codex 中守卫从不拦截，也不报错 | 插件的 hooks 未被信任 | 启动 TUI，在 “Hooks need review” 对话框中信任，见[安装与分发「Codex」](install.md#codex) |
| Claude Code 与 Codex 中守卫不生效，agy 中每次工具调用都被阻断 | 运行宿主的机器上没有 Node ≥ 22，入口无法启动 | 安装 Node ≥ 22；Claude Code 可另配置 `claude-code:in-process` |
| 只配置 `claude-code:in-process` 时 Claude Code 中守卫不生效 | Claude Code 低于 2.1.287，不加载 hooks 模块 | 升级 Claude Code，或同时配置 `claude-code:subprocess` |
| agy 中每次工具调用都被阻断，Node 正常 | `PreToolUse` 上的命令 hook 没有在 stdout 输出含 `decision` 的 JSON | 让该命令输出 `decision`，见[命令 hooks](command-hooks.md#各目标承载的事件) |
| agy 中提示不受检查 | agy 没有提示提交事件 | 构建报告已列为残余风险；必须拦截提示时不发布 agy 目标 |
| 修改守卫后宿主中的行为没有变化 | 宿主运行的是安装时复制的旧副本 | 重新构建并重新安装；Claude Code 用 `/reload-plugins`，Codex 改动 hooks 后再次信任 |

## 比对与持续集成

| 现象 | 原因 | 处理 |
|---|---|---|
| 刚构建完 `--check` 就报 `modified` | 格式化工具或换行设置改写了产物 | 把插件目录与 `uapa-report.json` 排除在格式化与换行转换之外 |
| `--check` 报 `removed <文件>` | 默认布局的插件目录中有不是本次生成的文件 | 删除该文件；要放自定义文件时用 `overrides/<宿主>/` |
| 合并布局中删除的组件仍在插件目录中 | 合并布局不删除目录中的其他文件 | 手动删除旧文件 |
