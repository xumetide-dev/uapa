# UAPA

一份源项目，构建 Claude Code、Codex 与 Antigravity CLI（agy）三个编码代理的插件。

UAPA（Unified Agent Plugin Architecture）是一个 TypeScript 命令行工具。团队给编码代理准备的
skills、agents、rules、commands、MCP 服务器，以及拦截高危操作的守卫（guard），只在一个源项目中
写一次；`uapa build` 按各宿主的插件格式与 hooks 协议生成可以直接安装的插件目录，并在构建报告中
写明每个宿主做不到的部分。

## 为什么用 UAPA

- **一份规则，三个宿主。** 三个宿主的插件清单、hooks 事件名与输入输出格式各不相同。“不许跳过
  git hooks”这样一条规则，手写插件要写三份、维护三份；用 UAPA 只写一个 TypeScript 守卫。
- **能力缺失不会静默放行。** agy 没有提示提交事件，Codex 不能替换工具输出。UAPA 按每个目标的
  能力数据处理守卫的决策：能降级的降级（如不能改写入参时改为拒绝），守卫声明为必需的能力缺失时
  该目标构建失败，两种情况都写入构建报告。
- **产物自包含。** 守卫被打包进每个宿主的入口文件，插件目录不依赖 UAPA 或任何 npm 包；
  `uapa build --check` 可以在持续集成中确认已提交的产物与源项目一致。
- **宿主行为有出处。** 每个目标的能力取值都来自官方文档、公开源码或可复现的宿主实测，并注明
  核对时的宿主版本。

## 快速上手

需要 Node ≥ 22.18 与 git。在源项目目录中安装（其他安装方式见下文「安装」）：

```bash
pnpm add -D github:xumetide-dev/uapa#v0.3.0
```

`uapa.config.ts` 声明插件与要构建的目标；`skills/`、`agents/`、`rules/`、`commands/` 等目录按约定
读取：

```ts
import { defineConfig } from 'uapa'

export default defineConfig({
  name: 'team-rules',
  version: '0.1.0',
  description: '团队的提交与依赖约定',
  author: { name: 'Example Team' },
  targets: [
    'claude-code:in-process',
    'claude-code:subprocess',
    'codex:subprocess',
    'agy:subprocess',
  ],
  guard: 'guard.ts',
})
```

`guard.ts` 实现守卫：拒绝含 `--no-verify` 的命令，把 `npm install` 改写为 `pnpm install`：

```ts
import type { GuardPlugin } from 'uapa'

const guard: GuardPlugin = {
  name: 'team-rules',
  requires: [],
  beforeTool: call => {
    const command = call.tool === 'shell' ? String(call.input.command) : ''
    if (command.includes('--no-verify')) {
      return { kind: 'deny', reason: '不要跳过 git hooks：去掉 --no-verify 后重试' }
    }
    if (command.startsWith('npm install')) {
      return {
        kind: 'rewrite',
        input: { command: command.replace('npm install', 'pnpm install') },
        fallbackReason: '本仓库使用 pnpm：请改用 pnpm install',
      }
    }
    return { kind: 'allow' }
  },
}

export default guard
```

构建：

```bash
pnpm exec uapa build
```

```text
成功 claude-code:in-process：跳过 0，降级 0，残余风险 0
成功 claude-code:subprocess：跳过 0，降级 0，残余风险 1
成功 codex:subprocess：跳过 0，降级 0，残余风险 3
成功 agy:subprocess：跳过 0，降级 0，残余风险 0
构建报告：dist/uapa-report.json
```

`dist/claude-code/`、`dist/codex/`、`dist/agy/` 各是一个插件目录，可直接加载，例如
`claude --plugin-dir dist/claude-code`。残余风险是守卫在某些条件下不生效的情况，如运行宿主的
机器缺少 Node、Codex 须先信任插件的 hooks，逐条写在构建报告中。完整步骤见
[快速上手](docs/guide/getting-started.md)。

## 支持的宿主

