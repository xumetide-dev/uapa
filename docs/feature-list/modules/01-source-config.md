# 01 源项目与配置

读取插件作者的源项目：构建配置 `uapa.config.ts`、各类组件与覆盖目录 `overrides/<宿主>/`。
代码位于 `src/config/`（配置类型、加载与校验，目标名与宿主标识）与 `src/source/`（组件与覆盖
目录）。本模块只读源项目，不写文件，不包含任何宿主的格式知识；skills 与覆盖文件放置到产物由
[构建编排](03-build.md) 完成。配置字段与源项目模型见
[模块接口 §1～§3](../../architecture/module-interfaces.md)。本模块的失败以 `InputIssue` 列表
返回（模块接口 §8），命令行以退出码 2 结束，不构建任何目标。

| 编号 | 阶段 | 子模块 | 功能名称 | 验收标准 | 依赖 |
|---|---|---|---|---|---|
| F-01-01 | v0.1.0 | 构建配置 | 定义构建配置类型与 `defineConfig` | `UapaConfig` 与 `defineConfig` 按模块接口 §2 定义；目标名与宿主标识列表定义在 `src/config/targets.ts`，配置类型由它推导；类型不符时 `tsc` 报错；包入口导出 `defineConfig` 与 `UapaConfig` | — |
| F-01-02 | v0.1.0 | 构建配置 | 加载 `uapa.config.ts` | 以 Node 类型剥离导入；`loadConfig` 按模块接口 §8 返回结果；使用不可擦除语法或相对导入缺 `.ts` 扩展名时返回 `InputIssue`，含文件与原因 | F-01-01 |
| F-01-03 | v0.1.0 | 构建配置 | 校验构建配置 | 未知目标名、重复目标、缺必填字段、未知字段、`hosts` 中出现未配置目标的宿主、`hosts.codex.hooksFile` 为绝对路径或含 `..`，或插件目录违反模块接口 §2 的路径规则（经 `src/config/layout.ts` 的 `resolvePluginDirs` 检查）时失败；错误给出字段路径 | F-01-02 |
| F-01-04 | v0.1.0 | 组件读取 | 读取 skills | `skills/` 不存在时 skills 为空列表；`skills/` 下不是目录的项忽略；每个子目录必须含 `SKILL.md`；frontmatter 须能由 yaml 解析，`name`、`description` 为非空字符串；目录名与 `name` 不一致时失败；`Skill.files` 递归列出该目录下的全部文件，按字典序 | F-01-03 |
| F-01-05 | v0.1.0 | 组件读取 | 读取组件的目标限定 | 组件 frontmatter 的 `targets` 记入组件模型；含未知目标名或为空数组时失败；是否适用于某目标由 F-03-02 判定 | F-01-04 |
| F-01-06 | v0.1.0 | 目标覆盖 | 读取覆盖目录 | 列出 `overrides/<宿主>/` 下的文件；目录名不是 `targets` 中已配置的宿主时失败；本模块不复制文件 | F-01-03 |
| F-01-09 | v0.1.0 | 构建配置 | 校验命令 hooks 声明 | `UapaConfig.commandHooks` 与 `CommandHookDecl` 按[命令 hooks 声明](../../architecture/command-hooks.md)第 1 节定义，由包入口导出；`event` 不是第 1 节的六个事件之一、`command` 为空或含换行、`targets` 为空数组、含重复或未配置的目标，或出现 `matcher`、`timeout` 等未知字段时返回 `InputIssue`（v0.4.0 起由 F-01-15 支持单条 `timeout`），字段路径如 `commandHooks[1].event` | F-01-03 |
| F-01-07 | v0.2.0 | 组件读取 | 读取 agents | 读取 `agents/` 下一层的 `.md` 文件与 frontmatter，校验 `name`（与文件名去掉 `.md` 相同）与 `description`；支持 `targets` 筛选（SD-30） | F-01-05 |
| F-01-08 | v0.2.0 | 组件读取 | 读取 MCP 服务器 | 读取 `mcp/servers.json` 的 `mcpServers`：服务器名只含字母、数字、`_`、`-`；本地服务器只含 `command`、`args`、`env`，远程服务器只含 `url`、`headers`，插件根写作 `{pluginRoot}`，只用于本地服务器；其他字段、类型不符或两类字段混用时失败（SD-30） | F-01-03 |
| F-01-10 | v0.3.0 | 组件读取 | 读取 rules | 读取 `rules/` 下一层的 `<name>.md`，其他项忽略；`<name>` 只含字母、数字、`_`、`-`；frontmatter 必须存在且只含 `activation`、`description`、`globs`、`targets`：`activation` 为 `always`、`model` 或 `glob`；`description` 出现时为非空单行字符串，`activation` 为 `model` 时必填；`activation` 为 `glob` 时 `globs` 为非空字符串数组，元素非空、不含 `,` 与换行，其他取值时不得出现 `globs`；`targets` 的规则同 F-01-05；`Rule.body` 为 frontmatter 之后的原文；违反时返回 `InputIssue`，`field` 写到 frontmatter 字段，如 `activation`（模块接口 §3，SD-32） | F-01-05 |
| F-01-11 | v0.3.0 | 组件读取 | 读取 commands | 读取 `commands/` 下一层的 `<name>.md`，其他项忽略；`<name>` 只含字母、数字、`_`、`-`；frontmatter 的 `description` 为非空字符串，`targets` 的规则同 F-01-05，其他键不校验、原样保留；缺少 frontmatter 或 `description` 时返回 `InputIssue`（模块接口 §3，SD-33） | F-01-05 |
| F-01-12 | v0.4.0 | 组件读取 | 读取共用文件 | 递归列出 `files/` 下的文件，路径相对 `files/`、POSIX 分隔、按字典序；没有 `files/` 时为空；本模块不复制文件（SD-37） | F-01-03 |
| F-01-13 | v0.4.0 | 组件读取 | 读取 MCP 服务器的环境变量声明 | 本地服务器可写 `envVars`：非空的字符串数组，元素匹配 `^[A-Za-z_][A-Za-z0-9_]*$` 且不重复；远程服务器写 `envVars`、元素不合规则或重复时失败，`field` 写到元素，如 `mcpServers.docs.envVars[1]`（SD-40） | F-01-08 |
| F-01-14 | v0.4.0 | 构建配置 | 校验 v0.4.0 的配置字段 | `hosts['claude-code']` 可写 `manifest`（对象，不得含 SD-42 列出的键）与 `onFailure`（只取 `'block'`）；顶层可写 `marketplace`：`name` 为 kebab-case，`owner.name` 为非空字符串，`owner.email` 可省略，`dir` 相对配置文件所在目录、默认 `outDir`，不得等于或位于默认布局的插件目录内；`targets` 中没有 Claude Code 或 Codex 的目标时不得配置 `marketplace`；这两个宿主的插件目录须等于或位于 `marketplace.dir` 之内；违反时配置校验失败，`field` 写到键，如 `hosts.claude-code.manifest.name`（SD-41～SD-43） | F-01-03 |
| F-01-15 | v0.4.0 | 构建配置与组件读取 | 命令超时、agy 清单位置与 MCP 服务器目标限定 | `CommandHookDecl` 可写可选的 `timeout`（正整数，单位秒；小于等于 0、非整数或非数字时返回 `InputIssue`，`field` 如 `commandHooks[0].timeout`），代替 F-01-09 中拒绝 `timeout` 字段的规则；`hosts.agy` 可写可选的 `manifest`（只取 `'plugin.json'` 或 `'.antigravity-plugin/plugin.json'`，其他值返回 `InputIssue`，`field` 为 `hosts.agy.manifest`）；`mcp/servers.json` 的本地与远程服务器可写可选的 `targets`（规则同 F-01-05，非空、不重复、只含已登记的目标名，违反时返回 `InputIssue`，`field` 如 `mcpServers.docs.targets[0]`）（SD-47～SD-49） | F-01-09, F-01-13, F-01-14 |

