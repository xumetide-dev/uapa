# 安装与分发

本文说明怎样把构建出的插件目录装进 Claude Code、Codex 与 agy，以及分发给团队的方式。本地目录的
加载与安装步骤已用 UAPA 的夹具产物实测，见
[M2-05 验收](../acceptance/M2-05-three-host-live-tests.md)；经 marketplace 从 git 分发的方式取自
各宿主的官方文档，未以 UAPA 产物实测。

## 前提条件

- 已运行 `uapa build`，插件目录默认为 `dist/claude-code`、`dist/codex`、`dist/agy`。
- 运行宿主的机器上有 Node ≥ 22（只配置 `claude-code:in-process` 时 Claude Code 不需要）。

## Claude Code

以插件目录启动会话，插件不安装到用户配置（Claude Code 2.1.296 实测）：

```bash
claude --plugin-dir dist/claude-code
```

- 会话中重新构建后，用 `/reload-plugins` 重载。
- `/plugin` 面板的 Errors 标签页显示插件的加载错误。
- UAPA 在写出后已运行 `claude plugin validate --strict`（PATH 中有 `claude` 时）；手动运行：

```bash
claude plugin validate dist/claude-code --strict
```

## Codex

Codex 从 marketplace 安装插件，安装后须信任插件的 hooks（codex-cli 0.162.1 容器实测）。

1. 建立本地 marketplace 目录，把 `dist/codex` 复制为其中的 `plugins/<插件名>/`：

   ```text
   <marketplace 目录>/
   ├── .agents/plugins/marketplace.json
   └── plugins/team-rules/        dist/codex 的副本
   ```

   `marketplace.json`：

   ```json
   {
     "name": "team-local",
     "interface": { "displayName": "Team Local" },
     "plugins": [
       {
         "name": "team-rules",
         "source": "./plugins/team-rules",
         "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
         "category": "Developer Tools"
       }
     ]
   }
   ```

2. 登记 marketplace 并安装插件：

   ```bash
   codex plugin marketplace add <marketplace 目录>
   ```

   ```bash
   codex plugin add team-rules@team-local
   ```

3. 启动 TUI（`codex`）。出现 “Hooks need review” 对话框时选 “Trust all and continue”。Codex 在
   用户配置中为每个 hook 记一条 `trusted_hash`，之后的会话（含 `codex exec`）运行这些 hooks。

- 信任之前 Codex 静默跳过插件的 hooks，守卫不生效，也不报错。
- 安装时复制插件目录（位于 `~/.codex/plugins/cache/<marketplace>/<插件>/<版本>/`）。重新构建后
  更新副本，以 `codex plugin remove team-rules@team-local` 移除再重新安装；hooks 配置改动后须再次
  信任。

## agy

```bash
agy plugin install dist/agy
```

- 1.3.4 的 `agy plugin install <本地目录>` 把目录复制到 `~/.gemini/config/plugins/<插件名>/`；重新
  构建后以 `agy plugin uninstall <插件名>` 卸载再安装。
- 全局安装的插件与其 hooks 对本机该用户的全部 agy 会话生效，在共用的机器上安装前先确认。
- 确认已安装：

```bash
agy plugin list --json
```

- agy 没有信任步骤。`agy plugin validate` 对结构错误也报告 `[ok]`，不作为检查手段。

## 分发给团队

UAPA 不生成 marketplace 文件。分发时把产物与手写的 marketplace 文件一起提交进仓库，使用者按各
宿主的方式从 git 安装：

| 宿主 | marketplace 文件 | 条目的 `source` | 安装命令 |
|---|---|---|---|
| Claude Code | `.claude-plugin/marketplace.json`（`name`、`owner`、`plugins`） | 以 `./` 开头、不含 `..` 的相对路径，或 `github` 等来源 | `claude plugin marketplace add <仓库>`，再 `claude plugin install <插件>@<marketplace>` |
| Codex | `.agents/plugins/marketplace.json`（`name`、`plugins`） | `local` 路径、`url`、`git-subdir` 等；条目须写 `policy.installation` 与 `category` | `codex plugin marketplace add <owner/repo>`，再 `codex plugin add <插件>@<marketplace>` |
| agy | 不需要 | — | `agy plugin install <GitHub 仓库 URL>` |

- marketplace 条目的 `name` 应与插件 `plugin.json` 的 `name` 一致；Codex 的文档另要求与插件目录名
  一致。
- 要让仓库根目录本身就是 Claude Code 与 Codex 的插件，使用
  [合并布局](configuration.md#合并布局)。
- 在安装说明中写明 Codex 的信任步骤与 Node ≥ 22 的要求。

字段与来源类型见各宿主调研：

- [Claude Code「marketplace.json」](../research/coding-agent-plugin-manifests/claude-code-plugins.md)
- [Codex「marketplace.json」](../research/coding-agent-plugin-manifests/codex-plugins.md#marketplacejson)
- [agy「安装与管理」](../research/coding-agent-plugin-manifests/agy-plugins.md#安装与管理)