| | Claude Code | Codex | Antigravity CLI（agy） |
|---|---|---|---|
| 目标 | `claude-code:in-process`、`claude-code:subprocess` | `codex:subprocess` | `agy:subprocess` |
| skills | ✓ | ✓ | ✓ |
| agents | ✓ | — | ✓ |
| rules | — | — | ✓ |
| commands | ✓ | ✓（安装时转换为技能） | — |
| MCP 服务器 | ✓ | ✓ | ✓ |
| 执行前检查：拒绝、改写入参 | ✓ | ✓ | ✓ |
| 提示提交前检查 | ✓ | ✓ | — |
| 执行后检查：扣留、替换输出 | 扣留与替换 | 扣留 | — |
| 停机前检查 | ✓ | ✓ | ✓ |
| 守卫选项 | 使用者设置 | 取默认值 | 取默认值 |
| 核对的宿主版本 | 2.1.296 | codex-cli 0.162.1 | 1.3.4 / 1.3.5 |

“—”表示宿主不承载：组件写入构建报告的跳过项，检查按降级或残余风险处理。各项的细节与出处见
[目标与宿主差异](docs/guide/targets.md)。

## 安装

UAPA 不发布到 npm registry，以固定到 tag 的 git 依赖安装，不引用分支：
`"uapa": "github:xumetide-dev/uapa#vX.Y.Z"`。tag 对应的提交含编译后的 `dist/`，包中没有生命周期
脚本，安装时不运行任何脚本。

pnpm 12 对项目直接声明的 git 依赖不需要额外设置：

```bash
pnpm add -D github:xumetide-dev/uapa#v0.3.0
```

npm 12 默认禁止 git 依赖，先在项目的 `.npmrc` 中只放行项目直接声明的 git 依赖：

```bash
npm config set allow-git=root --location=project
```

```bash
npm install -D github:xumetide-dev/uapa#v0.3.0
```

升级时改 tag 后重新安装，锁文件记录 tag 对应的提交。运行宿主的机器上需要 Node ≥ 22：
`subprocess` 目标的 hooks 以 `node` 运行入口文件。

## 文档

| 页面 | 内容 |
|---|---|
| [快速上手](docs/guide/getting-started.md) | 从最小的源项目构建三个宿主的插件并加载 |
| [源项目结构](docs/guide/source-project.md) | skills、agents、rules、commands、MCP 服务器与覆盖文件的位置 |
| [构建配置](docs/guide/configuration.md) | `uapa.config.ts` 的字段、宿主选项与产物布局 |
| [编写守卫](docs/guide/guards.md) | 四种检查的写法、守卫选项与测试 |
| [目标与宿主差异](docs/guide/targets.md) | 各目标的能力、降级与残余风险 |
| [构建、检查与报告](docs/guide/build-and-check.md) | `uapa build` 与 `--check`、构建报告、持续集成 |
| [安装与分发](docs/guide/install.md) | 在各宿主中加载产物、信任 hooks、分发给团队 |
| [常见错误](docs/guide/troubleshooting.md) | 错误信息、原因与处理办法 |

## 版本与路线图

| 版本 | 内容 |
|---|---|
| v0.1.0 | 四个目标；skills；执行前、提示提交前与停机前检查；命令 hooks |
| v0.2.0 | agents、MCP 服务器；执行后检查 |
| v0.3.0 | rules、commands；守卫选项 |

Cursor、Kiro、CodeBuddy、OpenCode、DSH 计划在后续版本逐个增加；GitHub Copilot CLI 与 Kimi Code
的设计已保留，暂不实现。

## 参与开发

```bash
pnpm install --frozen-lockfile
```

```bash
pnpm check
```

`pnpm check` 运行两套 `tsc` 配置、Biome、`node --test` 与功能清单关系检查；同样的检查也可以在
一次性容器中以 `test/container/run.sh check` 运行。仓库结构、夹具、设计文档的阅读顺序与测试的
安全规则见[开发 UAPA](docs/guide/developing-uapa.md)。

## 许可证

Apache-2.0，见 [LICENSE](LICENSE)。
