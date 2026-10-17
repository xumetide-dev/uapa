# UAPA 写出、比对与退出码

本文是[模块接口](module-interfaces.md) §8 的内容：产物的放置顺序、写出、比对、退出码与命令行
调用构建的契约。宿主模块返回的文件见[宿主模块接口](host-module-interface.md)，构建报告见
[构建报告](build-report.md)。

## 写出与比对

- 默认布局：某宿主至少一个目标生成成功时，先清空该插件目录再写入；全部失败时目录保持原状。
- 合并布局：只写入生成的文件，不删除目录中的其他文件。同名文件冲突（F-03-06、F-03-07）时，
  写入该目录的全部目标失败，该目录不写入任何文件；冲突错误写明文件与冲突的宿主，生成该文件的
  宿主模块给出 `conflictHint` 时附在其后。组件删除或改名后留下的旧文件需手动删除。
- 放置顺序：宿主模块生成的文件，复制的组件（skills、agents、commands），v0.4.0 起的共用文件
  （F-03-17），最后是覆盖文件。
- 同路径冲突（v0.4.0）：生成的文件、复制的组件文件与共用文件中任意两个同路径时，写入该目录的
  全部目标失败，该目录不写入任何文件；错误写明文件与两个来源，共用文件参与时提示改用
  `overrides/<宿主>/`。插件目录是源项目根目录时，组件不复制而已在原位，生成的文件与源项目的
  组件文件同路径时同样失败。
- 共用文件（v0.4.0，F-03-17）：`files/` 中的全部文件复制到每个写出文件的插件目录，路径相对
  `files/`，不按目标筛选。插件目录是源项目根目录而 `files/` 非空时，写入该目录的全部目标失败，
  错误提示把共用文件直接放在根目录或改用默认布局：复制会在源项目根目录中写入与 `files/` 重复
  的文件，并可能覆盖同名的源文件。
- 覆盖文件：用 `overrides/<宿主>/` 中的文件覆盖或新增同名文件（F-03-12）；覆盖文件不做字段
  白名单检查。覆盖生成文件时继承该文件的合并标记，新增的覆盖文件不带标记；覆盖共用文件时，
  该文件同样记入 `overridden`。
- 宿主校验：写出后，对本次写出了文件且实现了 `verify` 的宿主模块调用（F-03-14）。`failed` 或
  `verify` 抛错时该宿主的目标失败，已写出的文件保留；`--check` 不调用。
- marketplace 文件（v0.4.0，F-03-18）：宿主校验之后，为至少一个目标成功的宿主把
  `HostResult.marketplaceFiles` 写到 `marketplace.dir`，不清空该目录，不删除其他文件。写出前
  检查：marketplace 文件与本次写入任一插件目录的文件同路径时，该宿主的目标失败，其插件目录
  不写入。该宿主每个成功目标的报告 `units` 追加 `{ kind: 'marketplace', path }`。
- 比对：`--check` 在内存中生成全部产物，与磁盘逐字节比对，不写文件。差异按路径字典序排列，
  为 `added`、`modified`，默认布局另有写入前会被清除的 `removed`；路径写法见模块接口 §2。失败的目标
  不产生 `added`、`modified`；默认布局下某宿主的目标全部失败时不比对该目录，部分失败时按成功
  目标的产物计算 `removed`，与实际构建清空后的结果一致。marketplace 文件（v0.4.0）一并比对，
  只有 `added`、`modified`。

| 退出码 | 条件 | 写文件 |
|---|---|---|
| 0 | 全部目标成功；`--check` 时另须无差异 | 构建时写出；`--check` 不写 |
| 1 | 至少一个目标失败（能力检查、宿主生成与字段检查、合并冲突、宿主校验），或 `--check` 有差异 | 成功的目标照常写出；`--check` 不写 |
| 2 | 命令行用法错误；配置加载或校验失败（F-01-02、F-01-03）；源项目读取失败（F-01-04～F-01-06）；守卫加载失败（F-02-03）；宿主模块之外的未预期异常 | 不构建任何目标，不写报告；未预期异常发生前已写出的文件保留 |

命令行与构建编排之间的调用：

```ts
// src/config/issues.ts：配置、源项目与守卫读取共用的输入错误
export interface InputIssue {
  readonly file: string | null // 相对配置文件所在目录，POSIX 分隔；没有对应文件时为 null
  // 字段路径以 . 连接，数组下标写作 [n]，如 'targets[2]'、'hosts.codex.hooksFile'
  readonly field: string | null
  readonly message: string
}
export type Loaded<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly InputIssue[] }
// src/config/load.ts（F-01-02、F-01-03）
export function loadConfig(configPath: string): Promise<Loaded<UapaConfig>>
// src/source/index.ts（F-01-04～F-01-06）与 src/source/guard.ts（F-02-03）
export function readSource(config: UapaConfig, root: string):
  Promise<Loaded<SourceProject>>
export function readGuard(config: UapaConfig, root: string):
  Promise<Loaded<GuardDeclaration | null>>
// src/build/index.ts：cli 与构建编排之间的契约；root 为配置文件所在目录的绝对路径
export interface FileChange {
  readonly change: 'added' | 'modified' | 'removed'
  readonly path: string // 写法见模块接口 §2
}
export type BuildOutcome =
  | { readonly kind: 'input-error'; readonly issues: readonly InputIssue[] }
  | { readonly kind: 'done'; readonly report: BuildReport
      readonly reportPath: string | null // 写法见模块接口 §2；--check 时为 null
      readonly changes: readonly FileChange[] | null } // 只在 --check 时非 null
export function build(
  config: UapaConfig, root: string, options: { readonly check: boolean },
): Promise<BuildOutcome>
```

- `cli` 调用 `loadConfig`，失败时以退出码 2 结束；成功后调用 `build`。`build` 先调用
  `readSource` 与 `readGuard`，任一返回 `ok: false` 时返回 `input-error`，不写任何文件。
- 退出码只由 `cli` 计算：`input-error` 为 2；`done` 时有目标 `failed` 或 `changes` 非空为 1，
  否则为 0；`build` 抛出的异常由 `cli` 捕获，按 2 处理并输出堆栈。
- stderr 每条错误一行。`InputIssue` 写作 `uapa: <file>[: <field>]: <message>`，`file` 为 `null`
  时省略该部分；目标失败时，报告中该目标的每条 `errors` 另写作 `uapa: <目标名>: <原因>`。
- stdout：`uapa build` 只写终端摘要；`uapa build --check` 只写差异行 `<change> <path>`，无差异时
  为空；`--help` 与 `--version` 输出到 stdout，以 0 结束。
