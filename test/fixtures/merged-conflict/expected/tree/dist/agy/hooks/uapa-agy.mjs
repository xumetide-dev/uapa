import { tmpdir } from "node:os";
import { join } from "node:path";
import { accessSync, constants, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
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
	"pluginName": "merged-conflict-guard",
	"toolNames": {
		"run_command": "shell",
		"view_file": "read_file",
		"replace_file_content": "edit_file",
		"multi_replace_file_content": "edit_file",
		"write_to_file": "write_file",
		"find_by_name": "glob",
		"grep_search": "grep",
		"read_url_content": "web_fetch",
		"search_web": "web_search",
		"invoke_subagent": "subagent"
	},
	"capabilities": {
		"rewriteInput": true,
		"replaceOutput": false,
		"withholdOutput": false,
		"stopGate": true,
		"promptGate": false
	},
	"moduleSessionEnv": null
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
const CHECKS = {
	"before-tool": "beforeTool",
	"before-prompt": "beforePrompt",
	"before-stop": "beforeStop"
};
function isCheckArg(value) {
	return value !== void 0 && Object.hasOwn(CHECKS, value);
}
async function runSubprocessEntry(protocol) {
	const arg = process.argv[2];
	if (!isCheckArg(arg)) {
		const shown = arg === void 0 ? "（缺失）" : arg;
		process.stderr.write(`uapa: 检查名应为 before-tool、before-prompt 或 before-stop，收到 ${shown}\n`);
		process.exitCode = 1;
		return;
	}
	const output = await decide(protocol, arg, readFileSync(0, "utf8"), process.env);
	if (output.stdout !== void 0) process.stdout.write(output.stdout);
	if (output.stderr !== void 0) process.stderr.write(output.stderr);
	process.exitCode = output.exitCode;
}
async function decide(protocol, check, text, env) {
	if (!(typeof guard[CHECKS[check]] === "function") || check === "before-prompt" && !_uapa_target_data_default.capabilities.promptGate) return protocol.allow(check);
	let event;
	try {
		event = protocol.parse(check, parseJson(text));
	} catch (error) {
		return unparseable(protocol, check, error instanceof Error ? error.message : "stdin");
	}
	if (protocol.skip?.(event, env) === true) return protocol.allow(check);
	if (check === "before-tool") return beforeTool(protocol, event);
	if (check === "before-prompt") return beforePrompt(protocol, event);
	return beforeStop(protocol, event, env);
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
	return protocol.deny(check, reason);
}
function withNote(output, note) {
	return {
		...output,
		stderr: `${output.stderr ?? ""}${note}\n`
	};
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
async function beforeTool(protocol, event) {
	const check = "before-tool";
	const tool = event.tool;
	if (tool === void 0) return unparseable(protocol, check, "tool");
	const converted = toToolCall(event.sessionId, tool, _uapa_target_data_default.toolNames);
	if (!converted.ok) return unparseable(protocol, check, converted.field);
	const { call } = converted;
	const checked = await callGuard(() => guard.beforeTool?.(call), (value) => checkBeforeTool(value, call.tool));
	if (!checked.ok) return protocol.deny(check, checked.reason);
	const rewriteShell = _uapa_target_data_default.capabilities.rewriteInput ? protocol.rewriteShell : void 0;
	const decision = resolveToolDecision(checked.value, call.tool, rewriteShell !== void 0);
	if (decision.kind === "allow") return protocol.allow(check);
	if (decision.kind === "deny") return protocol.deny(check, decision.reason);
	if (rewriteShell === void 0) return protocol.deny(check, decision.fallbackReason);
	return rewriteShell.call(protocol, tool.input, decision.command);
}
async function beforePrompt(protocol, event) {
	const check = "before-prompt";
	const prompt = event.prompt;
	if (prompt === void 0) return unparseable(protocol, check, "prompt");
	const checked = await callGuard(() => guard.beforePrompt?.({
		sessionId: event.sessionId,
		prompt
	}), checkBeforePrompt);
	if (!checked.ok) return protocol.deny(check, checked.reason);
	if (checked.value.kind === "block") return protocol.deny(check, checked.value.reason);
	return protocol.allow(check);
}
async function beforeStop(protocol, event, env) {
	const counter = openStopCounter(protocol.dataDir(env), event.sessionId);
	const continuations = counter.read();
	const checked = await callGuard(() => guard.beforeStop?.({
		sessionId: event.sessionId,
		continuations
	}), checkBeforeStop);
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
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function jsonLine(value) {
	return `${JSON.stringify(value)}\n`;
}
await runSubprocessEntry({
	parse(check, stdin) {
		if (!isRecord(stdin) || typeof stdin.conversationId !== "string") throw new Error("conversationId");
		const sessionId = stdin.conversationId;
		if (check !== "before-tool") return { sessionId };
		const call = stdin.toolCall;
		if (!isRecord(call)) throw new Error("toolCall");
		if (typeof call.name !== "string") throw new Error("toolCall.name");
		if (!isRecord(call.args)) throw new Error("toolCall.args");
		const input = call.args;
		const command = typeof input.CommandLine === "string" ? { command: input.CommandLine } : {};
		return {
			sessionId,
			tool: {
				name: call.name,
				input,
				...command
			}
		};
	},
	allow: (check) => ({
		exitCode: 0,
		stdout: jsonLine(check === "before-tool" ? { decision: "allow" } : {})
	}),
	deny: (_check, reason) => ({
		exitCode: 0,
		stdout: jsonLine({
			decision: "deny",
			reason
		})
	}),
	rewriteShell: (_input, command) => ({
		exitCode: 0,
		stdout: jsonLine({
			decision: "allow",
			overwrite: { CommandLine: command }
		})
	}),
	continueStop: (reason) => ({
		exitCode: 0,
		stdout: jsonLine({
			decision: "continue",
			reason
		})
	}),
	dataDir: () => join(tmpdir(), `uapa-${encodeURIComponent("merged-conflict-guard")}`)
});
export {};
