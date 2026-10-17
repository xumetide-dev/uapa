import "claude-code";
function afterDecision(output) {
	if (output.includes("uapa-throw-probe")) throw new Error("标记输出 uapa-throw-probe");
	if (output.includes("uapa-invalid-probe")) return {
		kind: "replace",
		text: " "
	};
	if (output.includes("uapa-withhold-probe")) return {
		kind: "withhold",
		reason: "扣留标记输出 uapa-withhold-probe"
	};
	if (output.includes("uapa-replace-probe")) return {
		kind: "replace",
		text: output.replaceAll("uapa-replace-probe", "uapa-replaced")
	};
	return { kind: "keep" };
}
const guard = {
	name: "after-tool-guard",
	requires: [],
	beforeTool: () => ({ kind: "allow" }),
	afterTool: (_call, output) => afterDecision(output)
};
var _uapa_target_data_default = {
	"pluginName": "after-tool-guard",
	"toolNames": {
		"Bash": "shell",
		"PowerShell": "shell",
		"Monitor": "shell",
		"NotebookEdit": "edit_file",
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
	"moduleSessionEnv": "UAPA_MODULE_SESSION_AFTER_TOOL_GUARD",
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
function isRecord$2(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isReason(value) {
	return typeof value === "string" && value.trim() !== "";
}
function checkBeforeTool(value, tool) {
	if (!isRecord$2(value)) return invalid;
	if (value.kind === "allow") return valid({ kind: "allow" });
	if (value.kind === "deny") return isReason(value.reason) ? valid({
		kind: "deny",
		reason: value.reason
	}) : invalid;
	if (value.kind !== "rewrite") return invalid;
	const { input, fallbackReason } = value;
	if (!isRecord$2(input) || !isReason(fallbackReason)) return invalid;
	const command = input.command;
	if (tool === "shell" && (typeof command !== "string" || command === "")) return invalid;
	return valid({
		kind: "rewrite",
		input: { ...input },
		fallbackReason
	});
}
function checkAfterTool(value) {
	if (!isRecord$2(value)) return invalid;
	if (value.kind === "keep") return valid({ kind: "keep" });
	if (value.kind === "replace" && isReason(value.text)) return valid({
		kind: "replace",
		text: value.text
	});
	if (value.kind === "withhold" && isReason(value.reason)) return valid({
		kind: "withhold",
		reason: value.reason
	});
	return invalid;
}
function guardErrorReason(error) {
	return `uapa: 守卫出错: ${error instanceof Error ? error.message : String(error)}`;
}
function optionsFromValues(declared, values) {
	const given = isRecord$1(values) ? values : {};
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
function isRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function guardContext(result, cwd = null) {
	if (!result.ok) return {
		ok: false,
		reason: `uapa: 守卫选项无效: ${result.name}`
	};
	return {
		ok: true,
		value: {
			options: result.options,
			cwd
		}
	};
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasStdout(output) {
	return isRecord(output) && typeof output.stdout === "string";
}
function fileOf(output) {
	if (!isRecord(output) || !isRecord(output.file)) return null;
	const file = output.file;
	return typeof file.content === "string" ? file : null;
}
function outputText(output) {
	if (typeof output === "string") return output;
	if (hasStdout(output)) {
		const stderr = output.stderr;
		return typeof stderr === "string" && stderr !== "" ? `${output.stdout}\n${stderr}` : output.stdout;
	}
	const file = fileOf(output);
	if (file !== null) return file.content;
	return JSON.stringify(output) ?? "";
}
function replacedOutput(output, text) {
	if (hasStdout(output)) return "stderr" in output ? {
		...output,
		stdout: text,
		stderr: ""
	} : {
		...output,
		stdout: text
	};
	const file = fileOf(output);
	if (file !== null && isRecord(output)) return {
		...output,
		file: {
			...file,
			content: text
		}
	};
	return null;
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
	const context = guardContext(optionsFromValues(_uapa_target_data_default.options, options), null);
	on("session.start", async ($, e, next) => {
		await $.env.set("UAPA_MODULE_SESSION_AFTER_TOOL_GUARD", await $.session.id());
		return next(e);
	});
	on("classic.SessionStart", { source: [
		"clear",
		"resume",
		"fork"
	] }, async ($, e, next) => {
		await $.env.set("UAPA_MODULE_SESSION_AFTER_TOOL_GUARD", await startedSessionId($, e));
		return next(e);
	});
	on("tool.call", ($, e, next) => toolCall($, e, next, context)).catch((_$, e, next) => {
		if (!next.called) return { deny: HOOK_FAILED_REASON };
		return { deny: HOOK_FAILED_REASON };
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
	const sessionId = await $.session.id();
	const converted = toolCallOf(sessionId, e);
	if (!converted.ok) return { deny: `uapa: 无法解析宿主输入: ${converted.field}` };
	let forwarded = e;
	{
		const before = await beforeTool(converted.call, e, context);
		if (before.deny !== void 0) return { deny: before.deny };
		forwarded = before.forward;
	}
	const ran = await next(forwarded);
	const after = forwarded === e ? converted : toolCallOf(sessionId, forwarded);
	if (!after.ok) return { deny: `uapa: 无法解析宿主输入: ${after.field}` };
	return afterTool(after.call, ran, context);
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
async function afterTool(call, ran, context) {
	if (ran.deny !== void 0) return ran;
	const checked = await callGuard(context, (ctx) => guard.afterTool?.(call, outputText(ran.result), ctx), checkAfterTool);
	if (!checked.ok) return { deny: checked.reason };
	const decision = checked.value;
	if (decision.kind === "keep") return ran;
	if (decision.kind === "withhold") return { deny: decision.reason };
	const result = _uapa_target_data_default.capabilities.replaceOutput ? replacedOutput(ran.result, decision.text) : null;
	return result === null ? { deny: decision.text } : {
		...ran,
		result
	};
}
export { register };
