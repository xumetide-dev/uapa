// agy:subprocess 的能力数据（F-11-01）。取值依据 hooks 适配第 4、6、7、8 节、
// 跨平台对比「工具名差异」与 agy「本地实测」（1.3.4）；agents 与 MCP 服务器另于 1.3.5 实测，
// 见其「agents 与 MCP 服务器（1.3.5，容器）」；宿主升级后只改本文件。
import type { TargetCapabilities } from './types.ts'

export const agySubprocess: TargetCapabilities = {
  target: 'agy:subprocess',
  host: {
    name: 'agy',
    version: '1.3.4',
    checked: '2026-10-14',
    source: 'agy-plugins.md', // 文档未写明的行为见其「本地实测」
  },
  // skills/、agents/、mcp_config.json 与根 hooks.json 都是插件包内的文件
  components: {
    skills: 'package',
    agents: 'package',
    mcp: 'package',
    hooks: 'package',
  },
  capabilities: {
    rewriteInput: true, // PreToolUse 的 overwrite，按键浅合并进 toolCall.args
    replaceOutput: false, // PostToolUse 只能返回 {}，不能替换输出
    withholdOutput: false, // PostToolUse 的 stdin 不含输出，不能扣留
    stopGate: true, // Stop 返回 decision: "continue" 与 reason（本地实测）
    promptGate: false, // 宿主没有提示提交事件
  },
  failureDefault: {
    // PreToolUse 出错、超时或 stdout 不是 JSON 时阻断（本地实测）
    beforeTool: { error: 'deny', timeout: 'deny' },
    beforePrompt: { error: 'allow', timeout: 'allow' }, // 宿主没有该事件
    // Stop 出错、超时与输出无法解析时本轮照常结束（本地实测；超时与无效输出于 1.3.5 实测）
    beforeStop: { error: 'allow', timeout: 'allow' },
    // 宿主不能阻断或替换输出，不生成执行后 hook（SD-29）
    afterTool: { error: 'allow', timeout: 'allow' },
  },
  hookTimeoutSeconds: 30, // 处理器的 timeout 字段，单位秒（本地实测生效）
  defaultTimeoutSeconds: 30,
  // 待办工具未查到，不列入
  toolNames: {
    run_command: 'shell',
    view_file: 'read_file',
    replace_file_content: 'edit_file',
    multi_replace_file_content: 'edit_file',
    write_to_file: 'write_file',
    find_by_name: 'glob',
    grep_search: 'grep',
    read_url_content: 'web_fetch',
    search_web: 'web_search',
    invoke_subagent: 'subagent',
  },
  // 宿主没有会话结束与提示提交事件（command-hooks.md 第 2 节）
  commandHookEvents: {
    SessionStart: 'SessionStart',
    SessionEnd: null,
    UserPromptSubmit: null,
    PreToolUse: 'PreToolUse',
    PostToolUse: 'PostToolUse',
    Stop: 'Stop',
  },
}
