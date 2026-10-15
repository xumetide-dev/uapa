const allow = { error: 'allow', timeout: 'allow' };
export const claudeCodeInProcess = {
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
    },
    capabilities: {
        rewriteInput: true, // next({ ...e, command })，只对 Bash（F-05-05）
        replaceOutput: true, // next 之后返回 { result }
        withholdOutput: true, // next 之后返回 { deny }
        stopGate: true, // classic.Stop 返回 { block }
        promptGate: true, // prompt.submit 返回 { drop }
    },
    // 钩子抛错、返回形状不符或超出预算时被跳过，等同放行；入口的收口见 F-05-06
    failureDefault: { beforeTool: allow, beforePrompt: allow, beforeStop: allow },
    hookTimeoutSeconds: null, // 进程内运行，没有 hook 进程的超时字段
    defaultTimeoutSeconds: null,
    toolNames: {
        Bash: 'shell',
        PowerShell: 'shell',
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
};
