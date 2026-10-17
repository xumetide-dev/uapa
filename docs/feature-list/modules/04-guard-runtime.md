# 04 守卫运行时

打包进产物、在宿主中运行的代码中与宿主无关的部分，以及打包本身。代码位于
`src/runtime/core/`（`types.ts` 属于[守卫接口](02-guard-api.md)）、
`src/runtime/entries/subprocess.ts` 与 `src/bundle/`。`runtime/core` 不做 I/O、不引用 Node 类型。
各宿主的输入字段与决策输出属于宿主功能模块（05～08、11），代码写在
`src/runtime/entries/<宿主>-<形态>.ts`，不写在 `src/targets/`：后者是构建器代码，不打包进产物。
公共部分与宿主部分之间的 `SubprocessProtocol`、打包请求与入口文件名见
[入口与打包接口](../../architecture/runtime-interfaces.md)。本模块的单元测试使用 `test/` 下的
最小入口，不依赖宿主功能模块的入口源码。

| 编号 | 阶段 | 子模块 | 功能名称 | 验收标准 | 依赖 |
|---|---|---|---|---|---|
| F-04-01 | v0.1.0 | 换算 | 工具名换算 | 换算函数以 `ToolNameMap`（宿主工具名到规范名，类型见 F-02-01）为参数，不引用 `src/capabilities/`；未映射的工具以 `host:<原名>` 传入；规范名为 `shell` 时入参换算为 `{ command }`，命令文本缺失时按输入无法解析处理（入口与打包接口第 3 节） | F-02-01 |
| F-04-02 | v0.1.0 | 换算 | 入参改写的反向换算与降级 | `rewrite` 只对 `shell` 生效：由宿主实现的 `rewriteShell` 复制原始入参并只替换命令字段；对其他工具返回 `rewrite`，或 `TargetRuntimeData.capabilities.rewriteInput` 为 `false` 时，按 `fallbackReason` 拒绝，不放行原始入参 | F-04-01 |
| F-04-03 | v0.1.0 | 子进程入口 | 读取宿主输入 | 检查名由命令行第一个参数传入（`before-tool`、`before-prompt`、`before-stop`）；参数缺失或不是这三个值时，不读取 stdin，以退出码 1 结束并在 stderr 写原因；从 stdin 读取 JSON，经宿主实现的 `parse` 取出会话 id、工具名与入参，公共部分不含宿主字段名；输入无法解析时，执行前与提示提交前检查按拒绝输出，原因为 `uapa: 无法解析宿主输入: <缺失或类型不符的字段>`，停机前检查不阻止结束并在 stderr 写同一原因；宿主实现了 `skip` 且返回 `true`，或守卫未实现该检查时按放行结束，不调用守卫 | F-04-01 |
| F-04-04 | v0.1.0 | 子进程入口 | 异常收口 | 守卫逻辑抛错时原因为 `uapa: 守卫出错: <错误消息>`，返回值形状不符或原因为空白时为 `uapa: 守卫返回值无效`；执行前与提示提交前检查以该原因调用宿主实现的 `deny`；停机前检查不阻止结束，并在 stderr 写该原因；检查函数位于 `src/runtime/core/decisions.ts`（入口与打包接口第 4 节），两种形态的入口共用 | F-04-03 |
| F-04-05 | v0.1.0 | 子进程入口 | 按会话保存停机门禁计数 | `beforeStop` 返回 `continue` 时计数加 1，返回 `stop` 时清零；计数文件为宿主实现的 `dataDir` 所返回目录下的 `uapa-stop-<encodeURIComponent(会话 id)>.json`，内容为 `{"continuations":<n>}` 加换行，先写临时文件再重命名；`dataDir` 为 `null` 或目录不可写时 `continuations` 按 0 传入，并在 stderr 写原因；目录不存在时先递归创建（agy 的目录位于系统临时目录，见 SD-06） | F-04-03 |
| F-04-06 | v0.1.0 | 打包 | 打包入口 | `bundle` 按入口与打包接口第 1 节把守卫逻辑（`uapa:guard`）、目标数据（`uapa:target-data`）、`runtime/core` 与请求的入口打包为 ES2022 ESM 单文件，替换 `__UAPA_PLUGIN_NAME__`、`__UAPA_MODULE_SESSION_ENV__`；`external` 为 `'node'` 时只保留 `node:` 内置模块，出现其他外部导入时打包失败；按 `import.meta.url` 相对自身定位入口，定位方式对源码目录与 `dist/` 目录结构都成立；入口源码用到的打包时名称在 `src/runtime/entries/bundle-names.d.ts` 中声明 | F-02-01, F-02-02 |
| F-04-07 | v0.1.0 | 打包 | hooks 模块形态的打包 | `external` 为 `'claude-code'` 时，打包结果只导入 `'claude-code'`，出现 `node:` 或其他外部导入时打包失败 | F-04-06 |
| F-04-08 | v0.2.0 | 子进程入口 | 执行后检查的异常收口 | 执行后检查的输入无法解析、守卫出错或返回值无效时按扣留输出，以说明文字替换原输出（SD-29） | F-04-04, F-02-04 |
| F-04-09 | v0.3.0 | 子进程入口 | 向守卫传入选项 | `TargetRuntimeData` 增加 `options`（`GuardDeclaration.options` 中各选项的 `type` 与 `default`）；子进程入口在调用守卫前经宿主实现的 `optionValue` 取得各选项的文本：协议未实现该方法或返回 `undefined` 时取 `default`，否则按 `type` 解析（number 为有限数，boolean 只接受 `true`、`false`）；解析失败时按守卫出错处理（F-04-04、F-04-08），原因为 `uapa: 守卫选项无效: <选项名>`；取值以 `GuardContext` 传给本次调用的检查（入口与打包接口第 3 节，SD-35） | F-02-05, F-04-04, F-04-06 |
| F-04-10 | v0.4.0 | 子进程入口 | 向守卫传入工作目录 | `HostEvent` 增加可选的 `cwd`（类型为 `string` 或 `null`），由各子进程入口的 `parse` 从宿主 stdin 提取（缺失、非字符串或空串时静默退化为 `null`，不按输入无法解析抛错）；`guardContext(result, cwd)` 把 `cwd`（默认 `null`）写入 `GuardContext.cwd` 传给守卫各检查方法（SD-50） | F-04-03, F-04-09 |

