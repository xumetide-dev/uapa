# 09 命令行

命令、参数、终端输出与退出码。代码位于 `src/cli/`；构建器中只有本模块读取命令行参数、向终端
输出与设置退出码。退出码与错误输出格式见 [模块接口 §8](../../architecture/module-interfaces.md)。

| 编号 | 阶段 | 子模块 | 功能名称 | 验收标准 | 依赖 |
|---|---|---|---|---|---|
| F-09-01 | v0.1.0 | 命令 | `uapa build` 命令 | 读取当前目录的 `uapa.config.ts`，`--config` 可指定路径，配置中的相对路径以该文件所在目录为基准；按模块接口 §8 调用 `loadConfig` 与 `build`，构建后以 `formatSummary(report, reportPath)` 打印终端摘要 | F-03-03, F-03-05, F-03-10 |
| F-09-02 | v0.1.0 | 命令 | 退出码约定 | 按模块接口 §8 的退出码表；退出码只由 `BuildOutcome` 与捕获的异常决定；错误按 §8 的格式写到 stderr，每条一行；退出码的计算以构造的 `BuildOutcome` 与抛出的异常做单元测试，覆盖表中每一行；端到端用例由夹具 `invalid-config`、`usage-error`、`verify-failed`、`requires-missing`、`unknown-override` 承接 | F-09-01 |
| F-09-03 | v0.1.0 | 命令 | 帮助与版本 | `--help` 列出命令与选项；`--version` 输出包版本；两者输出到 stdout，以退出码 0 结束 | — |
| F-09-04 | v0.1.0 | 命令 | `--check` 选项 | `uapa build --check` 调用只比对模式，不写文件；比对一致且没有目标失败时以退出码 0 结束，有差异或有目标失败时以退出码 1 结束，差异按模块接口 §8 列出；stdout 只含差异行 | F-09-01, F-03-08 |
