# UAPA

UAPA（Unified Agent Plugin Architecture）是编码代理插件的多目标构建工具（TypeScript 命令行）：
从一份插件源项目，构建出各宿主可安装的插件目录，并输出构建报告。

**状态：** v0.1.0 以 tag `v0.1.0` 发布，按 [Sprint M1](docs/workorders/M1-00-v0-1-0-three-host-build.md)
的施工单实现；技术选型见 [ARCH-001](docs/architecture/ARCH-001-agent-plugin-build-tool.md)。发布时
尚未完成的宿主实测见 [Sprint M1 收口](docs/acceptance/M1-00-v0-1-0-three-host-build.md) §4。

## v0.1.0 范围

- 目标：`claude-code:in-process`、`claude-code:subprocess`、`codex:subprocess`、
  `agy:subprocess`，覆盖 Claude Code、Codex、Antigravity CLI（agy）三个宿主。GitHub Copilot CLI
  与 Kimi Code 的设计保留为预留，见[范围决策 SD-26、SD-27](docs/feature-list/scope-decisions.md)。
- 组件：skills；守卫 hooks：执行前、提示提交前与停机前检查。
- 命令 hooks：配置中原样声明、不经守卫逻辑的命令，由子进程目标按宿主事件名写入 hooks 配置，见
  [命令 hooks 声明](docs/architecture/command-hooks.md)。
- 对外接口：命令 `uapa build` 与 `uapa build --check`；包入口导出 `defineConfig` 与公共类型。
- Cursor、Kiro、CodeBuddy、OpenCode、DSH 在后续版本逐个增加，见
  [范围决策 SD-01](docs/feature-list/scope-decisions.md)。

## 安装

UAPA 不发布到 npm registry，以固定到 tag 的 git 依赖安装：`package.json` 中写作
`"uapa": "github:xumetide-dev/uapa#vX.Y.Z"`，不引用分支。tag 对应的提交含编译后的 `dist/`，
包中没有生命周期脚本，安装时不运行任何脚本；解析 tag 需要本机有 git。以下以 `v0.1.0` 为例。

pnpm 12 对项目直接声明的 git 依赖不需要额外设置：

```bash
pnpm add -D github:xumetide-dev/uapa#v0.1.0
```

npm 12 默认禁止 git 依赖（`allow-git` 的默认值为 `none`，取值 `none`、`root`、`all`）。在项目的
`.npmrc` 中写入 `allow-git=root`，只放行项目直接声明的 git 依赖，之后的 `npm install`、`npm ci`
也按此放行：

```bash
npm config set allow-git=root --location=project
```

```bash
npm install -D github:xumetide-dev/uapa#v0.1.0
```

升级时改 tag 后重新安装，锁文件记录 tag 对应的提交。

## 阅读顺序

1. [架构](docs/architecture/architecture.md)：术语、v0.1.0 目标、模块与依赖方向、构建调用顺序、
   目录结构、发布方式。
2. [模块接口](docs/architecture/module-interfaces.md)：构建配置字段、宿主模块接口、能力数据、
   写出与退出码、命令行调用构建的契约；[入口与打包接口](docs/architecture/runtime-interfaces.md)：
   打包请求、入口文件与子进程协议；[构建报告](docs/architecture/build-report.md)：报告字段与填写规则；
   [命令 hooks 声明](docs/architecture/command-hooks.md)：原样声明的命令 hooks 的字段、事件与写入规则。
3. [功能清单](docs/feature-list/README.md)：按功能模块列出要实现的功能、验收标准、依赖与建议
   实现顺序。
4. [hooks 适配](docs/research/coding-agent-plugin-manifests/uapa-hook-adapters.md)：守卫公共
   类型与规范工具名（v0.1.0 的唯一定义处）、各目标的决策输出、能力缺失与失败处理。
5. [设计提案](docs/research/coding-agent-plugin-manifests/unified-agent-plugin-architecture.md)：
   定位、与 uni-app 的对照、后续目标的形态与组件承载。
6. [宿主调研](docs/research/coding-agent-plugin-manifests/README.md)：各宿主的 manifest 与
   hooks 事实；宿主行为只以这些文档为准。

### 文档冲突时的依据

- 数据类型、文件位置、写出与退出码以模块接口、入口与打包接口、构建报告、命令 hooks 声明为准。
- 模块职责与依赖方向以架构为准。
- 验收标准以功能清单为准。
- 宿主行为以宿主调研为准。
- hooks 适配与设计提案中与以上文档不一致的内容不再适用。

[ARCH-001](docs/architecture/ARCH-001-agent-plugin-build-tool.md) 记录选型理由、被否决的方案与
复议条件；其结论已回填到架构文档，后续变更只记在架构文档与
[范围决策](docs/feature-list/scope-decisions.md) 中。关系检查脚本为
`scripts/check-feature-list.mjs`。

## 本地检查

需要 Node ≥ 22.18 与 pnpm 12（版本由 `package.json` 的 `packageManager` 字段指定）。安装依赖：

```bash
pnpm install --frozen-lockfile
```

运行检查（两套 `tsc` 配置、Biome、`node --test` 与功能清单关系检查，任一失败即以非零退出码
结束）：

```bash
pnpm check
```

同样的检查也可以在一次性容器中运行，本机只需要 bash、git 与 Docker；宿主实测（真实代理会话）
也在容器中进行，见[容器测试](test/container/README.md)：

```bash
test/container/run.sh check
```

仓库不配置 CI，提交前在本地运行。施工顺序见[施工单](docs/workorders/README.md)，验收证据见
[验收记录](docs/acceptance/README.md)。

## 约定

- UAPA 不包含使用方的业务逻辑；使用方的守卫判断留在使用方仓库，经公共类型接入。
- 调研结论只依据官方文档、公开仓库源码（注明 tag 或提交）与可复现的本地实测。
- 发布以 git tag 标记，tag 对应的提交包含构建后的 JS，安装时不运行构建脚本。

## 许可证

Apache-2.0，见 [LICENSE](LICENSE)。
