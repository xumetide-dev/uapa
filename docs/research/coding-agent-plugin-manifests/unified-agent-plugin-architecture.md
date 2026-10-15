# 统一代理插件架构（UAPA）设计提案

**状态：设计提案。** 模块划分、冻结项与 v0.1.0 范围以 [架构](../../architecture/architecture.md)、
[模块接口](../../architecture/module-interfaces.md) 与 [功能清单](../../feature-list/README.md) 为准，
本文与它们不一致处以它们为准。仓库中还没有实现代码，文中代码与配置均为示意写法。

本文说明 UAPA（Unified Agent Plugin Architecture）的定位、源项目结构、构建流程与产物：
从一份插件源项目，构建出 Claude Code、Codex、Antigravity CLI（agy）、GitHub Copilot CLI、Cursor、
Kimi Code、Kiro、CodeBuddy、OpenCode、DSH 各自可安装的插件包。守卫逻辑的公共类型、各宿主 hooks 的适配、
Claude Code 双形态去重与失败处理见 [UAPA hooks 适配](uapa-hook-adapters.md)。

各宿主的 manifest 与 hooks 事实以各平台文档为准，横向结论见
[跨平台对比](cross-platform-comparison.md)；本文只引用结论。核对日期为 2026-10-13。

## 1. 定位

UAPA 是多目标构建工具：输入一份插件源项目，为每个目标宿主输出一个可安装的插件目录，
并输出构建报告。

UAPA 负责：

