// claude-code:in-process 的能力数据（F-05-14）。取值依据 hooks 适配第 4、6、8 节、
// 跨平台对比「工具名差异」与 Mods 指南（「常用事件与返回值」「失败处理与 .catch」）；执行后
// 检查与组件依据 claude-code-local-tests.md「执行后检查」「MCP 服务器与 agents」（2.1.296 实测）；
// 宿主升级后只改本文件。
import type { TargetCapabilities } from './types.ts'

const allow = { error: 'allow', timeout: 'allow' } as const

export const claudeCodeInProcess: TargetCapabilities = {
  target: 'claude-code:in-process',
  host: {
    name: 'claude-code',
    version: '2.1.296',
    checked: '2026-10-14',
    source: 'claude-code-mods-guide.md', // 两种形态并存的实测见 claude-code-local-tests.md
  },
  // 与 claude-code:subprocess 同一插件包：skills/、agents/、.mcp.json 与 hooks/hooks.json
  components: {
    skills: 'package',
    agents: 'package',
    mcp: 'package',
    hooks: 'package',
    // commands/<name>.md 以 /<插件名>:<文件名> 调用，frontmatter 中的 targets 不影响加载
    // （claude-code-local-tests.md「commands 与 userConfig」，2026-10-15 实测；UAPA 产物的
    // 复测见同文「UAPA 夹具产物」）
    commands: 'package',
    // 插件没有规则组件，插件根的 CLAUDE.md 不作为上下文加载（claude-code-plugins.md）。换算：
    // model 与 glob 规则写为 user-invocable: false 的技能，always 规则由 SessionStart 命令 hook
    // 的纯文本 stdout 加入上下文（claude-code-local-tests.md「v0.4.0 覆盖审查（2.1.296，容器）」）
    rules: 'converted',
  },
  capabilities: {
    rewriteInput: true, // next({ ...e, command })，只对 Bash（F-05-05）
    // next 之后返回改动 stdout（Bash）或 file.content（Read）的 { result }；其他形状按扣留写出
    replaceOutput: true,
    withholdOutput: true, // next 之后返回 { deny }，对全部工具与报错的结果生效
    stopGate: true, // classic.Stop 返回 { block }
    promptGate: true, // prompt.submit 返回 { drop }
  },
  // 钩子抛错、返回形状不符或超出预算时被跳过，等同放行；入口的收口见 F-05-06，执行后检查
  // 在 next 之后出错时由 .catch 扣留（F-04-08）
  failureDefault: {
    beforeTool: allow,
    beforePrompt: allow,
    beforeStop: allow,
    afterTool: allow,
  },
  hookTimeoutSeconds: null, // 进程内运行，没有 hook 进程的超时字段
  defaultTimeoutSeconds: null,
  toolNames: {
    Bash: 'shell',
    PowerShell: 'shell',
    // 入参含 command，与 Bash 相同，改写写回该键；NotebookEdit 的入参为 notebook_path、cell_id、
    // new_source、edit_mode，原样传给守卫（claude-code-local-tests.md「v0.4.0 覆盖审查（2.1.296，
    // 容器）」，F-05-22）
    Monitor: 'shell',
    NotebookEdit: 'edit_file',
    Read: 'read_file',
    Edit: 'edit_file',
    Write: 'write_file',
    Glob: 'glob',
    Grep: 'grep',
    WebFetch: 'web_fetch',
    WebSearch: 'web_search',
    Agent: 'subagent', // v2.1.63 起由 Task 改名
    TaskCreate: 'todo',
    TaskGet: 'todo',
    TaskList: 'todo',
    TaskUpdate: 'todo',
    TodoWrite: 'todo', // 默认关闭，由 TaskCreate 等取代
  },
  // hooks 模块不运行命令（command-hooks.md 第 2 节）；声明的命令由 claude-code:subprocess 写入
  commandHookEvents: {
    SessionStart: null,
    SessionEnd: null,
    UserPromptSubmit: null,
    PreToolUse: null,
    PostToolUse: null,
    Stop: null,
  },
}
