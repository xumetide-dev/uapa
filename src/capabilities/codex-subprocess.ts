// codex:subprocess 的能力数据（F-06-01）。取值依据 hooks 适配第 4、6、7、8 节、
// 跨平台对比「工具名差异」与 Codex「源码核对（rust-v0.162.1）」（TA-15）；执行后检查、MCP
// 服务器与 agents 依据 codex-source-review.md 的同名各节；宿主升级后只改本文件。
import type { TargetCapabilities } from './types.ts'

const allow = { error: 'allow', timeout: 'allow' } as const

export const codexSubprocess: TargetCapabilities = {
  target: 'codex:subprocess',
  host: {
    name: 'codex',
    version: '0.162.1',
    checked: '2026-10-14',
    source: 'codex-plugins.md', // TA-15 结论见其「源码核对（rust-v0.162.1）」
  },
  // skills/、mcp.json 与 hooks 配置都是插件包内的文件；插件清单没有 agents 字段（源码核对）
  components: {
    skills: 'package',
    agents: 'none',
    mcp: 'package',
    hooks: 'package',
  },
  capabilities: {
    rewriteInput: true, // permissionDecision: "allow" 与 updatedInput
    replaceOutput: false, // updatedMCPToolOutput 只解析、尚未生效；没有替换为任意文本的字段
    // PostToolUse 返回 decision: "block" 与非空 reason 时以 reason 替换工具结果，只对成功的调用触发
    withholdOutput: true,
    stopGate: true, // Stop 返回 decision: "block" 与 reason
    promptGate: true, // UserPromptSubmit 以退出码 2 阻断，不调用模型（TA-15；0.162.1 容器实测）
  },
  // 非 0 非 2 的退出码、超时、启动失败与无效输出都记为 hook 失败并放行（TA-15）；
  // PostToolUse 失败时原输出保留（源码核对「PostToolUse」）。退出码 1、超时与 PreToolUse、
  // PostToolUse 的无效输出于 0.162.1 容器实测（codex-plugins.md「容器实测（0.162.1）」）
  failureDefault: {
    beforeTool: allow,
    beforePrompt: allow,
    beforeStop: allow,
    afterTool: allow,
  },
  hookTimeoutSeconds: 30, // 处理器的 timeout 字段，单位秒（TA-15）
  defaultTimeoutSeconds: 600,
  // 读文件、按模式找文件、内容搜索与抓取网页没有独立工具；网络搜索不触发 hook
  toolNames: {
    Bash: 'shell',
    apply_patch: 'edit_file', // 编辑与新建合为一个工具（hooks 适配第 3 节）
    spawn_agent: 'subagent',
    update_plan: 'todo',
  },
  // 六个事件均为同名宿主事件（command-hooks.md 第 2 节）
  commandHookEvents: {
    SessionStart: 'SessionStart',
    SessionEnd: 'SessionEnd',
    UserPromptSubmit: 'UserPromptSubmit',
    PreToolUse: 'PreToolUse',
    PostToolUse: 'PostToolUse',
    Stop: 'Stop',
  },
}
