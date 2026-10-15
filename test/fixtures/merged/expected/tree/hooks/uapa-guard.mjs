import { atom, read, update } from "claude-code";
function shellDecision(command) {
	if (command.includes("uapa-deny-probe")) return {
		kind: "deny",
		reason: "拒绝标记命令 uapa-deny-probe"
	};
	if (command.startsWith("echo uapa-rewrite-probe ")) return {
		kind: "rewrite",
		input: { command: command.replace("uapa-rewrite-probe ", "uapa-rewritten ") },
		fallbackReason: "请改用 echo uapa-rewritten"
	};
	return { kind: "allow" };
}
const guard = {
	name: "fixture-guard",
	requires: [],
	beforeTool: (call) => call.tool === "shell" ? shellDecision(String(call.input.command)) : { kind: "allow" },
	beforePrompt: (p) => p.prompt.includes("API_KEY=") ? {
		kind: "block",
		reason: "提示中含疑似密钥"
	} : { kind: "allow" },
	beforeStop: (s) => s.continuations < 2 ? {
		kind: "continue",
		reason: "请先运行测试再结束"
	} : { kind: "stop" }
};
var _uapa_target_data_default = {
	"pluginName": "merged-guard",
	"toolNames": {
		"Bash": "shell",
		"PowerShell": "shell",
		"Read": "read_file",
		"Edit": "edit_file",
		"Write": "write_file",
		"Glob": "glob",
		"Grep": "grep",
		"WebFetch": "web_fetch",
		"WebSearch": "web_search",
		"Agent": "subagent",
		"TaskCreate": "todo",
		"TaskGet": "todo",
		"TaskList": "todo",
		"TaskUpdate": "todo",
		"TodoWrite": "todo"
	},
	"capabilities": {
		"rewriteInput": true,
		"replaceOutput": true,
		"withholdOutput": true,
		"stopGate": true,
		"promptGate": true
	},
	"moduleSessionEnv": "UAPA_MODULE_SESSION_MERGED_GUARD",
	"options": []
};
const invalid = {
	ok: false,
	reason: "uapa: 守卫返回值无效"
};
function valid(value) {
	return {
		ok: true,
		value
	};
}
function isRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isReason(value) {
	return typeof value === "string" && value.trim() !== "";
}
function checkBeforeTool(value, tool) {
	if (!isRecord$1(value)) return invalid;
	if (value.kind === "allow") return valid({ kind: "allow" });
	if (value.kind === "deny") return isReason(value.reason) ? valid({
		kind: "deny",
		reason: value.reason
	}) : invalid;
	if (value.kind !== "rewrite") return invalid;
	const { input, fallbackReason } = value;
	if (!isRecord$1(input) || !isReason(fallbackReason)) return invalid;
	const command = input.command;
	if (tool === "shell" && (typeof command !== "string" || command === "")) return invalid;
	return valid({
		kind: "rewrite",
		input: { ...input },
		fallbackReason
	});
}
function checkBeforePrompt(value) {
	if (!isRecord$1(value)) return invalid;
	if (value.kind === "allow") return valid({ kind: "allow" });
	if (value.kind === "block" && isReason(value.reason)) return valid({
		kind: "block",
		reason: value.reason
	});
	return invalid;
}
function checkBeforeStop(value) {
	if (!isRecord$1(value)) return invalid;
	if (value.kind === "stop") return valid({ kind: "stop" });
	if (value.kind === "continue" && isReason(value.reason)) return valid({
		kind: "continue",
		reason: value.reason
	});
	return invalid;
}
function guardErrorReason(error) {
	return `uapa: 守卫出错: ${error instanceof Error ? error.message : String(error)}`;
}
function optionsFromValues(declared, values) {
	const given = isRecord(values) ? values : {};
	return resolve(declared, (option) => {
		const value = Object.hasOwn(given, option.name) ? given[option.name] : void 0;
		if (value === void 0) return option.default;
		return isValueOf(option, value) ? value : null;
	});
}
function resolve(declared, pick) {
	const options = {};
	for (const option of declared) {
		const value = pick(option);
		if (value === null) return {
			ok: false,
			name: option.name
		};
		options[option.name] = value;
	}
	return {
		ok: true,
		options
	};
}
function isValueOf(option, value) {
	if (typeof value !== option.type) return false;
	return typeof value !== "number" || Number.isFinite(value);
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function guardContext(result) {
	if (!result.ok) return {
		ok: false,
		reason: `uapa: 守卫选项无效: ${result.name}`
	};
	return {
		ok: true,
		value: { options: result.options }
	};
}
function canonicalToolName(hostName, toolNames) {
	return (Object.hasOwn(toolNames, hostName) ? toolNames[hostName] : void 0) ?? `host:${hostName}`;
}
function toToolCall(sessionId, tool, toolNames) {
	const name = canonicalToolName(tool.name, toolNames);
	if (name !== "shell") return {
		ok: true,
		call: {
			sessionId,
			tool: name,
			input: tool.input
		}
	};
	if (tool.command === void 0) return {
		ok: false,
		field: "tool.command"
	};
	return {
		ok: true,
		call: {
			sessionId,
			tool: name,
			input: { command: tool.command }
		}
	};
}
function resolveToolDecision(decision, tool, rewriteInput) {
	if (decision.kind !== "rewrite") return decision;
	const { command } = decision.input;
	if (tool === "shell" && rewriteInput && typeof command === "string") return {
		kind: "rewriteShell",
		command,
		fallbackReason: decision.fallbackReason
	};
	return {
		kind: "deny",
		reason: decision.fallbackReason
	};
}
const HOOK_FAILED_REASON = "uapa: hooks 模块出错";
const stopContinuations = atom({
	plugin: "merged-guard",
	key: "uapaStopContinuations"
}, 0);
function register(on, options) {
	const context = guardContext(optionsFromValues(_uapa_target_data_default.options, options));
	on("session.start", async ($, e, next) => {
		await $.env.set("UAPA_MODULE_SESSION_MERGED_GUARD", await $.session.id());
		return next(e);
	});
	on("classic.SessionStart", { source: [
		"clear",
		"resume",
		"fork"
	] }, async ($, e, next) => {
		await $.env.set("UAPA_MODULE_SESSION_MERGED_GUARD", await startedSessionId($, e));
		return next(e);
	});
	on("tool.call", ($, e, next) => toolCall($, e, next, context)).catch((_$, e, next) => {
		if (!next.called) return { deny: HOOK_FAILED_REASON };
		return next(e);
	});
	on("prompt.submit", ($, e, next) => beforePrompt($, e, next, context)).catch((_$, e, next) => next.called ? next(e) : { drop: HOOK_FAILED_REASON });
	on("classic.Stop", ($, e, next) => beforeStop($, e, next, context));
}
async function startedSessionId($, e) {
	const started = e.session_id;
	if (typeof started === "string" && started !== "") return started;
	return $.session.id();
}
async function callGuard(context, call, check) {
	if (!context.ok) return context;
	try {
		return check(await call(context.value));
	} catch (error) {
		return {
			ok: false,
			reason: guardErrorReason(error)
		};
	}
}
function toolCallOf(sessionId, e) {
	const { tool, tool_use_id: _toolUseId, ...input } = e;
	return toToolCall(sessionId, {
		name: tool,
		input,
		...typeof e.command === "string" ? { command: e.command } : {}
	}, _uapa_target_data_default.toolNames);
}
async function toolCall($, e, next, context) {
	const converted = toolCallOf(await $.session.id(), e);
	if (!converted.ok) return { deny: `uapa: 无法解析宿主输入: ${converted.field}` };
	let forwarded = e;
	{
		const before = await beforeTool(converted.call, e, context);
		if (before.deny !== void 0) return { deny: before.deny };
		forwarded = before.forward;
	}
	return await next(forwarded);
}
async function beforeTool(call, e, context) {
	const checked = await callGuard(context, (ctx) => guard.beforeTool?.(call, ctx), (value) => checkBeforeTool(value, call.tool));
	if (!checked.ok) return { deny: checked.reason };
	const decision = resolveToolDecision(checked.value, call.tool, _uapa_target_data_default.capabilities.rewriteInput);
	if (decision.kind === "allow") return { forward: e };
	if (decision.kind === "deny") return { deny: decision.reason };
	if (e.tool !== "Bash") return { deny: decision.fallbackReason };
	return { forward: {
		...e,
		command: decision.command
	} };
}
async function beforePrompt($, e, next, context) {
	const prompt = e.text;
	if (typeof prompt !== "string") return { drop: "uapa: 无法解析宿主输入: text" };
	const sessionId = await $.session.id();
	const checked = await callGuard(context, (ctx) => guard.beforePrompt?.({
		sessionId,
		prompt
	}, ctx), checkBeforePrompt);
	if (!checked.ok) return { drop: checked.reason };
	if (checked.value.kind === "block") return { drop: checked.value.reason };
	return next(e);
}
async function beforeStop($, e, next, context) {
	const sessionId = await $.session.id();
	const continuations = await read($, stopContinuations);
	const checked = await callGuard(context, (ctx) => guard.beforeStop?.({
		sessionId,
		continuations
	}, ctx), checkBeforeStop);
	if (!checked.ok) return next(e);
	if (checked.value.kind === "continue") {
		await update($, stopContinuations, (current) => current + 1);
		return { block: checked.value.reason };
	}
	await update($, stopContinuations, () => 0);
	return next(e);
}
export { register };
