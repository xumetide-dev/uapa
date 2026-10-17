# 验收 M5-01：v0.4.0 宿主事实与接口定稿

> 本文记录 M5-01 的验收结论与可复跑的证据：做完了没有、证据是什么、欠了什么。
> 施工方法见对应施工单；判准、状态、结论与判断范围的取值见[验收记录说明](README.md)。

| 项 | 内容 |
|---|---|
| 对应工单 | [M5-01](../workorders/M5-01-v0-4-0-host-facts-and-interfaces.md) |
| 覆盖功能点 | 无（取自总览「工单构成」表） |
| 验收日期 | 2026-10-15 |
| 验收结论 | 通过 |
| 判断范围 | 宿主实测 |
| commit | `0cbe6cb`、`745ab8e` |

## 0. 一票否决核对

> 任一项为「是」时本单判「不通过」，不得记为技术债或有条件通过。「本单是否发现」只填
> **是** 或 **否**；填「否」也要给证据。

| # | 一票否决项 | 本单是否发现 | 证据 |
|---|---|---|---|
| V1 | 守卫在能力缺失、守卫出错或输入无法解析时放行执行前检查，且构建报告未写明 | 否 | `git diff 628f1e8 0cbe6cb -- src` 除能力数据的 `version`、`checked` 与注释外没有改动；守卫与入口未改 |
| V2 | 插件产物导入 npm 包或依赖 UAPA 运行时 | 否 | 同上，打包与入口未改；`run.sh check` 的入口与打包用例通过 |
| V3 | 构建写入插件目录与构建报告之外的文件，或 `--check` 写入文件 | 否 | 写出与 `--check` 未改；夹具比对用例通过 |
| V4 | 能力数据含无出处的宿主行为 | 否 | `agy-subprocess.ts` 的 `source` 指向 `agy-plugins.md`，注释指向 `agy-local-tests.md` 的 1.3.5 小节；用例「宿主版本、核对日期与出处」通过 |

## 1. 验收要点逐条

> 「实际」列写实测到的数量与输出，不写“符合预期”；填不出证据标 ⏳。施工单「硬约束核对」中
> 填「是」的行带成本表的判定条目。

