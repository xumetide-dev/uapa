import "claude-code";
const guard = {
	name: "tool-guard",
	requires: [],
	beforeTool: (call) => call.tool === "shell" && String(call.input.command).includes("uapa-deny-probe") ? {
		kind: "deny",
		reason: "拒绝标记命令 uapa-deny-probe"
	} : { kind: "allow" }
};
var _uapa_target_data_default = {
	"pluginName": "hooks-demo",
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
	"moduleSessionEnv": "UAPA_MODULE_SESSION_HOOKS_DEMO"
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
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isReason(value) {
	return typeof value === "string" && value.trim() !== "";
}
function checkBeforeTool(value, tool) {
	if (!isRecord(value)) return invalid;
	if (value.kind === "allow") return valid({ kind: "allow" });
	if (value.kind === "deny") return isReason(value.reason) ? valid({
		kind: "deny",
		reason: value.reason
	}) : invalid;
	if (value.kind !== "rewrite") return invalid;
	const { input, fallbackReason } = value;
	if (!isRecord(input) || !isReason(fallbackReason)) return invalid;
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
function register(on) {
	on("session.start", async ($, e, next) => {
		await $.env.set("UAPA_MODULE_SESSION_HOOKS_DEMO", await $.session.id());
		return next(e);
	});
	on("classic.SessionStart", { source: [
		"clear",
		"resume",
		"fork"
	] }, async ($, e, next) => {
		await $.env.set("UAPA_MODULE_SESSION_HOOKS_DEMO", await $.session.id());
		return next(e);
	});
	on("tool.call", ($, e, next) => toolCall($, e, next)).catch((_$, e, next) => {
		if (!next.called) return { deny: HOOK_FAILED_REASON };
		return next(e);
	});
}
async function callGuard(call, check) {
	try {
		return check(await call());
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
async function toolCall($, e, next) {
	const converted = toolCallOf(await $.session.id(), e);
	if (!converted.ok) return { deny: `uapa: 无法解析宿主输入: ${converted.field}` };
	let forwarded = e;
	{
		const before = await beforeTool(converted.call, e);
		if (before.deny !== void 0) return { deny: before.deny };
		forwarded = before.forward;
	}
	return await next(forwarded);
}
async function beforeTool(call, e) {
	const checked = await callGuard(() => guard.beforeTool?.(call), (value) => checkBeforeTool(value, call.tool));
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
