# UAPA

UAPA（Unified Agent Plugin Architecture）是编码代理插件的多目标构建工具：从一份插件源项目，
构建出 Claude Code、Codex、GitHub Copilot CLI、Cursor、Kimi Code、Kiro、CodeBuddy、OpenCode、
DSH 各自可安装的插件包，并输出构建报告。

**状态：设计提案，未实现。** 仓库中还没有代码。

## 文档

| 文档 | 内容 |
|---|---|
| [架构](docs/architecture/architecture.md) | 模块组成与依赖方向、技术选型、目录结构、分发与发布；选型理由见 [ARCH-001](docs/architecture/ARCH-001-agent-plugin-build-tool.md) |
| [功能清单](docs/feature-list/README.md) | 按模块列出各版本交付的功能、用户故事、技术验收与范围决策；关系检查见 `scripts/check-feature-list.mjs` |
| [设计提案](docs/research/coding-agent-plugin-manifests/unified-agent-plugin-architecture.md) | 定位、与 uni-app 的对照、源项目、构建流程、目标能力数据、产物布局 |
| [hooks 适配](docs/research/coding-agent-plugin-manifests/uapa-hook-adapters.md) | 守卫逻辑的公共类型、工具名映射、Claude Code 双形态去重、失败处理 |
| [宿主调研](docs/research/coding-agent-plugin-manifests/README.md) | 九个宿主的插件机制、manifest 与 hooks 语义 |

## 约定

- UAPA 不包含使用方的业务逻辑；使用方的守卫判断留在使用方仓库，经公共类型接入。
- 调研结论只依据官方文档、公开仓库源码（注明 tag 或提交）与可复现的本地实测。
- 发布以 git tag 标记，tag 对应的提交包含构建后的 JS，安装时不运行构建脚本。

## 许可证

Apache-2.0，见 [LICENSE](LICENSE)。
