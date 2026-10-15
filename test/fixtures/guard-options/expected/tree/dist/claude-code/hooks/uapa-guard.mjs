import "claude-code";
var guard_default = {
	name: "guard-options",
	requires: [],
	options: {
		maxLength: {
			type: "number",
			title: "命令长度上限",
			description: "写入拒绝原因的数值选项",
			default: 200
		},
		strict_mode: {
			type: "boolean",
			title: "严格模式",
			description: "写入拒绝原因的布尔选项",
			default: true
		},
		label: {
			type: "string",
			title: "原因前缀",
			description: "写入拒绝原因的字符串选项",
			default: "uapa-guard"
		}
	},
	beforeTool(call, ctx) {
		if (!(call.tool === "shell" ? String(call.input.command) : "").includes("uapa-deny-probe")) return { kind: "allow" };
		const { label, maxLength, strict_mode: strict } = ctx.options;
		return {
			kind: "deny",
			reason: `${label}: 拒绝标记命令 uapa-deny-probe（maxLength=${maxLength}，strict_mode=${strict}）`
		};
	}
};
var _uapa_target_data_default = {
	"pluginName": "guard-options",
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
	"moduleSessionEnv": "UAPA_MODULE_SESSION_GUARD_OPTIONS",
	"options": [
		{
			"name": "label",
			"type": "string",
			"default": "uapa-guard"
		},
		{
			"name": "maxLength",
			"type": "number",
			"default": 200
		},
		{
			"name": "strict_mode",
			"type": "boolean",
			"default": true
		}
	]
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
function register(on, options) {
	const context = guardContext(optionsFromValues(_uapa_target_data_default.options, options));
	on("session.start", async ($, e, next) => {
		await $.env.set("UAPA_MODULE_SESSION_GUARD_OPTIONS", await $.session.id());
		return next(e);
	});
	on("classic.SessionStart", { source: [
		"clear",
		"resume",
		"fork"
	] }, async ($, e, next) => {
		await $.env.set("UAPA_MODULE_SESSION_GUARD_OPTIONS", await startedSessionId($, e));
		return next(e);
	});
	on("tool.call", ($, e, next) => toolCall($, e, next, context)).catch((_$, e, next) => {
		if (!next.called) return { deny: HOOK_FAILED_REASON };
		return next(e);
	});
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
	const checked = await callGuard(context, (ctx) => guard_default.beforeTool?.(call, ctx), (value) => checkBeforeTool(value, call.tool));
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
export { register };
