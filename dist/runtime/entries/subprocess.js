// 子进程入口的公共部分（入口与打包接口第 3 节，F-04-03～F-04-05、F-04-08、F-04-09）：
// 读取参数与 stdin、工具名换算、选项取值、调用守卫与异常收口；停机计数见 stop-counter.ts。
// 宿主字段名与输出格式只出现在各目标的 <宿主>-subprocess.ts 协议实现中。
import { readFileSync } from 'node:fs';
import guard from 'uapa:guard';
import data from 'uapa:target-data';
import { checkAfterTool, checkBeforePrompt, checkBeforeStop, checkBeforeTool, guardErrorReason, } from '../core/decisions.js';
import { guardContext, optionsFromText } from '../core/options.js';
import { outputText, replacedOutput } from '../core/output.js';
import { resolveToolDecision, toToolCall } from '../core/tools.js';
import { openStopCounter } from './stop-counter.js';
const CHECKS = {
    'before-tool': 'beforeTool',
    'before-prompt': 'beforePrompt',
    'before-stop': 'beforeStop',
    'after-tool': 'afterTool',
};
function isCheckArg(value) {
    return value !== undefined && Object.hasOwn(CHECKS, value);
}
export async function runSubprocessEntry(protocol) {
    const arg = process.argv[2];
    // 参数无效时不读取 stdin，由宿主按 failureDefault 处理退出码 1
    if (!isCheckArg(arg)) {
        const shown = arg === undefined ? '（缺失）' : arg;
        process.stderr.write(`uapa: 检查名应为 before-tool、before-prompt、before-stop 或 after-tool，收到 ${shown}\n`);
        process.exitCode = 1;
        return;
    }
    const output = await decide(protocol, arg, readFileSync(0, 'utf8'), process.env);
    if (output.stdout !== undefined)
        process.stdout.write(output.stdout);
    if (output.stderr !== undefined)
        process.stderr.write(output.stderr);
    process.exitCode = output.exitCode;
}
async function decide(protocol, check, text, env) {
    // 守卫未实现该检查，或目标不支持提示提交前检查、不能扣留输出时放行，不调用守卫
    const implemented = typeof guard[CHECKS[check]] === 'function';
    const unsupported = (check === 'before-prompt' && !data.capabilities.promptGate) ||
        (check === 'after-tool' && !data.capabilities.withholdOutput);
    if (!implemented || unsupported)
        return protocol.allow(check);
    let event;
    try {
        event = protocol.parse(check, parseJson(text));
    }
    catch (error) {
        return unparseable(protocol, check, error instanceof Error ? error.message : 'stdin');
    }
    if (protocol.skip?.(event, env) === true)
        return protocol.allow(check);
    const context = guardContext(optionsFromText(data.options, name => protocol.optionValue?.(name, env)));
    if (check === 'before-tool')
        return beforeTool(protocol, event, context);
    if (check === 'before-prompt')
        return beforePrompt(protocol, event, context);
    if (check === 'after-tool')
        return afterTool(protocol, event, context);
    return beforeStop(protocol, event, env, context);
}
function parseJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        throw new Error('stdin');
    }
}
// 执行前与提示提交前检查拒绝；停机前检查不阻止结束，在 stderr 写同一原因；
// 执行后检查没有可替换的原值，按扣留写出
function unparseable(protocol, check, field) {
    const reason = `uapa: 无法解析宿主输入: ${field}`;
    if (check === 'before-stop')
        return withNote(protocol.allow(check), reason);
    if (check === 'after-tool')
        return withhold(protocol, reason);
    return protocol.deny(check, reason);
}
function withNote(output, note) {
    return { ...output, stderr: `${output.stderr ?? ''}${note}\n` };
}
// 守卫抛错或返回值无效时 ok 为 false，reason 按入口与打包接口第 4 节；
// 选项取值无效时不调用守卫，按守卫出错处理（F-04-09）
async function callGuard(context, call, check) {
    if (!context.ok)
        return context;
    try {
        return check(await call(context.value));
    }
    catch (error) {
        return { ok: false, reason: guardErrorReason(error) };
    }
}
async function beforeTool(protocol, event, context) {
    const check = 'before-tool';
    const tool = event.tool;
    if (tool === undefined)
        return unparseable(protocol, check, 'tool');
    const converted = toToolCall(event.sessionId, tool, data.toolNames);
    if (!converted.ok)
        return unparseable(protocol, check, converted.field);
    const { call } = converted;
    const checked = await callGuard(context, ctx => guard.beforeTool?.(call, ctx), value => checkBeforeTool(value, call.tool));
    if (!checked.ok)
        return protocol.deny(check, checked.reason);
    const rewriteShell = data.capabilities.rewriteInput
        ? protocol.rewriteShell
        : undefined;
    const decision = resolveToolDecision(checked.value, call.tool, rewriteShell !== undefined);
    if (decision.kind === 'allow')
        return protocol.allow(check);
    if (decision.kind === 'deny')
        return protocol.deny(check, decision.reason);
    // resolveToolDecision 只在 rewriteShell 存在时返回 rewriteShell；否则按 fallbackReason 拒绝
    if (rewriteShell === undefined)
        return protocol.deny(check, decision.fallbackReason);
    return rewriteShell.call(protocol, tool.input, decision.command);
}
async function beforePrompt(protocol, event, context) {
    const check = 'before-prompt';
    const prompt = event.prompt;
    if (prompt === undefined)
        return unparseable(protocol, check, 'prompt');
    const checked = await callGuard(context, ctx => guard.beforePrompt?.({ sessionId: event.sessionId, prompt }, ctx), checkBeforePrompt);
    if (!checked.ok)
        return protocol.deny(check, checked.reason);
    if (checked.value.kind === 'block')
        return protocol.deny(check, checked.value.reason);
    return protocol.allow(check);
}
// 执行后检查（SD-29）：守卫抛错与返回值无效也交出原因，与 withhold 相同
async function afterTool(protocol, event, context) {
    const check = 'after-tool';
    const tool = event.tool;
    if (tool === undefined)
        return unparseable(protocol, check, 'tool');
    // JSON 中没有 undefined，undefined 只表示 parse 未取到输出
    const output = event.toolOutput;
    if (output === undefined)
        return unparseable(protocol, check, 'toolOutput');
    const converted = toToolCall(event.sessionId, tool, data.toolNames);
    if (!converted.ok)
        return unparseable(protocol, check, converted.field);
    const { call } = converted;
    const checked = await callGuard(context, ctx => guard.afterTool?.(call, outputText(output), ctx), checkAfterTool);
    if (!checked.ok)
        return handOver(protocol, output, checked.reason);
    const decision = checked.value;
    if (decision.kind === 'keep')
        return protocol.allow(check);
    const text = decision.kind === 'replace' ? decision.text : decision.reason;
    return handOver(protocol, output, text);
}
// 输出形状能替换且目标能替换时以 text 替换输出，否则按扣留写出（replace 的降级）
function handOver(protocol, output, text) {
    const replaceOutput = data.capabilities.replaceOutput
        ? protocol.replaceOutput
        : undefined;
    const replaced = replaceOutput === undefined ? null : replacedOutput(output, text);
    if (replaceOutput === undefined || replaced === null)
        return withhold(protocol, text);
    return replaceOutput.call(protocol, replaced);
}
// decide 只在 withholdOutput 为 true 时进入执行后检查，这类目标都实现 blockOutput；
// 未实现时退回 deny，不放行
function withhold(protocol, text) {
    return protocol.blockOutput?.(text) ?? protocol.deny('after-tool', text);
}
async function beforeStop(protocol, event, env, context) {
    const counter = openStopCounter(protocol.dataDir(env), event.sessionId);
    const continuations = counter.read();
    const checked = await callGuard(context, ctx => guard.beforeStop?.({ sessionId: event.sessionId, continuations }, ctx), checkBeforeStop);
    let output;
    if (!checked.ok) {
        // 守卫出错不阻止结束，计数保持不变
        counter.notes.push(checked.reason);
        output = protocol.allow('before-stop');
    }
    else if (checked.value.kind === 'continue') {
        counter.write(continuations + 1);
        output = protocol.continueStop(checked.value.reason);
    }
    else {
        counter.write(0);
        output = protocol.allow('before-stop');
    }
    return counter.notes.reduce(withNote, output);
}
