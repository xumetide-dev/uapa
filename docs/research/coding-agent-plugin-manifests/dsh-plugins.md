# DeepSeek Harness（DSH）插件：开发方式与 manifest

本文说明 DeepSeek Harness（`dsh`）的插件形态、bundle 与 profile 两类 manifest、配置分层、
安装命令、工具与停机扩展点，以及 skills / MCP 的接入方式。事实核对日期为 2026-10-13，
依据仓库 `deepseek-ai/deepseek-harness`（默认分支 `master`，MIT 许可）的文档与源码；
源码位置以 master 提交 `d743267388`（2026-10-09，版本 0.2.1-alpha.2）为准，路径相对仓库根目录。
DSH 处于开发者预览阶段，README 声明会出现不兼容变更。
Cordis 插件的编写方法见 [DSH Cordis 插件开发指南](dsh-cordis-plugin-guide.md)。

> **阶段标记**：仅调研（SD-01）。UAPA 当前版本（v0.4.0）未将 DSH 列为正式构建目标，本文仅为宿主
> 生态调研与跨平台对比参考，不代表当前版本已提供该目标产物。

## 概述

- DSH 基于 Cordis 内核（`@deepseek-ai/cordis` 4.0.5-alpha.1，位于 `vendor/cordis`），
  模型适配、工具、会话等能力都以 Cordis 插件的形式组合 [D1]。
- 命令行程序是 npm 包 `@deepseek-ai/dsh`（`apps/cli`）；仓库根包 `@deepseek-ai/dsh-root`
  为 private [D5]。
- 插件是导出 `apply` 函数的 JS/TS 模块；官方教程中的最小插件只导出 `name` 与 `apply()` [D2]。
- 分发单位是 **bundle**：在 `package.json` 中声明 `dsh.bundle` 的 npm 包，携带一层
  `cordis.patch.yml` 配置 [D2]。
- 运行单位是 **profile**：`$DSH_HOME/profiles/<name>` 下的目录，按顺序列出要组合的 bundle [D2]。
- DSH 没有 `plugin.json` 形式的 manifest；manifest 是 npm `package.json`
  中的 `dsh` 键。

## bundle manifest

最小 bundle 由三部分组成 [D2]：

```text
hello-plugin/
├── package.json       # 声明 dsh.bundle
├── cordis.patch.yml   # profile 启用该 bundle 时应用的配置层
└── index.js           # patch 行引用的插件模块
```

`package.json` 中与 DSH 相关的字段（类型声明见包 `@deepseek-ai/dsh-package-manifest`，
位于 `packages/util/package-manifest/src/types.ts`）[D5]：

| 字段 | 类型 | 含义 |
|---|---|---|
| `name`、`version`、`main` / `exports` | npm 标准字段 | 包标识与入口；patch 行按包名引用 |
| `icon` | string | SVG / PNG / JPEG / WebP，相对路径，不超过 256 KiB |
| `engines.dsh` | string | 兼容的 DSH 版本范围；目前只是声明，没有读取方强制检查 |
| `dsh.manifestVersion` | `1` | manifest 格式版本；目前不强制检查 |
| `dsh.bundle.patch` | string \| string[] | patch 文件路径；数组时按顺序作为同一层应用 |
| `dsh.profile.bundles` | string[] | profile 的 bundle 层顺序 |
| `dsh.client.platform` | string | 前端模块平台；Web 端取 `web` |
| `dsh.client.inject` | string[] | 信息性的包名依赖，不是 Cordis 服务注入 |
| `dsh.client.immediately` | boolean | 启动第一阶段的注册屏障 |
| `dsh.client.external` | string[] | 隐式基线之外的模块表请求 |

- `@deepseek-ai/dsh-package-manifest` 只提供类型（README 原文 "Static typing only"），
  校验由各读取方自行完成 [D5]。
- 显示用的本地化文本从 `<specifier>/locale/*.json` 读取，必须提供 `en.json` [D5]。
- 未声明 `dsh.bundle` 的包仍可安装，但只作为普通依赖，`dsh plugin` 会给出警告且不激活
  任何配置层 [D2]。

### 依赖与兼容性检查

- 须与宿主共享实例的 dsh 包同时写在 `peerDependencies` 与 `devDependencies`；无状态的
  dsh 工具包放 `dependencies` [D2]。
