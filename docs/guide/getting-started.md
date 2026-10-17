# 快速上手

本文从一个只含一个 skill 与一个守卫的源项目开始，构建出 Claude Code、Codex 与 agy 的插件目录，
再在 Claude Code 中加载。各部分的完整说明见[源项目结构](source-project.md)、
[构建配置](configuration.md)与[编写守卫](guards.md)；各宿主的安装方式见[安装与分发](install.md)。

## 前提条件

- Node ≥ 22.18：UAPA 以 Node 的类型剥离（type stripping）直接导入 `uapa.config.ts` 与守卫文件，
  不需要另行编译。
- git：UAPA 以固定到 tag 的 git 依赖安装，解析 tag 需要 git。
- pnpm 12 或 npm 12。
- 运行宿主的机器上有 Node ≥ 22：`subprocess` 目标的 hooks 以 `node` 运行入口文件。

## 1. 建立源项目并安装 UAPA

在一个新目录中建立如下文件：

```text
team-rules/
├── package.json
├── uapa.config.ts
├── guard.ts
└── skills/
    └── commit-message/
        └── SKILL.md
```

`package.json` 至少写 `"type": "module"`：

```json
{
  "name": "team-rules",
  "private": true,
  "type": "module"
}
```

在该目录中安装 UAPA（npm 的写法与升级方式见仓库 [README「安装」](../../README.md#安装)）：

```bash
pnpm add -D github:xumetide-dev/uapa#v0.4.0
```

## 2. 写配置、skill 与守卫

`uapa.config.ts` 声明插件名、版本与要构建的目标。`claude-code:in-process` 与
`claude-code:subprocess` 写入同一个插件目录，两种形态互为兜底，见
[目标与宿主差异](targets.md#claude-code-的两种形态)：

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

`skills/commit-message/SKILL.md` 的 frontmatter 中 `name` 与目录名相同：

```markdown
---
name: commit-message
description: 按 Conventional Commits 写提交信息
---

提交信息第一行写作 `<type>: <说明>`，type 取 feat、fix、docs、chore 之一。
```

`guard.ts` 默认导出一个 `GuardPlugin`：拒绝含 `--no-verify` 的 shell 命令，把 `npm install`
改写为 `pnpm install`，拦下含私钥的提示：

```ts
import type { BeforeTool, GuardPlugin } from 'uapa'

function checkShell(command: string): BeforeTool {
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
}

const guard: GuardPlugin = {
  name: 'team-rules',
  requires: [],
  beforeTool: call =>
    call.tool === 'shell' ? checkShell(String(call.input.command)) : { kind: 'allow' },
  beforePrompt: p =>
    p.prompt.includes('PRIVATE KEY-----')
      ? { kind: 'block', reason: '提示中含私钥，已拦下' }
      : { kind: 'allow' },
}

export default guard
```

## 3. 构建

```bash
pnpm exec uapa build
```

全部目标成功时以退出码 0 结束，stdout 每个目标一行摘要：

```text
成功 claude-code:in-process：跳过 0，降级 0，残余风险 2
成功 claude-code:subprocess：跳过 0，降级 0，残余风险 4
成功 codex:subprocess：跳过 0，降级 0，残余风险 5
成功 agy:subprocess：跳过 0，降级 0，残余风险 2
构建报告：dist/uapa-report.json
```

产物写在 `dist/` 下，每个宿主一个插件目录：

```text
dist/
├── claude-code/
│   ├── .claude-plugin/plugin.json
│   ├── hooks/hooks.json            命令 hooks 与 hooks 模块的声明
│   ├── hooks/register.ts           hooks 模块（claude-code:in-process）
│   ├── hooks/uapa-guard.mjs        打包后的守卫，供 register.ts 引入
│   ├── hooks/uapa-claude-code.mjs  命令 hooks 的入口（claude-code:subprocess）
│   └── skills/commit-message/SKILL.md
├── codex/
│   ├── .codex-plugin/plugin.json
│   ├── hooks/hooks.json
│   ├── hooks/uapa-codex.mjs
│   └── skills/commit-message/SKILL.md
├── agy/
│   ├── plugin.json
│   ├── hooks.json
│   ├── hooks/uapa-agy.mjs
│   └── skills/commit-message/SKILL.md
└── uapa-report.json                构建报告
```

守卫被打包进各入口文件，产物不依赖 UAPA 或其他 npm 包。残余风险的条目写在
`dist/uapa-report.json` 中：本例中各子进程目标都有“缺少 Node ≥ 22 时检查不生效”，Codex 另有
“须信任 hooks”，agy 没有提示提交事件、提示不受检查。读法见
[构建、检查与报告](build-and-check.md#构建报告)。

## 4. 在 Claude Code 中加载

以插件目录启动会话，插件不安装到用户配置：

```bash
claude --plugin-dir dist/claude-code
```

在会话中让代理运行一条含 `--no-verify` 的 `git commit`：执行前检查拒绝该命令，代理读到
`reason` 中的说明。Codex 与 agy 的安装步骤不同，Codex 还须在 TUI 中信任插件的 hooks，见
[安装与分发](install.md)。

## 5. 修改后重新构建

改动源项目后再次运行 `pnpm exec uapa build`。默认布局在写入前清空各插件目录，删除或改名的
组件不会残留。在持续集成中确认已提交的产物与源项目一致：

```bash
pnpm exec uapa build --check
```

没有差异时 stdout 为空、退出码为 0；有差异时逐行列出 `added`、`modified`、`removed` 与路径，
以退出码 1 结束，见[构建、检查与报告](build-and-check.md#比对模式---check)。

## 参考

- 守卫在各宿主会话中的实测：[M2-05 验收](../acceptance/M2-05-three-host-live-tests.md)。
- 守卫的单元测试写法：[编写守卫「测试守卫」](guards.md#测试守卫)。
