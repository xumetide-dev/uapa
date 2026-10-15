// claude-code:in-process 的 hooks 模块入口（F-05-05～F-05-08），打包为 hooks/uapa-guard.mjs，
// 由生成的 hooks/register.ts 引入。事件字段与返回值依据 Mods 指南「常用事件与返回值」：
// - tool.call 的工具名为 e.tool，入参为 e 去掉 tool、tool_use_id 后的字段，Bash 的命令为
//   e.command；返回 { deny } 拒绝，next({ ...e, command }) 改写；
// - prompt.submit 的提示文本为 e.text，返回 { drop } 丢弃本次输入；
// - classic.Stop 返回 { block } 时会话继续。
// 本文件不导入 node: 模块与 subprocess.ts，不引用 Node 全局，与 runtime/core 一起由
// tsconfig.runtime-core.json 检查。claude plugin validate 静态读取产物：$ 的调用写全
// （$.env.set），$.env.set 的变量名与 $.state 的引用在打包后为字面量，见下方各处说明。
import guard from 'uapa:guard';
import data from 'uapa:target-data';
import { atom, read, update, } from 'claude-code';
import { checkBeforePrompt, checkBeforeStop, checkBeforeTool, guardErrorReason, } from '../core/decisions.js';
import { resolveToolDecision, toToolCall } from '../core/tools.js';
// 处理函数自身出错（如 $.session.id() 失败）时由 .catch 作答
const HOOK_FAILED_REASON = 'uapa: hooks 模块出错';
// 停机门禁的连续继续次数（F-05-07），类型契约 types/index.d.ts 由宿主模块生成。未计划停机前
// 检查时 classic.Stop 的分支不进入打包结果，本常量随之被移除，产物中不留未声明的状态键
const stopContinuations = /* @__PURE__ */ atom({ plugin: __UAPA_PLUGIN_NAME__, key: 'uapaStopContinuations' }, 0);
// 处理函数之间共用的 $ 只经顶层函数的参数传递（Mods 指南「验证、测试与调试」）
export function register(on) {
    // 去重（F-05-08）：变量名为 null 时整段不进入打包结果，产物中没有 $.env.set。
    // /clear、/resume、/branch 之后 session.start 不再触发，会话 id 若随之改变，命令 hook 不再被
    // 跳过，因此在 classic.SessionStart 上重写一次（Mods 指南「$.state 与 $.store」）
    if (__UAPA_MODULE_SESSION_ENV__ !== null) {
        on('session.start', async ($, e, next) => {
            await $.env.set(__UAPA_MODULE_SESSION_ENV__, await $.session.id());
            return next(e);
        });
        on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
            await $.env.set(__UAPA_MODULE_SESSION_ENV__, await $.session.id());
            return next(e);
        });
    }
    // 执行前与提示提交前检查另写 .catch：未调用 next 前出错不放行（F-05-06）。处理器在重入时
    // 也会被调用，此时不能调用 $，因此只依据 next.called 作答
    if (__UAPA_CHECKS__.beforeTool) {
        on('tool.call', ($, e, next) => beforeTool($, e, next)).catch((_$, e, next) => next.called ? next(e) : { deny: HOOK_FAILED_REASON });
    }
    if (__UAPA_CHECKS__.beforePrompt) {
        on('prompt.submit', ($, e, next) => beforePrompt($, e, next)).catch((_$, e, next) => (next.called ? next(e) : { drop: HOOK_FAILED_REASON }));
    }
    // 停机前检查出错时不阻止结束：未写 .catch 的处理函数失败时被跳过
    if (__UAPA_CHECKS__.beforeStop) {
        on('classic.Stop', ($, e, next) => beforeStop($, e, next));
    }
}
// 守卫抛错或返回值无效时 ok 为 false，reason 按入口与打包接口第 4 节
async function callGuard(call, check) {
    try {
        return check(await call());
    }
    catch (error) {
        return { ok: false, reason: guardErrorReason(error) };
    }
}
async function beforeTool($, e, next) {
    const { tool, tool_use_id: _toolUseId, ...input } = e;
    const command = typeof e.command === 'string' ? { command: e.command } : {};
    const sessionId = await $.session.id();
    const converted = toToolCall(sessionId, { name: tool, input, ...command }, data.toolNames);
    if (!converted.ok)
        return { deny: `uapa: 无法解析宿主输入: ${converted.field}` };
    const { call } = converted;
    const checked = await callGuard(() => guard.beforeTool?.(call), value => checkBeforeTool(value, call.tool));
    if (!checked.ok)
        return { deny: checked.reason };
    const decision = resolveToolDecision(checked.value, call.tool, data.capabilities.rewriteInput);
    if (decision.kind === 'allow')
        return next(e);
    if (decision.kind === 'deny')
        return { deny: decision.reason };
    // Mods 指南只记载了 Bash 的 e.command，其他 shell 工具按 fallbackReason 拒绝
    if (tool !== 'Bash')
        return { deny: decision.fallbackReason };
    return next({ ...e, command: decision.command });
}
async function beforePrompt($, e, next) {
    const prompt = e.text;
    if (typeof prompt !== 'string')
        return { drop: 'uapa: 无法解析宿主输入: text' };
    const sessionId = await $.session.id();
    const checked = await callGuard(() => guard.beforePrompt?.({ sessionId, prompt }), checkBeforePrompt);
    if (!checked.ok)
        return { drop: checked.reason };
    if (checked.value.kind === 'block')
        return { drop: checked.value.reason };
    return next(e);
}
// 计数规则与子进程入口相同（F-04-05）：continue 加 1，stop 清零，守卫出错时不变
async function beforeStop($, e, next) {
    const sessionId = await $.session.id();
    const continuations = await read($, stopContinuations);
    const checked = await callGuard(() => guard.beforeStop?.({ sessionId, continuations }), checkBeforeStop);
    if (!checked.ok)
        return next(e);
    if (checked.value.kind === 'continue') {
        await update($, stopContinuations, current => current + 1);
        return { block: checked.value.reason };
    }
    await update($, stopContinuations, () => 0);
    return next(e);
}
