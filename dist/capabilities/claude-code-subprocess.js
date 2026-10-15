const allow = { error: 'allow', timeout: 'allow' };
export const claudeCodeSubprocess = {
    target: 'claude-code:subprocess',
    host: {
        name: 'claude-code',
        version: '2.1.296',
        checked: '2026-10-14',
        source: 'claude-code-plugins.md', // TA-15 结论见其「命令 hooks 的本地实测」
    },
    // skills/、agents/、.mcp.json 与 hooks/hooks.json 都是插件包内的文件
    components: {
        skills: 'package',
        agents: 'package',
        mcp: 'package',
        hooks: 'package',
    },
    capabilities: {
        rewriteInput: true, // hookSpecificOutput.updatedInput
        replaceOutput: true, // updatedToolOutput（v2.1.121+）
        withholdOutput: true, // 以 updatedToolOutput 的说明文字替换原输出
        stopGate: true, // Stop 返回 decision: "block" 与 reason
        promptGate: true, // UserPromptSubmit 以退出码 2 阻断（TA-15）
    },
    // hook 进程出错或超时时放行（hooks 适配第 7 节；退出码 1 与超时放行经 TA-15 实测）
    failureDefault: { beforeTool: allow, beforePrompt: allow, beforeStop: allow },
    hookTimeoutSeconds: 30, // 条目的 timeout 字段，单位秒（TA-15）
    defaultTimeoutSeconds: 600,
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
    // 六个事件均为同名宿主事件（command-hooks.md 第 2 节）
    commandHookEvents: {
        SessionStart: 'SessionStart',
        SessionEnd: 'SessionEnd', // 2.1.296 本地实测，-p 模式也触发
        UserPromptSubmit: 'UserPromptSubmit',
        PreToolUse: 'PreToolUse',
        PostToolUse: 'PostToolUse',
        Stop: 'Stop',
    },
};
