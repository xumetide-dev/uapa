import { accessSync, constants, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
function checkBeforePrompt(value) {
	if (!isRecord$2(value)) return invalid;
	if (value.kind === "allow") return valid({ kind: "allow" });
	if (value.kind === "block" && isReason(value.reason)) return valid({
		kind: "block",
		reason: value.reason
	});
	return invalid;
}
function checkBeforeStop(value) {
	if (!isRecord$2(value)) return invalid;
	if (value.kind === "stop") return valid({ kind: "stop" });
	if (value.kind === "continue" && isReason(value.reason)) return valid({
		kind: "continue",
		reason: value.reason
	});
	return invalid;
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
function optionsFromText(declared, text) {
	return resolve(declared, (option) => {
		const raw = text(option.name);
		return raw === void 0 ? option.default : parseText(option, raw);
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
function parseText(option, raw) {
	if (option.type === "string") return raw;
	if (option.type === "boolean") {
		if (raw === "true") return true;
		if (raw === "false") return false;
		return null;
	}
	if (raw.trim() === "") return null;
	const value = Number(raw);
	return Number.isFinite(value) ? value : null;
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
function isRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasStdout(output) {
	return isRecord$1(output) && typeof output.stdout === "string";
}
function fileOf(output) {
	if (!isRecord$1(output) || !isRecord$1(output.file)) return null;
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
	if (file !== null && isRecord$1(output)) return {
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
function openStopCounter(dir, sessionId) {
	const notes = [];
	if (dir === null) notes.push("uapa: 没有插件数据目录，停机计数按 0 处理");
	const file = dir !== null && prepareDir(dir, notes) ? join(dir, `uapa-stop-${encodeURIComponent(sessionId)}.json`) : null;
	return {
		notes,
		read: () => file === null ? 0 : readCount(file, notes),
		write(continuations) {
			if (file === null) return;
			try {
				const temp = `${file}.${process.pid}.tmp`;
				writeFileSync(temp, `${JSON.stringify({ continuations })}\n`);
				renameSync(temp, file);
			} catch (error) {
				notes.push(`uapa: 停机计数写入失败: ${messageOf(error)}`);
			}
		}
	};
}
function prepareDir(dir, notes) {
	try {
		mkdirSync(dir, { recursive: true });
		accessSync(dir, constants.W_OK);
		return true;
	} catch (error) {
		notes.push(`uapa: 插件数据目录不可写，停机计数按 0 处理: ${messageOf(error)}`);
		return false;
	}
}
function readCount(file, notes) {
	let text;
	try {
		text = readFileSync(file, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return 0;
		notes.push(`uapa: 停机计数读取失败，按 0 处理: ${messageOf(error)}`);
		return 0;
	}
	const count = continuationsOf(text);
	if (count === null) notes.push(`uapa: 停机计数文件内容无效，按 0 处理: ${file}`);
	return count ?? 0;
}
function continuationsOf(text) {
	let value;
	try {
		value = JSON.parse(text);
	} catch {
		return null;
	}
	if (typeof value !== "object" || value === null) return null;
	const count = value.continuations;
	return typeof count === "number" && Number.isInteger(count) && count >= 0 ? count : null;
}
function messageOf(error) {
	return error instanceof Error ? error.message : String(error);
}
const CHECKS = {
	"before-tool": "beforeTool",
	"before-prompt": "beforePrompt",
	"before-stop": "beforeStop",
	"after-tool": "afterTool"
};
function isCheckArg(value) {
	return value !== void 0 && Object.hasOwn(CHECKS, value);
}
async function runSubprocessEntry(protocol) {
	const arg = process.argv[2];
	if (!isCheckArg(arg)) {
		const shown = arg === void 0 ? "（缺失）" : arg;
		process.stderr.write(`uapa: 检查名应为 before-tool、before-prompt、before-stop 或 after-tool，收到 ${shown}\n`);
		process.exitCode = 1;
		return;
	}
	const output = await decide(protocol, arg, readFileSync(0, "utf8"), process.env);
	if (output.stdout !== void 0) process.stdout.write(output.stdout);
	if (output.stderr !== void 0) process.stderr.write(output.stderr);
	process.exitCode = output.exitCode;
}
async function decide(protocol, check, text, env) {
	const implemented = typeof guard[CHECKS[check]] === "function";
	const unsupported = check === "before-prompt" && !_uapa_target_data_default.capabilities.promptGate || check === "after-tool" && !_uapa_target_data_default.capabilities.withholdOutput;
	if (!implemented || unsupported) return protocol.allow(check);
	let event;
	try {
		event = protocol.parse(check, parseJson(text));
	} catch (error) {
		return unparseable(protocol, check, error instanceof Error ? error.message : "stdin");
	}
	if (protocol.skip?.(event, env) === true) return protocol.allow(check);
	const context = guardContext(optionsFromText(_uapa_target_data_default.options, (name) => protocol.optionValue?.(name, env)), event.cwd ?? null);
	if (check === "before-tool") return beforeTool(protocol, event, context);
	if (check === "before-prompt") return beforePrompt(protocol, event, context);
	if (check === "after-tool") return afterTool(protocol, event, context);
	return beforeStop(protocol, event, env, context);
}
function parseJson(text) {
	try {
		return JSON.parse(text);
	} catch {
		throw new Error("stdin");
	}
}
function unparseable(protocol, check, field) {
	const reason = `uapa: 无法解析宿主输入: ${field}`;
	if (check === "before-stop") return withNote(protocol.allow(check), reason);
	if (check === "after-tool") return withhold(protocol, reason);
	return protocol.deny(check, reason);
}
function withNote(output, note) {
	return {
		...output,
		stderr: `${output.stderr ?? ""}${note}\n`
	};
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
async function beforeTool(protocol, event, context) {
	const check = "before-tool";
	const tool = event.tool;
	if (tool === void 0) return unparseable(protocol, check, "tool");
	const converted = toToolCall(event.sessionId, tool, _uapa_target_data_default.toolNames);
	if (!converted.ok) return unparseable(protocol, check, converted.field);
	const { call } = converted;
	const checked = await callGuard(context, (ctx) => guard.beforeTool?.(call, ctx), (value) => checkBeforeTool(value, call.tool));
	if (!checked.ok) return protocol.deny(check, checked.reason);
	const rewriteShell = _uapa_target_data_default.capabilities.rewriteInput ? protocol.rewriteShell : void 0;
	const decision = resolveToolDecision(checked.value, call.tool, rewriteShell !== void 0);
	if (decision.kind === "allow") return protocol.allow(check);
	if (decision.kind === "deny") return protocol.deny(check, decision.reason);
	if (rewriteShell === void 0) return protocol.deny(check, decision.fallbackReason);
	return rewriteShell.call(protocol, tool.input, decision.command);
}
async function beforePrompt(protocol, event, context) {
	const check = "before-prompt";
	const prompt = event.prompt;
	if (prompt === void 0) return unparseable(protocol, check, "prompt");
	const checked = await callGuard(context, (ctx) => guard.beforePrompt?.({
		sessionId: event.sessionId,
		prompt
	}, ctx), checkBeforePrompt);
	if (!checked.ok) return protocol.deny(check, checked.reason);
	if (checked.value.kind === "block") return protocol.deny(check, checked.value.reason);
	return protocol.allow(check);
}
async function afterTool(protocol, event, context) {
	const check = "after-tool";
	const tool = event.tool;
	if (tool === void 0) return unparseable(protocol, check, "tool");
	const output = event.toolOutput;
	if (output === void 0) return unparseable(protocol, check, "toolOutput");
	const converted = toToolCall(event.sessionId, tool, _uapa_target_data_default.toolNames);
	if (!converted.ok) return unparseable(protocol, check, converted.field);
	const { call } = converted;
	const checked = await callGuard(context, (ctx) => guard.afterTool?.(call, outputText(output), ctx), checkAfterTool);
	if (!checked.ok) return handOver(protocol, output, checked.reason);
	const decision = checked.value;
	if (decision.kind === "keep") return protocol.allow(check);
	return handOver(protocol, output, decision.kind === "replace" ? decision.text : decision.reason);
}
function handOver(protocol, output, text) {
	const replaceOutput = _uapa_target_data_default.capabilities.replaceOutput ? protocol.replaceOutput : void 0;
	const replaced = replaceOutput === void 0 ? null : replacedOutput(output, text);
	if (replaceOutput === void 0 || replaced === null) return withhold(protocol, text);
	return replaceOutput.call(protocol, replaced);
}
function withhold(protocol, text) {
	return protocol.blockOutput?.(text) ?? protocol.deny("after-tool", text);
}
async function beforeStop(protocol, event, env, context) {
	const counter = openStopCounter(protocol.dataDir(env), event.sessionId);
	const continuations = counter.read();
	const checked = await callGuard(context, (ctx) => guard.beforeStop?.({
		sessionId: event.sessionId,
		continuations
	}, ctx), checkBeforeStop);
	let output;
	if (!checked.ok) {
		counter.notes.push(checked.reason);
		output = protocol.allow("before-stop");
	} else if (checked.value.kind === "continue") {
		counter.write(continuations + 1);
		output = protocol.continueStop(checked.value.reason);
	} else {
		counter.write(0);
		output = protocol.allow("before-stop");
	}
	return counter.notes.reduce(withNote, output);
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function jsonLine(value) {
	return `${JSON.stringify(value)}\n`;
}
function hostTool(stdin) {
	if (typeof stdin.tool_name !== "string") throw new Error("tool_name");
	if (!isRecord(stdin.tool_input)) throw new Error("tool_input");
	const input = stdin.tool_input;
	const command = typeof input.command === "string" ? { command: input.command } : {};
	return {
		name: stdin.tool_name,
		input,
		...command
	};
}
await runSubprocessEntry({
	parse(check, stdin) {
		if (!isRecord(stdin) || typeof stdin.session_id !== "string") throw new Error("session_id");
		const sessionId = stdin.session_id;
		const cwd = typeof stdin.cwd === "string" && stdin.cwd !== "" ? stdin.cwd : null;
		if (check === "before-tool") return {
			sessionId,
			cwd,
			tool: hostTool(stdin)
		};
		if (check === "after-tool") {
			const tool = hostTool(stdin);
			if (!Object.hasOwn(stdin, "tool_response")) throw new Error("tool_response");
			return {
				sessionId,
				cwd,
				tool,
				toolOutput: stdin.tool_response
			};
		}
		if (check === "before-prompt") {
			if (typeof stdin.prompt !== "string") throw new Error("prompt");
			return {
				sessionId,
				cwd,
				prompt: stdin.prompt
			};
		}
		return {
			sessionId,
			cwd
		};
	},
	skip(event, env) {
		return env["UAPA_MODULE_SESSION_MERGED_GUARD"] === event.sessionId;
	},
	allow: () => ({ exitCode: 0 }),
	deny: (_check, reason) => ({
		exitCode: 2,
		stderr: `${reason}\n`
	}),
	rewriteShell: (input, command) => ({
		exitCode: 0,
		stdout: jsonLine({ hookSpecificOutput: {
			hookEventName: "PreToolUse",
			updatedInput: {
				...input,
				command
			}
		} })
	}),
	continueStop: (reason) => ({
		exitCode: 0,
		stdout: jsonLine({
			decision: "block",
			reason
		})
	}),
	replaceOutput: (output) => ({
		exitCode: 0,
		stdout: jsonLine({ hookSpecificOutput: {
			hookEventName: "PostToolUse",
			updatedToolOutput: output
		} })
	}),
	blockOutput: (text) => ({
		exitCode: 0,
		stdout: jsonLine({
			decision: "block",
			reason: text
		})
	}),
	dataDir(env) {
		const dir = env.CLAUDE_PLUGIN_DATA;
		return dir === void 0 || dir === "" ? null : dir;
	},
	optionValue: (name, env) => env[`CLAUDE_PLUGIN_OPTION_${name.toUpperCase()}`]
});
export {};
