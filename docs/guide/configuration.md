# 构建配置

本文说明 `uapa.config.ts` 的字段、各宿主的选项与两种产物布局。类型定义与校验规则的权威文本在
[模块接口 §2](../architecture/module-interfaces.md#2-构建配置)；命令 hooks 的字段见
[命令 hooks](command-hooks.md)。

## 配置文件

配置文件默认为当前目录下的 `uapa.config.ts`，以 `--config <路径>` 指定其他文件。文件以
`export default` 导出配置对象，用 `defineConfig` 包裹可得到类型提示：

```ts
import { defineConfig } from 'uapa'

export default defineConfig({
  name: 'team-rules',
  version: '0.1.0',
  description: '团队的提交与依赖约定',
  author: { name: 'Example Team' },
  targets: ['claude-code:subprocess', 'codex:subprocess', 'agy:subprocess'],
  guard: 'guard.ts',
})
```

- 只引用类型时也可写 `import type { UapaConfig } from 'uapa'` 与
  `export default { ... } satisfies UapaConfig`。
- 配置以 Node 的类型剥离导入：相对导入写 `.ts` 扩展名，不用 `enum`、`namespace` 等需要编译的
  语法。
- 配置中的相对路径（`guard`、`outDir`、`hosts.<宿主>.dir`）以配置文件所在目录为基准，与运行
  命令时的当前目录无关。
- 校验失败时 stderr 写出 `uapa: <文件>: <字段>: <原因>`，以退出码 2 结束，不构建任何目标。

## 字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `name` | 是 | 插件名，写入各宿主的 manifest；命名规则见下文 |
| `version` | 是 | semver 版本号，如 `0.1.0` |
| `description` | 是 | 插件说明 |
| `author` | 含 Claude Code 目标时必填 | `{ name, email?, url? }`；Codex 与 agy 的 manifest 不写 |
| `keywords` | 否 | 字符串数组，写入 Claude Code 与 Codex 的 manifest |
| `targets` | 是 | 要构建的目标，非空、不重复，取值见[目标与宿主差异](targets.md) |
| `guard` | 否 | 守卫逻辑文件；省略时不生成守卫 hooks 与入口 |
| `outDir` | 否 | 输出根目录，默认 `dist`；构建报告写在这里 |
| `commandHooks` | 否 | 原样声明的命令 hooks，见[命令 hooks](command-hooks.md) |
| `hosts` | 否 | 各宿主的选项，见[宿主选项](#宿主选项) |

未知字段为校验错误。插件名的规则由各宿主模块检查，不符合时该宿主的目标构建失败：

| 宿主 | 规则 |
|---|---|
| Claude Code | kebab-case；不以 `claude-`、`anthropic-`、`anthropics-`、`cc-plugin-` 开头；不是 `claude`、`anthropic`、`claude-code`、`claude-mods` |
| Codex | kebab-case |
| agy | 匹配 `^[a-zA-Z0-9_-]+$` |

Claude Code 缺少 `author` 时 `claude plugin validate --strict` 判为失败，因此 UAPA 在生成时就
拒绝。规则的出处见
[Claude Code「plugin.json 字段」](../research/coding-agent-plugin-manifests/claude-code-plugins.md)、
[agy「插件 manifest」](../research/coding-agent-plugin-manifests/agy-plugins.md#插件-manifest)。

## 宿主选项

`hosts.<宿主>` 中的选项由该宿主的全部目标共用；`hosts` 中出现未列入 `targets` 的宿主为校验
错误。

| 宿主 | 选项 | 写入位置 |
|---|---|---|
| 全部 | `dir` | 该宿主的插件目录，默认 `<outDir>/<宿主>`；见[产物布局](#产物布局) |
| `claude-code` | `displayName`、`userConfig`、`dependencies`、`$schema` | `.claude-plugin/plugin.json` 的同名字段 |
| `codex` | `interface` | `.codex-plugin/plugin.json` 的 `interface`（展示名、分类等） |
| `codex` | `hooksFile` | hooks 配置在插件目录中的相对路径，默认 `hooks/hooks.json`；不得为绝对路径或含 `..` |
| `agy` | 只有 `dir` | agy 的 `plugin.json` 只接受 `name` 与 `description` |

各字段在宿主中的含义见宿主调研的 manifest 一节：
[Claude Code](../research/coding-agent-plugin-manifests/claude-code-plugins.md)、
[Codex](../research/coding-agent-plugin-manifests/codex-plugins.md)。

```ts
hosts: {
  'claude-code': { displayName: 'Team Rules' },
  codex: { interface: { displayName: 'Team Rules', developerName: 'Example Team' } },
},
```

## 产物布局

插件目录由 `hosts.<宿主>.dir` 决定。解析为同一路径的宿主写入同一目录：只有一个宿主的目录为
默认布局，两个以上宿主的目录为合并布局。同一次构建可以同时有两种目录。

### 默认布局

每个宿主一个插件目录，默认为 `dist/claude-code`、`dist/codex`、`dist/agy`。

- 某宿主至少一个目标生成成功时，先清空该插件目录再写入；该宿主的目标全部失败时目录保持原状。
- 因为写入前清空，插件目录不得等于或包含源项目根目录、`outDir` 或另一个插件目录，否则配置
  校验失败。

### 合并布局

多个宿主写入同一个目录，常用于让源项目所在的仓库本身就是可从 git 安装的插件。下例让
Claude Code 与 Codex 都以源项目根目录为插件目录，agy 仍写入 `dist/agy`
（[`merged` 夹具](../../test/fixtures/merged/source/uapa.config.ts)）：

```ts
hosts: {
  'claude-code': { dir: '.' },
  codex: { dir: '.', hooksFile: 'hooks/codex-hooks.json' },
},
```

- 只写入生成的文件，不删除目录中的其他文件。组件删除或改名后留下的旧文件须手动删除。
- 各宿主生成的同名文件必须逐字一致，否则写入该目录的全部目标失败，该目录不写入任何文件。
  Claude Code 与 Codex 的 hooks 配置默认都是 `hooks/hooks.json`，因此上例为 Codex 指定
  `hooksFile`。
- 插件目录就是源项目根目录时，skills 与 agents 直接从源项目加载，不再复制。
- 构建报告仍写在 `<outDir>/uapa-report.json`。

## 参考

- 字段与校验：[模块接口 §2](../architecture/module-interfaces.md#2-构建配置)。
- 写出与清空的规则：[模块接口 §8](../architecture/module-interfaces.md#8-写出比对与退出码)。
