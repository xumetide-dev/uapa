# 测试夹具

每个夹具是本目录下的一个子目录，由 [`fixtures.test.ts`](fixtures.test.ts) 逐个运行并与期望产物
逐字节比对。格式与运行方式的权威定义见功能清单
[仓库工程与发布「夹具」](../../docs/feature-list/modules/10-repo-release.md#夹具)。

## 目录格式

```text
<夹具>/
├── source/              源项目，含 uapa.config.ts
├── case.json            命令参数与期望退出码，如 { "args": ["build"], "exitCode": 0 }
└── expected/
    ├── tree/            运行后整个源项目目录的期望内容
    ├── stdout.txt
    └── stderr.txt
```

- 夹具的配置只以 `import type` 引用 `'uapa'`，写作 `export default { ... } satisfies UapaConfig`；
  `tsconfig.json` 把 `'uapa'` 映射到 `src/index.ts`，`tsc` 因此会检查夹具配置的类型。
  故意写错配置的夹具（如 `invalid-config`）不写 `satisfies`。
- 含 Claude Code 目标的夹具都写 `author`。
- 运行时把 `source/` 复制到临时目录，`PATH` 只含一个空的临时目录，以 `process.execPath`
  运行 `src/cli/main.ts`，子进程不继承测试进程的环境变量。

## 更新期望输出

```bash
node test/fixtures/update.ts no-guard
```

不给夹具名时更新全部夹具。更新命令的分工：

| 文件 | 由谁写 |
|---|---|
| `stdout.txt`、`stderr.txt`、构建报告 `uapa-report.json`、打包生成的 `.mjs`、复制的源文件与 skills | 更新命令写入 |
| 插件目录中的 manifest 与 hooks 配置（构建报告以外、且不在 `source/` 中的 `.json` 文件） | 按验收标准手写；更新命令只核对，缺失或不一致时列出并以退出码 1 结束 |

提交前人工核对 diff：报告的字段、取值与条目顺序符合
[构建报告](../../docs/architecture/build-report.md)，stderr 每行符合模块接口 §8 的格式，
验收标准中逐字给出的原因与之一致。