- 实际生效的兼容检查只有一项：对每个名为 `@deepseek-ai/dsh` 或 `dsh-*` 的 peer，用 semver
  检查运行中的 DSH 版本（含预发布版本）；不满足时只给警告，可按精确版本豁免。
  `@deepseek-ai/cordis` 的 peer 不检查（`packages/boot/app-boot/src/plugin-compatibility.ts`）[D5]。

### cordis.patch.yml

- patch 文件必须是顶层 YAML 数组，否则报错 [D5]。
- `insert` 行把插件加入组合，`id` 为行标识，`name` 为包名或包内导出路径；可带 `id`
  插入到分组内 [D2][D5]。
- 后续层按 `id` 覆盖同一行的顶层键，`config` 整体替换，不做深合并
  （`vendor/include/src/index.ts:122` 的 `target[key] = value`）[D5]。
- 支持 `disabled: true` 与 `!!js` 表达式；没有 `remove` 关键字，未知键按普通字段覆盖 [D5]。

```yaml
- insert:
    - id: hello
      name: dsh-hello-plugin
```

## profile manifest

profile 目录含 `package.json`（pnpm 管理的依赖与 `dsh.profile.bundles` 有序列表）和用户自己的
`cordis.patch.yml`。profile 由 `dsh plugin` 或 `--from-default-profile` 生成与维护，
不需要手写 [D2]。

```json
{
  "name": "dsh-profile-demo",
  "private": true,
  "dependencies": { "dsh-hello-plugin": "link:/path/to/hello-plugin" },
  "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "dsh-hello-plugin"] } }
}
```

## 配置分层

生效配置从空根开始，按以下顺序叠加，后层按行覆盖前层
（`apps/cli/src/profile-boot.ts` 的 `composeProfile`）[D2][D5]：

1. `dsh.profile.bundles` 中各 bundle 的 patch，按列表顺序（`@deepseek-ai/dsh-base` 在最前）
2. profile 自己的 `cordis.patch.yml`
3. `$DSH_HOME/cordis.patch.yml`（本机所有 profile 共享）
4. 命令行 `--patch <path>`，按参数顺序
5. 遥测开关层

## 安装与调试命令

`dsh plugin --profile <name> <args...>` 在 profile 目录中把参数原样转交给 pnpm [D2]：

```bash
dsh plugin --profile demo add ./hello-plugin
```

```bash
dsh --profile demo --dump-config
```

```bash
dsh plugin --profile demo remove dsh-hello-plugin
```

- 首次使用会初始化 profile，并以 `@deepseek-ai/dsh-base` 作为第一个 bundle [D2]。
- `--dump-config` 不启动服务，只输出组合后的配置；另有 `--dump-default-config` 与
  `--dump-config-schema` [D2][D5]。
- 开发阶段也可不打包，直接用 `--patch` 指向本地 patch 文件加载插件 [D2]。
- 早期的 repository plugin（`.dsh-plugin`）形态已移除：移除提交日期为 2026-08-09，
  2026-08-10 合入（`.agents/notes/archived/simplification/2026-08-09-remove-repository-plugin.md`）[D5]。

## 工具与停机扩展点

DSH 插件在宿主进程内注册 Cordis 事件监听器。工具调用与回合结束相关的扩展点 [D5][D6]：

| 扩展点 | 调用方式 | 可做的决定 |
|---|---|---|
| `tools/pre-execute` | waterfall | `allow`、`deny { reason }`、`cancel`、`ask` |
| `tools/execute` | waterfall | 包裹分发（超时、重试、指标）；只能替换 `exec.signal` |
| `tools/post-execute` | waterfall | `accept { content \| value, additionalContexts }`、`block { feedback }` |
| `tools/result` | 观察 | 只读观察最终结果 |
| `agent/turn-stopping` | serial | 调用 `agent.steer(message)` 让回合继续 |

### 扩展能力摘要