| # | 判定条目 | 预期 | 实际 | 证据 | 状态 |
|---|---|---|---|---|---|
| 1 | 硬约束：能力数据有出处 | `agy-subprocess.ts` 的 `host.version` 改为 1.3.5，`host.checked` 改为实测日期，注释指向 1.3.5 的调研小节；TA-09 的测试照常通过 | `version: '1.3.5'`、`checked: '2026-10-15'`；`ok 56 - 宿主版本、核对日期与出处` | `src/capabilities/agy-subprocess.ts`；`test/capabilities/capabilities.test.ts` | ✅ |
| 2 | TA-25 第 1～5 项（Claude Code） | 每项结论连同宿主版本写入调研文档 | 2.1.296 容器：`Monitor` 入参键为 `command`、`description`、`timeout_ms`，`NotebookEdit` 为 `notebook_path`、`cell_id`、`new_source`、`edit_mode`；MCP 服务器 `env=present`，cwd 为会话目录；`SessionStart` 纯文本进入上下文（回复 `heliotrope`）；`user-invocable: false` 的技能经 Skill 调用、不在斜杠列表；`paths` 技能在 `.txt` 对照中同样被调用（回复 `NONE`），自动加载与模型调用无法区分；`./uapa-probe` 与 `"./"` 两种 `source` 都能添加并安装；`onFailure: "block"` 时标记命令被阻断，不写时照常运行 | [Claude Code 本地实测「v0.4.0 覆盖审查（2.1.296，容器）」](../research/coding-agent-plugin-manifests/claude-code-local-tests.md#v040-覆盖审查21296容器)（宿主实测） | ✅ |
| 3 | TA-25 第 6～9 项（agy） | 同上 | 1.3.5 容器：安装时 `commands : 1 processed (converted to skills)`，`/uapa-agy-probe:raw-cmd` 返回标记；`/uapa-agy-probe:probe-cmd alpha beta` 返回 `AGY-CMD-PROBE [alpha beta]`；技能被自动选用（回复 `saffron-77`）；MCP `command` 中的 `${extensionPath}` 与 `${PLUGIN_ROOT}` 两台服务器未启动，`args` 形式的服务器 `env=present pluginRoot=true`；hook 进程 `pluginData:null`、`pluginRoot:false`；插件 agent 对话触发 PreToolUse 与 Stop；`/btw` 在 print 模式不可用（exit 2）；守卫一直返回 continue 时 Stop 被调用 11 次 | [agy 实测记录「v0.4.0 覆盖审查（1.3.5，容器）」](../research/coding-agent-plugin-manifests/agy-local-tests.md#v040-覆盖审查135容器)（宿主实测） | ✅ |
| 4 | Codex 对应项按源码核对 | 写明出处；会话实测写明待维护者确认 | `SessionStart` 纯文本输出、`env_vars`、marketplace 的字段与读取顺序、commands 的跳过条件按 rust-v0.162.1 源码写入；会话实测未做，记为待确认 | [Codex 源码核对](../research/coding-agent-plugin-manifests/codex-source-review.md) | ✅ |
| 5 | 功能清单按结论改写 | SD-38～SD-41、SD-43 已定；不成立的功能改为预留并另立 SD | 五条 SD 已定；SD-39 改为原样承载；F-11-13 改为预留并立 SD-46；`check-feature-list.mjs` 通过 | [范围决策](../feature-list/scope-decisions.md) | ✅ |
| 6 | 接口定稿 | 施工单任务 4 列出的字段与规则写入接口文档 | 模块接口 §2～§4 追加 v0.4.0 字段；§5、§8 拆为子页，补 marketplace、rules 与 commands 的生成规则、`files/` 的放置与冲突 | [宿主模块接口](../architecture/host-module-interface.md)、[构建产物](../architecture/build-output.md) | ✅ |

## 2. 功能点逐条验收

> 功能点取自总览「工单构成」表，验收要点取自功能清单模块文件的「验收标准」列。§1 与本表
> 不可互相替代。

| 功能点 | 标题 | 验收要点 | 状态 | 证据 |
|---|---|---|---|---|
| 无 | 本单不挂功能点 | 见施工单「覆盖功能点」 | — | — |

## 3. 自动化验证汇总（可复跑）

> 验收时实际执行过的命令与结果；bash 块复制自施工单「验收」节。依赖宿主或本机条件的命令
> 写明前置条件。

```bash
test/container/run.sh check
```

```bash
node scripts/check-feature-list.mjs
```

```bash
/usr/bin/python3 -I .claude/skills/doc-writing/scripts/check_links.py .
```

```bash
test/container/run.sh shell
```

| 命令 | 结果 | 前置条件 |
|---|---|---|
| `test/container/run.sh check` | ✅ tsc 与 biome 通过；296 pass / 0 fail；功能清单关系检查通过 | Docker 可用 |
| `node scripts/check-feature-list.mjs` | ✅ 129 个功能，27 条用户故事，27 项技术验收，关系检查通过 | 无 |
| `/usr/bin/python3 -I .claude/skills/doc-writing/scripts/check_links.py .` | ✅ 271 个文件，11 处坏链，均为技能模板中的占位链接，与本单之前相同 | 无 |
| `test/container/run.sh shell` | ✅ Claude Code 2.1.296 与 agy 1.3.5 的 TA-25 探测各运行一次，结果见 §1 第 2、3 行；Codex 未运行 | 容器中有 Claude 令牌与 agy 登录；Codex CLI 须维护者确认 |

## 4. 交付物

- 调研文档（`docs/research/coding-agent-plugin-manifests/`）：
  - 更正与补充：`agy-plugins.md`、`claude-code-plugins.md`、`claude-code-local-tests.md`、
    `claude-code-mods-guide.md`、`codex-plugins.md`、`codex-source-review.md`、
    `cross-platform-comparison.md`、`uapa-hook-adapters.md` §7、`README.md`。
  - 新增子页：`agy-local-tests.md`、`codex-local-tests.md`、`claude-code-hooks.md`、
    `claude-code-dual-form-dedup.md`。
- 功能清单：`scope-decisions.md`（SD-36～SD-41、SD-43、SD-46），模块 01、03、05、06、10、11，
  `stories.md`、`technical-acceptance.md`。
- 接口文档：`module-interfaces.md`，新增 `host-module-interface.md` 与 `build-output.md`，
  `runtime-interfaces.md`、`command-hooks.md`、`build-report.md`、`architecture.md`。
- 施工单：M5-00、M5-02、M5-03、M5-05、M5-07 与 `README.md` 按结论改写；M5-01～M5-07 的验收
  骨架重新生成。
- 能力数据：`src/capabilities/agy-subprocess.ts` 的版本、核对日期与注释。

## 5. 与计划的偏差

- 红线“不改 `src/`（`agy-subprocess.ts` 除外）、不改夹具”有三处越出，均不改变行为：
  - 11 个夹具的期望构建报告中 agy 的 `version` 与 `checked` 随能力数据改为 1.3.5 与
    2026-10-15：构建报告写入能力数据的宿主版本，不改则夹具比对失败。
  - `claude-code-subprocess.ts`、`codex-subprocess.ts` 与 `src/targets/agy/` 下四个文件的注释
    改为指向拆分后的子页，只改注释。
- 调研与接口文档超过 300 行的页面拆为子页（见 §4），施工单未列出这些新文件；被引用的锚点随之
  更新，历史施工单与验收只改链接。
- `docs/guide/` 下 `build-and-check.md`、`source-project.md`、`targets.md` 随版本与链接更新；
  施工单只列了 `targets.md`。
- SD-39 由“换算承载”改为原样承载：agy 1.3.5 安装时自行把 `commands/` 转换为技能，UAPA 不需
  转换。F-11-13 不成立，按施工单“结论不成立时”的规则改为预留并立 SD-46。
- M5-07 施工单加入 Claude Code 升级到 2.1.300 后的双形态去重复测（须维护者确认），见 §7。

## 6. 技术决策

| 决策 | 依据 | 回填状态 |
|---|---|---|
| agy 的 commands 原样复制到 `commands/`（SD-39） | 1.3.5 安装时转换为技能，`$ARGUMENTS` 被替换（TA-25 第 6 项） | 已写入宿主模块接口与 F-11-11 |
| F-11-13 预留，停机计数仍在系统临时目录（SD-46） | hook 进程中没有 `PLUGIN_DATA` 与 `PLUGIN_ROOT`（TA-25 第 8 项） | 已写入入口与打包接口与 F-11-13 |
| agy 的 MCP 服务器不支持 `envVars`，保留跳过 | 本地服务器继承会话环境；`command` 中的插件根变量不展开（TA-25 第 7 项） | 已写入 F-11-12 |
| rules 的 `always` 输出脚本按宿主命名为 `hooks/uapa-rules-claude-code.mjs` 与 `hooks/uapa-rules-codex.mjs`，直接生成，不打包、不导入 | 合并布局中两个宿主共用 `hooks/`，同名会冲突；脚本只输出常量文本 | 已写入入口与打包接口与宿主模块接口 |
| 放置顺序为生成文件、组件、`files/`、覆盖文件；前三者中任意两者同路径时该目录的目标失败 | 以前生成文件与组件同路径时后者静默覆盖 | 已写入构建产物，随 M5-02 实现 |
| 插件目录为源项目根目录且 `files/` 非空时，该目录的目标失败 | 避免共用文件覆盖源项目自身的文件 | 已写入构建产物，随 M5-02 实现 |
| marketplace 文件在校验之后、只为有成功目标的宿主写出；与插件目录中的文件同路径时该宿主失败；`--check` 只比对新增与修改 | marketplace 文件依赖插件目录已写出 | 已写入构建产物与宿主模块接口，随 M5-06 实现 |
| Claude Code marketplace 条目不写 `version`，顶层写 `metadata.description` | 2.1.296 上条目省略 `version` 可安装，带 `metadata.description` 时 `--strict` 无警告（TA-25 第 4 项） | 已写入 F-05-24 |
| Claude Code 本地 MCP 服务器不写 `envVars` 对应字段 | 2.1.296 的本地服务器继承会话环境（TA-25 第 2 项） | 已写入 F-05-26 |

## 7. 已知限制与技术债

| # | 限制 | 影响 | 去向 |
|---|---|---|---|
| 1 | Codex 的 `SessionStart` 纯文本输出、`env_vars` 与 marketplace 安装只按 rust-v0.162.1 源码核对，没有会话实测 | M5-03、M5-04、M5-06 的 Codex 产物以源码为依据 | [M5-07](../workorders/M5-07-v0-4-0-live-tests.md) 任务 3，须维护者确认使用 Codex CLI |
| 2 | 容器中的 Claude Code 为 2.1.296；2.1.297～2.1.300 的变化只按 CHANGELOG 写入，其中 2.1.299 起 `$.env.set` 的变化可能影响双形态去重 | F-05-08 的去重在 2.1.299 及以上未实测 | [M5-07](../workorders/M5-07-v0-4-0-live-tests.md) 任务 1，须维护者确认升级 |

## 8. 风险与下一步

- `paths` 技能的自动加载与模型按描述调用在实测中无法区分：`glob` 规则在 Claude Code 上的效果
  依赖模型选用，M5-07 用 `rules-commands` 夹具复测。
- agy 的停机继续次数上限为 10，第 11 次继续被忽略；守卫的停机检查只能要求有限次继续。
- 下一步：M5-02 共用文件与 Claude Code 的配置字段。
