# 10 仓库工程与发布

质量检查、测试夹具、包结构与发布。代码位于 `scripts/`、`test/fixtures/`、`package.json`、
`tsconfig*.json` 与 `biome.json`。仓库不配置 CI，检查与发布都在本地运行（ARCH-001）。

| 编号 | 阶段 | 子模块 | 功能名称 | 验收标准 | 依赖 |
|---|---|---|---|---|---|
| F-10-01 | v0.1.0 | 质量检查 | 本地检查入口 | `pnpm check` 依次运行两套 `tsc` 配置、Biome、`node --test` 与功能清单关系检查，任一失败即以非零退出码结束 | — |
| F-10-02 | v0.1.0 | 测试夹具 | 目标比对夹具 | 夹具按本文「夹具」一节的目录格式组织，测试按该节的方式运行并比对；本功能交付夹具运行器、更新命令（写在 `test/fixtures/README.md` 中）与 M2 的夹具；其余夹具按夹具表「加入比对」列在对应里程碑加入，M6 前全部比对通过 | F-09-02 |
| F-10-03 | v0.1.0 | 包结构 | 包入口与安装面 | `package.json` 声明 `bin`、`exports`（写明 `types`）、`files`、`engines`，不含任何生命周期脚本；生产依赖只有 rolldown、yaml、zod | — |
| F-10-04 | v0.1.0 | 发布 | 发布脚本 | 工作区干净且检查通过后运行 TA-14，编译 `dist/`（含 `runtime/` 的编译结果与公共导出的类型声明），在 main 之上创建含 `dist/` 的发布提交并打 `vX.Y.Z` tag；不推送 | F-10-01, F-10-03 |
| F-10-05 | v0.1.0 | 发布 | 安装冒烟 | 发布脚本创建 tag 后，在临时项目中以 git 依赖指向本地仓库的该 tag 安装（不需要推送），安装命令写在发布脚本中；未放行任何构建脚本即安装成功，并能对 `full` 夹具运行 `uapa build`（入口从安装后的 `dist/` 打包；运行前把夹具配置改为以 `import { defineConfig } from 'uapa'` 包裹，覆盖值导入） | F-10-02, F-10-04 |

## 夹具

每个夹具是 `test/fixtures/<夹具>/` 下的一个目录：

- `source/`：源项目，含 `uapa.config.ts`。临时目录中无法解析 `'uapa'`，因此夹具的配置与守卫
  逻辑只以 `import type` 引用 `'uapa'`，配置写作 `export default { ... } satisfies UapaConfig`。
  含 Claude Code 目标的夹具都写 `author`（F-05-02）。
- `case.json`：命令参数与期望退出码，如 `{ "args": ["build"], "exitCode": 1 }`。
- `expected/tree/`：运行后整个源项目目录的期望内容；`expected/stdout.txt`、`expected/stderr.txt`。
- `expected/stdin/<目标名，冒号换为 ->/<用例>.json`：子进程目标的入口用例（`claude-code:in-process`
  没有入口用例），含 `args`、`stdin`、`env` 与期望的 `exitCode`、`stdout`、`stderr`；这几处文本中的
  `{dataDir}` 替换为本用例新建的临时目录。

测试把 `source/` 复制到临时目录，`PATH` 只含一个临时目录（除 `verify-failed` 外为空），以
`process.execPath` 启动 `uapa`；断言退出码，把运行后的临时目录与 `expected/tree/` 逐字节比对，
stdout、stderr 分别与期望文件比对。入口用例以 `process.execPath` 运行产物中的入口，子进程环境
只含用例的 `env`，不继承测试进程的环境变量。入口用例只描述单次调用；需要多次调用或核对状态
文件的验收（TA-05、TA-08、TA-16）写成 `node --test` 测试代码，使用同一夹具的产物。

`expected/tree/` 中的 manifest 与 hooks 配置按验收标准手写。构建报告、`expected/stdout.txt`、
`expected/stderr.txt` 与打包生成的 `.mjs` 由更新命令写入，提交前人工核对：报告的字段、取值与
条目顺序符合[构建报告](../../architecture/build-report.md)，stderr 每行符合模块接口 §8 的格式，
验收标准中逐字给出的原因与之一致；`.mjs` 的行为由入口用例验证。