| 能力 | 支持情况 | 依据 |
|---|---|---|
| 执行前阻断 | 支持：`tools/pre-execute` 返回 `deny`；需要单调的最终拒绝时用 `ctx.tools.guard()` | [D5][D6] |
| 执行前改写工具入参 | 不支持：入参在策略前已记录并深度冻结，`PreToolDecision` 不含改写 | [D5] |
| 执行后替换工具输出 | 支持：`tools/post-execute` 返回 `accept` 并给出新的 `content` 或 `value` | [D5] |
| 停机门禁 | 支持：`agent/turn-stopping` 监听器调用 `agent.steer(...)` 再运行一步 | [D5][D6] |
| 失败时的默认行为 | 拒绝：`tools/pre-execute` 监听器抛错时不执行工具，`tools/post-execute` 监听器抛错时以错误结果替换原输出 | [D5] |
| 进程内扩展 | 支持：插件即 Cordis 插件 | [D1] |

源码位置：决策类型见 `packages/core/tools/src/index.ts:608-621`，事件声明见同文件
`:144-177`，`agent/turn-stopping` 见 `packages/core/agent/src/runtime-types.ts:364-381`。

## 其他平台 hooks 的兼容包（实验）

| 包 | 作用 | 限制 |
|---|---|---|
| `@deepseek-ai/dsh-hooks-claude-code` | 运行 Claude Code `hooks.json` 或 settings 中的命令 hooks | `PreToolUse` 只支持 `deny` 与 `ask`，`updatedInput` 记录并警告但不应用；`Stop` 阻断经 `steer()` 再运行一步 |
| `@deepseek-ai/dsh-hooks-codex` | 运行 Codex hooks 配置 | 未逐项核对 |
| `@deepseek-ai/dsh-experimental-claude-code-mods` | 运行 Claude Code hooks 模块（mods） | 拒绝改写工具入参；支持 `{ deny }` 与 `{ result }`；细节见 [开发指南](dsh-cordis-plugin-guide.md#claude-code-mods-兼容层) |

三者位于 `packages/experimental/` [D5][D6]。

## Skills

本地 skill 提供者按 rank 扫描以下根目录，数字越小优先级越高 [D3][D5]：

| rank | 来源 | 位置 |
|---|---|---|
| 100 | `project-dsh` | `<projectRoot>/.dsh/skills` |
| 200 | `project-agents` | `<projectRoot>/.agents/skills` |
| 250 | 运行时注册 | 插件在运行时注册的 skill |
| 300 | `custom` | `customSkillDirs`（skill-filesystem 插件配置项） |
| 400 | `user-dsh` | `<dshHome>/skills`（跳过 `.system`） |
| 500 | `user-agents` | `<agentsHome>/skills` |
| 600 | `bundled` | `bundledSkillDir` |

- skill 另按作用域分层，最近的一层直接胜出；rank 只决定同一层内的重名 [D5]。
- skill 名须为 kebab-case；接受 `<name>/SKILL.md` 目录与 `<name>.md` 单文件，不递归查找 [D3]。
- frontmatter 中 `disable-model-invocation` 与 `user-invocable` 控制调用方式，缺省为可调用；
  旧的驼峰写法会被拒绝 [D3][D5]。

## MCP

MCP 服务器不通过独立的 `mcp.json` 配置，而是在 Cordis 配置中为每个服务器写一行
`@deepseek-ai/dsh-mcp-client` 插件条目；默认不启用任何服务器。字段见仓库
`packages/mcp/mcp-client/README.md` [D4][D5]。

## 社区目录

`dshpluginhub.ai`、`dshfind.com` 等插件目录及 awesome 列表均为社区项目【社区】，其“Verified”
标识不代表官方审计。官方来源只有 `deepseek-ai/deepseek-harness` 仓库与其文档站。

## 来源

- [D1] 仓库 README：<https://github.com/deepseek-ai/deepseek-harness>
- [D2] Package and install a plugin：
  <https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md>
- [D3] Skills 子系统：
  <https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/skills.md>
- [D4] MCP 子系统：
  <https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/mcp.md>
- [D5] 源码：`deepseek-ai/deepseek-harness` master 提交 `d743267388`，文中路径相对仓库根目录。
  提交信息中的 PR 编号属于上游内部编号，与公开仓库的 PR / Discussion 编号不对应。
- [D6] Extension cookbook：
  <https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/extension-cookbook.md>
- 文档站（单页应用，正文未能直接抓取）：<https://deepseek-harness.github.io/deepseek-harness/>
