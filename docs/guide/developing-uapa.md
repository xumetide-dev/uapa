# 开发 UAPA

本文面向修改 UAPA 本身的开发者：仓库结构、从源码运行、检查与测试、夹具，以及宿主升级时怎样
更新能力数据。模块职责与依赖方向以[架构](../architecture/architecture.md)为准，功能与验收标准以
[功能清单](../feature-list/README.md)为准；测试的安全规则见仓库根的
[`AGENTS.md`](../../AGENTS.md)「测试安全」。

## 仓库结构

| 目录 | 内容 |
|---|---|
| `src/cli/` | 命令行参数、终端输出与退出码 |
| `src/config/` | `defineConfig`、配置加载与校验、目标名、插件目录解析 |
| `src/source/` | 读取 skills、agents、MCP 服务器、覆盖文件与守卫声明，只读 |
| `src/build/` | 能力检查、调用宿主模块、放置组件、合并、写出与比对、构建报告 |
| `src/capabilities/` | 每个目标一个能力数据模块，带宿主版本、核对日期与出处 |
| `src/targets/<宿主>/` | 生成一个宿主的 manifest、hooks 配置与 MCP 配置；Claude Code 另有宿主校验 |
| `src/bundle/` | 调用 rolldown，把守卫、目标数据与入口源码打包为单文件 |
| `src/runtime/core/` | 守卫公共类型、工具名换算、返回值检查；不做 I/O，不引用 Node 类型 |
| `src/runtime/entries/` | 各目标的入口源码 |
| `src/report/` | 构建报告的类型与终端摘要 |
| `test/` | 按模块分目录的单元测试、`fixtures/` 夹具、`container/` 容器测试入口 |
| `docs/` | `architecture/` 架构与接口、`feature-list/` 功能清单、`research/` 宿主调研、`workorders/` 施工单、`acceptance/` 验收记录、`guide/` 帮助文档 |

一次构建的调用顺序见[架构 §1](../architecture/architecture.md#1-组成与模块)。

## 环境与检查

需要 Node ≥ 22.18 与 pnpm 12。安装依赖：

```bash
pnpm install --frozen-lockfile
```

运行全部检查（两套 `tsc` 配置、Biome、`node --test` 与功能清单关系检查）：

```bash
pnpm check
```

同样的检查可以在一次性容器中运行，本机只需要 bash、git 与 Docker：

```bash
test/container/run.sh check
```

运行单个测试：

```bash
test/container/run.sh exec node --test test/runtime/subprocess.test.ts
```

需要真实代理会话的宿主实测在 `test/container/run.sh shell` 的容器中进行，认证由开发者自行准备，
见[容器测试](../../test/container/README.md)。

## 从源码运行

源码以 Node 的类型剥离直接运行，不需要编译。对某个源项目运行构建：

```bash
node src/cli/main.ts build --config <源项目>/uapa.config.ts
```

源项目中以 `import type` 引用 `'uapa'` 时可以直接运行；以值导入 `defineConfig` 时，`'uapa'` 须
解析到已编译的包（tag 对应的提交含 `dist/`）。

## 测试代码的规则

提交进仓库的用例与夹具也会在开发者机器上运行，无论在哪里运行都必须无害：

- 验证拒绝与改写时，让守卫匹配无副作用的标记命令（如 `echo uapa-deny-probe`），不匹配真实的
  高危命令。
- 文件操作限定在 `mkdtemp` 创建的临时目录内，结束时只清理该目录。
- 宿主命令、网络、推送与发布用桩替代，参见 `test/targets/claude-code-hooks.test.ts` 中写入临时
  `PATH` 的假 `claude`。

完整规则见 [`AGENTS.md`](../../AGENTS.md)「测试安全」。

## 夹具

`test/fixtures/<夹具>/` 含源项目、命令参数、期望退出码与运行后的期望目录树，由
`fixtures.test.ts` 在临时目录中构建并逐字节比对；入口用例另以期望的 stdin、stdout 与退出码运行
打包后的入口。格式见[测试夹具](../../test/fixtures/README.md)。改动生成逻辑后更新期望输出：

```bash
node test/fixtures/update.ts full
```

不给夹具名时更新全部夹具。manifest 与 hooks 配置按验收标准手写，更新命令只核对；提交前人工
核对 diff。

## 宿主升级时更新能力数据

能力数据只引用已核实的宿主事实（官方文档、公开源码或可复现的实测）：

1. 在容器中对新版本宿主实测受影响的行为，结论与宿主版本写入
   [宿主调研](../research/coding-agent-plugin-manifests/README.md)中对应宿主的文档。
2. 修改 `src/capabilities/<目标>.ts`：`host.version`、`host.checked`，以及取值与指向调研小节的注释。
3. 能力取值改变时，更新受影响夹具的期望输出，确认构建报告的降级与残余风险随之变化。
4. 运行 `pnpm check`。

能力数据的字段见[模块接口 §4](../architecture/module-interfaces.md#4-目标能力数据)。

## 工作流程

- 新功能先写入功能清单，再按[施工单](../workorders/README.md)拆分实施，证据记入
  [验收记录](../acceptance/README.md)。
- 提交信息用 Conventional Commits 前缀（`feat`、`fix`、`docs`、`chore` 等），正文写改了什么与理由。
- 发布由 `scripts/release.ts` 完成：检查、编译 `dist/`、创建含 `dist/` 的发布提交与 tag、安装冒烟；
  用法见脚本开头的注释。