| 夹具 | 内容 | 加入比对 | 承接 |
|---|---|---|---|
| `no-guard` | 只有一个 skill，不配守卫；只配置 `claude-code:subprocess` | M2 | F-03-03、F-03-04 |
| `empty` | 源项目没有 `skills/` 目录，也不配守卫；只配置 `claude-code:subprocess`；插件目录只含 manifest | M2 | F-01-04、F-03-03 |
| `invalid-config` | `targets` 为 `claude-code:subprocess` 与一个未知目标名 | M2 | TA-04、F-09-02 |
| `usage-error` | `case.json` 的 `args` 为 `["build", "--unknown"]`，期望退出码 2，不写任何文件 | M2 | F-09-02 |
| `single-claude` | 与 `full` 相同的 skills 与守卫，只配置 `claude-code:subprocess` | M3 | F-05-03、F-05-04、TA-16 |
| `verify-failed` | 同 `single-claude`；`PATH` 中放一个以退出码 1 结束的 `claude` 脚本 | M3 | F-03-14、F-05-09、F-09-02 |
| `throwing-guard` | 各检查抛出 `new Error('throwing-guard')`；配置三个子进程目标，默认布局 | M4 | TA-03 |
| `requires-missing` | 守卫 `requires: ['promptGate']`，实现 `beforeTool`、`beforePrompt` 与 `beforeStop`；配置三个子进程目标，默认布局；`agy:subprocess` 失败（宿主没有提示提交事件），报告写明缺少 `promptGate`；`claude-code:subprocess` 与 `codex:subprocess` 的结果按其能力数据中 `promptGate` 的取值 | M4 | TA-04 |
| `unknown-override` | 只配置 `claude-code:subprocess`；存在 `overrides/codex/` | M4 | F-01-06、F-09-02 |
| `in-process-only` | 只配置 `claude-code:in-process`；守卫只实现 `beforeTool`；断言 `hooks/uapa-guard.mjs` 不含 `$.env.set` | M5 | F-05-08、F-05-10 |
| `claude-both` | 与 `full` 相同的 skills 与守卫，配置两个 Claude Code 目标；入口用例含去重变量等于与不等于 `session_id` 各一例 | M5 | F-05-08、F-05-10、TA-11、TA-17 |
| `full` | skills 与守卫；守卫实现执行前（含返回 `rewrite` 的分支）、提示提交前与停机前检查，`beforeStop` 在 `continuations < 2` 时返回 `continue`，否则返回 `stop`；四个目标，默认布局 | M4、M5 之后 | US-01、US-02、F-04-02、TA-16 |
| `merged` | 同 `full`；Claude Code 的两个目标与 Codex 写入源项目根目录（`hosts['claude-code'].dir`、`hosts.codex.dir` 为 `'.'`），Codex 设 `hooksFile`；agy 使用默认目录；源项目中另有一个无关文件 | M4、M5 之后 | US-05、TA-07 |
| `merged-conflict` | 同 `merged`，但 Codex 不设 `hooksFile`，Claude Code 与 Codex 都生成 `hooks/hooks.json` | M4、M5 之后 | F-03-06、TA-07 |
| `targets-filter` | 四个目标，默认布局；一个 skill 的 frontmatter 只限定 `claude-code:in-process`，另一个只限定 `codex:subprocess`；`overrides/codex/` 中的 `.codex-plugin/plugin.json` 覆盖生成文件，另有一个 `README.md` 为新增文件 | M4、M5 之后 | F-01-05、F-03-04、F-03-12、US-04 |
| `command-hooks` | 守卫只实现 `beforeTool`；`commandHooks` 声明一条 `SessionStart`（命令为 `node "{pluginRoot}/scripts/session.mjs"`）与一条 `SessionEnd`；四个目标，默认布局 | M4、M5 之后；Codex 的 `SessionEnd` 超时自 M5-05 | F-01-09、F-03-15、F-05-15、F-06-08、F-11-06、TA-18；F-05-23、F-06-14、TA-26 |
| `after-tool` | 守卫实现 `beforeTool`（放行）与 `afterTool`，后者按输出中的标记返回 `keep`、`replace`、`withhold`、抛错或无效返回值；四个目标，默认布局；入口用例覆盖 `claude-code:subprocess` 与 `codex:subprocess` | M2-02 | F-02-04、F-04-08、F-05-13、F-06-07、TA-19 |
| `components` | 不配守卫；两个 agent，一个不写 `targets`，一个只限定 `agy:subprocess`；`mcp/servers.json` 中四个服务器：`args` 含 `{pluginRoot}` 的本地服务器、`command` 含 `{pluginRoot}` 的本地服务器、不含 `{pluginRoot}` 的本地服务器与带 `headers` 的远程服务器；四个目标，默认布局 | M2-03（agents）、M2-04（MCP 服务器） | F-01-07、F-01-08、F-05-11、F-05-12、F-06-06、F-11-07、F-11-08、TA-20 |
| `rules-commands` | 不配守卫；三条 rules（`always`、`model`、`glob` 各一，`glob` 的一条有两个模式，`model` 的一条只限定 `agy:subprocess`）与两个 commands（一个不写 `targets`，一个只限定 `claude-code:subprocess`）；四个目标，默认布局 | M4-02；换算承载自 M5-03 | F-01-10、F-01-11、F-03-16、F-05-16、F-06-09、F-11-09、TA-21；F-05-19、F-06-11、F-06-13、F-11-11、TA-26 |
| `guard-options` | 守卫声明 number、boolean、string 各一个选项，`beforeTool` 对标记命令按选项拒绝并在原因中写出取值；四个目标，默认布局；入口用例覆盖三个子进程目标的默认值、`claude-code:subprocess` 的有效与无效环境变量 | M4-04 | F-02-05、F-04-09、F-05-17、F-05-18、F-06-10、F-11-10、TA-23 |
| `host-coverage` | 守卫实现 `beforeTool` 与 `beforePrompt`；`files/scripts/server.mjs`；`mcp/servers.json` 中以 `node` 运行该脚本、声明 `envVars` 的本地服务器，与请求头含 `${…}` 的远程服务器；`hosts['claude-code']` 写 `manifest`（`homepage`、`license`）与 `onFailure: 'block'`；配置 `marketplace`；一个正文含 `$ARGUMENTS` 的命令；一个 frontmatter 含 `tools` 的 agent；四个目标，默认布局 | 自 M5-02 起按工单逐步加入 | F-01-12、F-01-13、F-01-14、F-03-17、F-03-18、F-05-20、F-05-21、F-05-24、F-06-12、F-06-13、F-06-15、F-06-16、F-11-12、F-11-14、TA-26 |