- 从源项目生成各宿主的 manifest、组件文件与 hooks 配置。
- 把守卫逻辑打包为各宿主的 hook 入口：子进程脚本，或进程内模块。
- 构建时按目标能力数据检查组件与守卫能力：守卫在 `requires` 中声明的能力目标不具备时报错，
  其余按 [hooks 适配第 6 节](uapa-hook-adapters.md#6-能力缺失时的处理) 记为降级或残余风险，
  并写入报告。
- 输出构建报告，列出每个目标的产物、跳过项、降级项与残余风险。

UAPA 不负责：

- **定义插件标准。** UAPA 不定义供宿主读取的 manifest 格式。产物只使用各宿主文档规定的
  格式；源项目的配置文件只由 UAPA 读取，不进入产物。
- **运行时兼容。** 产物在宿主中直接运行，不附带 UAPA 运行时；宿主缺少的能力不在运行时
  模拟。
- **只取共同子集。** 宿主专有组件（Claude Code 的 output styles、Cursor 的 `.mdc` 规则、
  Kimi Code 的 `systemPrompt`）通过覆盖目录 `overrides/<宿主>/` 保留在对应宿主的插件目录中。
- **分发。** 各宿主的 marketplace 与安装命令见平台文档。

## 2. 与 uni-app 的对照

uni-app 用一份 Vue 源码编译出 H5、各家小程序与 App。UAPA 采用“一份源码、多目标产物”的
组织方式，但两者处理的对象不同。

### 对应关系

| uni-app | UAPA |
|---|---|
| 一份 Vue 源码 | 一份插件源项目：skills、MCP、rules、agents、commands 与守卫逻辑 |
| 平台标识，如 `mp-weixin`、`h5`、`app-plus` | 目标名，如 `claude-code:subprocess`、`kiro:workspace-hook`（第 5 节） |
| `manifest.json` 中按平台分节 | `uapa.config.ts` 中按宿主写选项（`hosts`），由宿主模块生成宿主 manifest |
| 条件编译 `#ifdef`；`platforms/<平台>/` 目录 | 源文件 frontmatter 的 `targets` 字段；`overrides/<宿主>/` 覆盖目录 |
| `uni.*` 统一 API，运行时适配各端 | 守卫逻辑的公共类型，构建时为各宿主生成入口 |
| `dist/build/<平台>/` | `dist/<宿主>/` |

### 领域差异

| 方面 | uni-app | UAPA | 对设计的影响 |
|---|---|---|---|
| 产物内容 | 以程序代码与界面为主 | 以配置文件与 Markdown 为主，hooks 程序很小 | 多数构建步骤是文件放置、字段换算与格式转换；只有守卫逻辑需要打包代码 |
| 运行时 | 每个平台随包带框架运行时，统一 API 在运行时适配 | 没有共同运行时：命令 hooks 每个事件启动一个进程；Claude Code hooks 模块运行在没有 Node 的独立环境；OpenCode 插件在 Bun 进程内；DSH 插件在 Node 进程内 | 公共逻辑只能是不做 I/O 的纯函数；入口由各目标生成 |
| 差异的性质 | 主要是 API、组件与样式的可用性 | 主要是安全控制语义：能否阻断、改写入参、替换输出、停机前检查，失败时放行还是拒绝 | 能力缺失不能静默降级：`requires` 中的能力缺失时构建报错，其余缺失记为降级或残余风险，并写入报告 |
| 平台变化 | 平台规范相对稳定 | 宿主频繁发版，hooks 字段与默认行为随版本变化 | 目标能力数据带宿主版本、核对日期与出处，与构建器代码分开维护（第 8 节） |
| 安装单位 | 一个平台一个包 | 部分目标需要多个安装单位：Kiro 的 Power 不能携带 hooks，hooks 另装到工作区；OpenCode 插件不承载 skills、MCP | 一个目标可输出多个安装单位，构建报告写明各自的安装位置 |
| 产物校验 | 平台开发者工具 | 少数宿主提供校验命令（`claude plugin validate`），各宿主校验命令的检查范围不一 | 有可靠的宿主校验命令时调用，否则用宿主模块内置的字段白名单检查 |

### 不照搬的做法

- **静默降级。** uni-app 的平台标识写错时，`#ifdef` 分支不生效且不报错 [W1]；Taro H5 生产
  构建遇到不支持的 API 只告警并仍调用成功回调 [W3]。UAPA 对未知目标名与不满足的能力在
  构建时报错。
- **注释式条件编译。** 在 JSON 与 Markdown 中写 `#ifdef`，要求每个分支下的文件都合法 [W1]；
  Markdown 中未剔除干净的内容会被模型读到。UAPA 按文件与 frontmatter 选择目标。
- **以某个平台的规范为统一层。** Taro 的 API 与 `app.config` 以微信小程序为准 [W2]。UAPA 的
  源项目格式与公共类型不沿用任何一个宿主的格式，宿主差异全部放在宿主模块中。
- **共用输出目录时互相覆盖。** Taro 默认输出到同一个 `dist`，多端构建互相覆盖 [W2]。UAPA 默认
  每个宿主一个输出目录，同一宿主的多个目标写入同一目录；选用合并布局时，同名文件冲突即构建
  失败（第 9 节）。

### 借用的做法

- **由配置合成 manifest。** WXT 的源码中没有 `manifest.json`，由配置、入口选项与模块合成，
  并按目标浏览器自动换算字段 [W4]。UAPA 的产物 manifest 全部由宿主模块生成。
- **能力表。** unplugin 用兼容性表声明各构建工具支持的钩子，并说明公共钩子只覆盖共同
  子集 [W5]。UAPA 用目标能力数据声明每个目标可承载的组件与 hooks 能力（第 8 节）。
- **按目标分输出目录。** WXT 按 `{{browser}}-mv{{manifestVersion}}` 命名输出目录 [W4]。

## 3. 设计原则

1. **源项目只写一份，产物格式只来自宿主文档。** 宿主差异全部由宿主模块承担。
2. **能力在构建时检查。** 插件在 `requires` 中声明所需能力；目标缺少其中任一能力时，该目标
   构建失败；未声明的能力缺失按 hooks 适配第 6 节处理并写入构建报告。不在运行时按环境变量
   推断宿主：Codex、Copilot CLI 与 CodeBuddy 为 hook
   进程提供 `CLAUDE_PLUGIN_ROOT` 等兼容变量，据此推断会把它们认成 Claude Code。
3. **执行前检查失败时拒绝。** 守卫逻辑抛错时，执行前与提示提交前检查按拒绝处理，停机前检查
   不阻止结束，执行后检查按扣留处理，见
   [入口与打包接口](../../architecture/runtime-interfaces.md#3-子进程入口)。
4. **只依赖已核实的宿主行为。** 目标能力数据注明宿主版本、核对日期与出处；未核实的行为不写
   进适配器。
5. **不跨宿主、不跨会话共享可变状态。** 会话内状态以会话 id 为键，存放在宿主提供的位置。

## 4. 源项目

```text
my-plugin/
├── uapa.config.ts           # 名称、版本、目标列表与各宿主选项
├── skills/<name>/SKILL.md   # Agent Skills
├── mcp/servers.json         # MCP 服务器（v0.2.0），规范形式见下文
├── rules/*.md               # 规则与指令（未排期，SD-02）
├── agents/*.md              # 子代理定义（v0.2.0）
├── commands/*.md            # 斜杠命令（未排期，SD-02）
├── src/guard.ts             # 守卫逻辑（可选），默认导出 GuardPlugin
└── overrides/<宿主>/        # 宿主专有文件，复制到该宿主的插件目录并覆盖同名文件
```

```ts
// uapa.config.ts（示意写法）
import { defineConfig } from 'uapa'

export default defineConfig({
  name: 'command-guard',
  version: '0.1.0',
  description: '拒绝破坏性命令',
  author: { name: 'Example Team' },
  guard: './src/guard.ts',
  targets: ['claude-code:in-process', 'claude-code:subprocess', 'codex:subprocess',
    'agy:subprocess'],
})
```

- v0.1.0 只读取 `uapa.config.ts`、`skills/`、守卫逻辑与 `overrides/<宿主>/`（功能模块 01、02）。
- 配置字段以 [模块接口 §2](../../architecture/module-interfaces.md) 为准。
- 源文件 frontmatter 可写 `targets: [...]` 限定适用目标；未写时适用于所有能承载该组件的目标。
- `mcp/servers.json` 只用各宿主都能表达的字段：本地服务器为 `command`、`args`、`env`，远程
  服务器为 `url`、`headers`。路径中的插件根目录写作 `{pluginRoot}`，由宿主模块换成宿主变量，
  如 Claude Code 的 `${CLAUDE_PLUGIN_ROOT}`、Cursor 的 `${CURSOR_PLUGIN_ROOT}`、Copilot 的
  `${PLUGIN_ROOT}`。目标没有对应变量时该服务器构建失败，需在 `overrides/<宿主>/` 中提供替代配置。
- 守卫逻辑的写法与约束见 [UAPA hooks 适配](uapa-hook-adapters.md#1-守卫逻辑的约束)。

## 5. 构建目标

| 目标 | 宿主形态 | 产物入口 | 依据 |
|---|---|---|---|
| `claude-code:in-process` | hooks 模块（mod） | `hooks/hooks.json` 的 `"modules"` → `hooks/register.ts` | [Claude Code](claude-code-plugins.md)、[Mods 指南](claude-code-mods-guide.md) |
| `claude-code:subprocess` | 命令 hooks | `hooks/hooks.json` 的 `"hooks"` → 子进程入口 | [Claude Code](claude-code-plugins.md) |
| `codex:subprocess` | 命令 hooks | 插件 `hooks/hooks.json`；只对桌面端手动安装的插件生效 | [Codex](codex-plugins.md) |
| `agy:subprocess` | 命令 hooks | 根 `hooks.json` → `hooks/uapa-agy.mjs` | [agy](agy-plugins.md) |
| `copilot-cli:subprocess` | 命令 hooks | `com.github.copilot/hooks/hooks.json`（Copilot CLI 读取的位置待 TA-15） | [GitHub Copilot](github-copilot-plugins.md) |
| `cursor:subprocess` | 命令 hooks | `.cursor-plugin/plugin.json` 与 `hooks/hooks.json` | [Cursor](cursor-plugins.md) |
| `kimi:subprocess` | 命令 hooks | `kimi.plugin.json` 的 `hooks` 字段 | [Kimi Code](kimi-code-plugins.md) |
| `kiro:workspace-hook` | 命令 hooks | Power 之外单独安装到工作区的 `.kiro/hooks/*.json` | [Kiro](kiro-powers.md) |
| `codebuddy:subprocess` | 命令 hooks | `.codebuddy-plugin/plugin.json` 与 `hooks/hooks.json`，只写 `"hooks"` 键 | [CodeBuddy](workbuddy-codebuddy-plugins.md) |
| `opencode:in-process` | 进程内插件 | `.opencode/plugins/` 或 npm 包导出的插件函数 | [OpenCode](opencode-plugins.md) |
| `dsh:cordis` | Cordis 插件 | bundle 包（`dsh.bundle` + `cordis.patch.yml`） | [DSH](dsh-plugins.md)、[DSH 指南](dsh-cordis-plugin-guide.md) |

- 同一宿主的两个目标可同时构建；Claude Code 的两个目标输出到同一个插件包，见
  [双形态去重](uapa-hook-adapters.md#5-claude-code-双形态去重)。
- CodeBuddy 的 Mods（Beta）以 `hooks.json` 的 `modules` 键启用，文档称可原样加载 Claude Code
  的 mod 目录，但未逐项对照 API，未实测，暂不设 `codebuddy:in-process` 目标。
- VS Code 中的 Copilot 只支持 8 个 PascalCase 事件，暂不作为单独目标。

## 6. 组件与目标

| 组件 | Claude Code | Codex | Copilot CLI | Cursor | Kimi Code | Kiro | CodeBuddy | OpenCode | DSH |
|---|---|---|---|---|---|---|---|---|---|
| skills | 包内 | 包内 | 包内 | 包内 | 包内 | Power 内 | 包内 | 配置目录 | 插件运行时注册 |
| MCP | 包内 | 包内 | 包内 | 包内 | manifest 字段 | Power 内 | 包内 | `opencode.json` | Cordis 配置 |
| rules | 无 | 无 | 包内 | 包内（`.mdc`） | `systemPrompt` | 工作区 steering | 无 | 配置目录 | 无 |
| agents | 包内 | 无 | 包内 | 包内 | 包内 | 无 | 包内 | 配置目录 | 无 |
| commands | 包内 | 无 | 包内 | 包内 | 包内 | 无 | 包内 | 配置目录 | 无 |
| 命令 hooks | 包内 | 包内 | 包内 | 包内 | manifest 字段 | 工作区 | 包内 | 无 | 兼容包（实验） |
| 进程内 hooks | `modules` | 无 | 无 | 无 | 无 | 无 | Mods（Beta） | 插件模块 | Cordis 插件 |

- “包内”指插件包可携带该组件；“配置目录”指只能放到项目或用户的配置目录，不经插件分发，
  如 OpenCode 的 `.opencode/skills/`；“工作区”指 Power 之外单独安装到工作区的文件。“无”
  包括平台文档未见对应组件的情况。
- 目标不能承载的组件不产出，在构建报告中列为跳过；源文件 frontmatter 显式写了该目标时，
  构建失败。
- 格式换算由宿主模块完成：rules 换成 Cursor 的 `.mdc`（`description`、`globs`、`alwaysApply`）、
  Kiro steering 的 `inclusion`、Kimi Code 的 `systemPrompt` 片段（单插件上限 32 KB）。

## 7. 构建流程

调用顺序以 [架构 §1](../../architecture/architecture.md#1-组成与模块) 为准，写出、失败范围与
退出码以 [模块接口 §8](../../architecture/module-interfaces.md) 为准。下面是后续目标
`kiro:workspace-hook` 的报告条目示例，说明一个目标输出两个安装单位时报告怎样写：

```json
{
  "target": "kiro:workspace-hook",
  "status": "ok",
  "host": { "name": "kiro", "checked": "2026-10-13", "source": "kiro-powers.md" },
  "units": [
    { "kind": "power", "path": "dist/kiro/power" },
    { "kind": "workspace", "path": "dist/kiro/workspace/.kiro", "install": "复制到工作区根目录" }
  ],
  "skipped": [{ "component": "agents/reviewer.md", "reason": "Kiro 不承载 agents" }],
  "degraded": [{ "decision": "rewrite", "as": "deny", "reason": "目标不能改写工具入参" }],
  "residualRisks": ["IDE 的 PreToolUse 命令 hook 收不到 tool_name（#7375、#7500）"]
}
```

示例为一个目标的条目，v0.1.0 的报告字段以 [模块接口 §7](../../architecture/module-interfaces.md) 为准；
`units[].install` 随需要多个安装单位的后续目标增加。

## 8. 目标能力数据

每个目标一个 TypeScript 数据模块，类型为 `TargetCapabilities`，与构建器代码分开维护；宿主升级后
只改数据模块，字段缺失由类型检查发现（[ARCH-001](../../architecture/ARCH-001-agent-plugin-build-tool.md)）。

```ts
// src/capabilities/codex-subprocess.ts（示意写法）
import type { TargetCapabilities } from './types.ts'

export const codexSubprocess: TargetCapabilities = {
  target: 'codex:subprocess',
  host: { name: 'codex', version: '0.162.1', checked: '2026-10-13', source: 'codex-plugins.md' },
  components: { skills: 'package', mcp: 'package', hooks: 'package', agents: 'none' },
  capabilities: {
    rewriteInput: true, replaceOutput: false, withholdOutput: true, stopGate: true,
    promptGate: false, // 待实测
  },
  failureDefault: {
    beforeTool: { error: 'allow', timeout: 'allow' },
    beforePrompt: { error: 'allow', timeout: 'allow' },
    beforeStop: { error: 'allow', timeout: 'allow' },
  },
  hookTimeoutSeconds: null, // 超时字段名未核实，不写出
  defaultTimeoutSeconds: 600,
  toolNames: { Bash: 'shell', apply_patch: 'edit_file', spawn_agent: 'subagent' },
}
```

- 字段定义见 [模块接口 §4](../../architecture/module-interfaces.md)：`toolNames` 以宿主工具名为
  键。`capabilities` 与 `failureDefault` 的取值见 [UAPA hooks 适配](uapa-hook-adapters.md)
  第 4、6、7 节；`toolNames` 见同文第 3 节。
- 核对日期写入构建报告，供发布前复核。

## 9. 产物布局

```text
dist/
├── claude-code/   # .claude-plugin/plugin.json、hooks/hooks.json（hooks + modules）、
│                  # hooks/register.ts、hooks/uapa-guard.mjs、hooks/uapa-claude-code.mjs、
│                  # types/index.d.ts
├── codebuddy/     # .codebuddy-plugin/plugin.json、hooks/hooks.json（只有 hooks）
├── codex/         # .codex-plugin/plugin.json、hooks/hooks.json、
│                  # hooks/uapa-codex.mjs
├── copilot-cli/   # plugin.json（$schema 格式）、com.github.copilot/hooks/ 下的 hooks.json 与入口
├── cursor/        # .cursor-plugin/plugin.json、rules/、hooks/hooks.json
├── kimi/          # kimi.plugin.json、hooks/uapa-kimi.mjs
├── kiro/          # power/（plugin.json、skills/、mcp.json）与 workspace/.kiro/（hooks/、steering/）
├── opencode/      # 插件模块与待复制到 .opencode/ 的配置文件
└── dsh/           # package.json（dsh.bundle）、cordis.patch.yml、插件模块
```

- 合并布局：配置可让多个宿主写入同一插件目录（各宿主的 manifest 文件名不同，可以并存）。合并
  规则以[模块接口](../../architecture/module-interfaces.md) §5、§8 与功能清单 F-03-06、F-03-07 为准：
  可合并的 JSON（如 Codex 与 Copilot CLI 共用的根 `plugin.json`）按命名空间合并，其余同名文件
  内容必须逐字一致。Claude Code 与 Codex 都生成 `hooks/hooks.json`，共用插件目录时须设置
  `hosts.codex.hooksFile`，否则按同名文件冲突失败，构建不自动改名（功能清单 SD-07）。
- hooks 模块只能导入相对路径文件与 `'claude-code'`，构建时把守卫逻辑打包为模块旁的相对
  文件，不能依赖 npm 包。
- CodeBuddy 的文档没有说明 `hooks.json` 缺少 `"hooks"` 键或含未知顶层键时的处理，生成器
  始终显式写出 `"hooks"` 键。
- Kimi Code 的 hook 规则只允许 `event`、`matcher`、`command`、`timeout` 四个字段，出现其他
  字段会使整个配置文件加载失败。

## 10. 未决问题

- **用户提示的检查。** 公共类型增加 `beforePrompt` 与能力 `promptGate`，列入 v0.1.0（功能清单
  SD-03、SD-18）；Claude Code 的提示事件可以阻断（2.1.296 本地实测），Codex 待 TA-15 实测。
- **守卫配置的传递。** v0.1.0 只透传 Claude Code 的 `userConfig`，统一接口延后（功能清单 SD-10）。
- **CodeBuddy Mods。** 是否增设 `codebuddy:in-process` 目标，取决于其 API 与 Claude Code 的
  对照结果与实测。
- **Kiro IDE。** 命令 hook 收不到 `tool_name`（#7375、#7500），修复前 `kiro:workspace-hook`
  的工具守卫在 IDE 中不生效。
- **DSH。** 工具入参改写只有提案，未实现。

## 来源

- [W1] uni-app 条件编译：<https://uniapp.dcloud.net.cn/tutorial/platform.html>
- [W2] Taro 多端开发与编译配置：<https://docs.taro.zone/docs/envs>、
  <https://docs.taro.zone/docs/app-config>、<https://docs.taro.zone/docs/envs-debug>
- [W3] Taro H5 未实现 API 的处理：
  <https://github.com/NervJS/taro/blob/main/packages/taro-h5/src/utils/index.ts>
- [W4] WXT manifest 与多浏览器构建：<https://wxt.dev/guide/essentials/config/manifest.html>、
  <https://wxt.dev/guide/resources/upgrading.html>
- [W5] unplugin：<https://unplugin.unjs.io/guide/>
