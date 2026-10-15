// claude-code:in-process 的 hooks 模块入口（F-05-05～F-05-08、F-05-13），打包为
// hooks/uapa-guard.mjs，由生成的 hooks/register.ts 引入。事件字段与返回值依据 Mods 指南
// 「常用事件与返回值」与本地实测「hooks 模块的 tool.call」：
// - tool.call 的工具名为 e.tool，入参为 e 去掉 tool、tool_use_id 后的字段，Bash 的命令为
//   e.command；返回 { deny } 拒绝，next({ ...e, command }) 改写；
// - next 的结果中 result 的形状同命令 hooks 的 tool_response，报错时为字符串；next 之后返回
//   { ...ran, result } 替换输出，返回 { deny } 扣留；
// - prompt.submit 的提示文本为 e.text，返回 { drop } 丢弃本次输入；
// - classic.Stop 返回 { block } 时会话继续。
// 本文件不导入 node: 模块与 subprocess.ts，不引用 Node 全局，与 runtime/core 一起由
// tsconfig.runtime-core.json 检查。claude plugin validate 静态读取产物：$ 的调用写全
// （$.env.set），$.env.set 的变量名与 $.state 的引用在打包后为字面量，见下方各处说明。

import guard from 'uapa:guard'
import data from 'uapa:target-data'
import {
  type Api,
  atom,
  type ClassicEvent,
  type ClassicResult,
  type Next,
  type On,
  type PromptSubmitEvent,
  type PromptSubmitResult,
  read,
  type ToolCallEvent,
  type ToolCallResult,
  update,
} from 'claude-code'
import {
  type Checked,
  checkAfterTool,
  checkBeforePrompt,
  checkBeforeStop,
  checkBeforeTool,
  guardErrorReason,
} from '../core/decisions.ts'
import { outputText, replacedOutput } from '../core/output.ts'
import {
  type ToolCallResult as Converted,
  resolveToolDecision,
  toToolCall,
} from '../core/tools.ts'
import type { ToolCall } from '../core/types.ts'

// 处理函数自身出错（如 $.session.id() 失败）时由 .catch 作答
const HOOK_FAILED_REASON = 'uapa: hooks 模块出错'

// 停机门禁的连续继续次数（F-05-07），类型契约 types/index.d.ts 由宿主模块生成。未计划停机前
// 检查时 classic.Stop 的分支不进入打包结果，本常量随之被移除，产物中不留未声明的状态键
const stopContinuations = /* @__PURE__ */ atom(
  { plugin: __UAPA_PLUGIN_NAME__, key: 'uapaStopContinuations' },
  0,
)

// 处理函数之间共用的 $ 只经顶层函数的参数传递（Mods 指南「验证、测试与调试」）
export function register(on: On): void {
  // 去重（F-05-08）：变量名为 null 时整段不进入打包结果，产物中没有 $.env.set。
  // /clear、/resume、/branch 之后 session.start 不再触发，会话 id 若随之改变，命令 hook 不再被
  // 跳过，因此在 classic.SessionStart 上重写一次（Mods 指南「$.state 与 $.store」）
  if (__UAPA_MODULE_SESSION_ENV__ !== null) {
    on('session.start', async ($, e, next) => {
      await $.env.set(__UAPA_MODULE_SESSION_ENV__, await $.session.id())
      return next(e)
    })
    on(
      'classic.SessionStart',
      { source: ['clear', 'resume', 'fork'] },
      async ($, e, next) => {
        await $.env.set(__UAPA_MODULE_SESSION_ENV__, await $.session.id())
        return next(e)
      },
    )
  }
  // 执行前与提示提交前检查另写 .catch：未调用 next 前出错不放行（F-05-06）。处理器在重入时
  // 也会被调用，此时不能调用 $，因此只依据 next.called 作答。
  // 执行前与执行后检查共用一个 tool.call 处理函数：同一插件注册两个不带 matcher 的处理函数时
  // 模块校验失败（入口与打包接口第 2 节）。next 之后出错时，计划了执行后检查就扣留，不以
  // next(e) 重放未经检查的输出（F-04-08）
  if (__UAPA_CHECKS__.beforeTool || __UAPA_CHECKS__.afterTool) {
    on('tool.call', ($, e, next) => toolCall($, e, next)).catch((_$, e, next) => {
      if (!next.called) return { deny: HOOK_FAILED_REASON }
      return __UAPA_CHECKS__.afterTool ? { deny: HOOK_FAILED_REASON } : next(e)
    })
  }
  if (__UAPA_CHECKS__.beforePrompt) {
    on('prompt.submit', ($, e, next) => beforePrompt($, e, next)).catch(
      (_$, e, next) => (next.called ? next(e) : { drop: HOOK_FAILED_REASON }),
    )
  }
  // 停机前检查出错时不阻止结束：未写 .catch 的处理函数失败时被跳过
  if (__UAPA_CHECKS__.beforeStop) {
    on('classic.Stop', ($, e, next) => beforeStop($, e, next))
  }
}

// 守卫抛错或返回值无效时 ok 为 false，reason 按入口与打包接口第 4 节
async function callGuard<T>(
  call: () => unknown,
  check: (value: unknown) => Checked<T>,
): Promise<Checked<T>> {
  try {
    return check(await call())
  } catch (error) {
    return { ok: false, reason: guardErrorReason(error) }
  }
}

function toolCallOf(sessionId: string, e: ToolCallEvent): Converted {
  const { tool, tool_use_id: _toolUseId, ...input } = e
  const command = typeof e.command === 'string' ? { command: e.command } : {}
  return toToolCall(sessionId, { name: tool, input, ...command }, data.toolNames)
}

async function toolCall(
  $: Api,
  e: ToolCallEvent,
  next: Next<ToolCallEvent, ToolCallResult>,
): Promise<ToolCallResult> {
  const sessionId = await $.session.id()
  const converted = toolCallOf(sessionId, e)
  // 无法解析时不执行工具：执行前检查按拒绝处理，执行后检查也没有可交给守卫的调用
  if (!converted.ok) return { deny: `uapa: 无法解析宿主输入: ${converted.field}` }
  let forwarded = e
  if (__UAPA_CHECKS__.beforeTool) {
    const before = await beforeTool(converted.call, e)
    if (before.deny !== undefined) return { deny: before.deny }
    forwarded = before.forward
  }
  const ran = await next(forwarded)
  if (!__UAPA_CHECKS__.afterTool) return ran
  // 改写后执行的是新命令，执行后检查看到的调用与命令 hooks 的 tool_input 一致
  const after = forwarded === e ? converted : toolCallOf(sessionId, forwarded)
  if (!after.ok) return { deny: `uapa: 无法解析宿主输入: ${after.field}` }
  return afterTool(after.call, ran)
}

// 返回拒绝原因，或交给 next 的事件（原事件或改写后的事件）
type BeforeOutcome =
  | { readonly deny: string; readonly forward?: undefined }
  | { readonly deny?: undefined; readonly forward: ToolCallEvent }

async function beforeTool(call: ToolCall, e: ToolCallEvent): Promise<BeforeOutcome> {
  const checked = await callGuard(
    () => guard.beforeTool?.(call),
    value => checkBeforeTool(value, call.tool),
  )
  if (!checked.ok) return { deny: checked.reason }
  const decision = resolveToolDecision(
    checked.value,
    call.tool,
    data.capabilities.rewriteInput,
  )
  if (decision.kind === 'allow') return { forward: e }
  if (decision.kind === 'deny') return { deny: decision.reason }
  // Mods 指南只记载了 Bash 的 e.command，其他 shell 工具按 fallbackReason 拒绝
  if (e.tool !== 'Bash') return { deny: decision.fallbackReason }
  return { forward: { ...e, command: decision.command } }
}

// 执行后检查（F-05-13）：next 的结果含 deny 时原样返回；报错的结果（isError 为真）同样检查。
// 守卫抛错与返回值无效按扣留处理；形状不能替换的 replace 以 text 为原因扣留
async function afterTool(call: ToolCall, ran: ToolCallResult): Promise<ToolCallResult> {
  if (ran.deny !== undefined) return ran
  const checked = await callGuard(
    () => guard.afterTool?.(call, outputText(ran.result)),
    checkAfterTool,
  )
  if (!checked.ok) return { deny: checked.reason }
  const decision = checked.value
  if (decision.kind === 'keep') return ran
  if (decision.kind === 'withhold') return { deny: decision.reason }
  const result = data.capabilities.replaceOutput
    ? replacedOutput(ran.result, decision.text)
    : null
  return result === null ? { deny: decision.text } : { ...ran, result }
}

async function beforePrompt(
  $: Api,
  e: PromptSubmitEvent,
  next: Next<PromptSubmitEvent, PromptSubmitResult>,
): Promise<PromptSubmitResult> {
  const prompt = e.text
  if (typeof prompt !== 'string') return { drop: 'uapa: 无法解析宿主输入: text' }
  const sessionId = await $.session.id()
  const checked = await callGuard(
    () => guard.beforePrompt?.({ sessionId, prompt }),
    checkBeforePrompt,
  )
  if (!checked.ok) return { drop: checked.reason }
  if (checked.value.kind === 'block') return { drop: checked.value.reason }
  return next(e)
}

// 计数规则与子进程入口相同（F-04-05）：continue 加 1，stop 清零，守卫出错时不变
async function beforeStop(
  $: Api,
  e: ClassicEvent,
  next: Next<ClassicEvent, ClassicResult>,
): Promise<ClassicResult> {
  const sessionId = await $.session.id()
  const continuations = await read($, stopContinuations)
  const checked = await callGuard(
    () => guard.beforeStop?.({ sessionId, continuations }),
    checkBeforeStop,
  )
  if (!checked.ok) return next(e)
  if (checked.value.kind === 'continue') {
    await update($, stopContinuations, current => current + 1)
    return { block: checked.value.reason }
  }
  await update($, stopContinuations, () => 0)
  return next(e)
}
