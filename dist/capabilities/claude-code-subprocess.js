const allow = { error: 'allow', timeout: 'allow' };
export const claudeCodeSubprocess = {
    target: 'claude-code:subprocess',
    host: {
        name: 'claude-code',
        version: '2.1.296',
        checked: '2026-10-14',
        source: 'claude-code-plugins.md', // TA-15 结论见 claude-code-hooks.md「命令 hooks 的本地实测」
    },
    // skills/、agents/、.mcp.json 与 hooks/hooks.json 都是插件包内的文件
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
        rewriteInput: true, // hookSpecificOutput.updatedInput
        // updatedToolOutput（v2.1.121+）：复制 tool_response 后改 stdout 或 file.content，须与
        // 工具的输出同形；工具报错时只触发 PostToolUseFailure，不能替换
        replaceOutput: true,
        withholdOutput: true, // 以 updatedToolOutput 的说明文字替换原输出；其他形状只能附加原因
        stopGate: true, // Stop 返回 decision: "block" 与 reason
        promptGate: true, // UserPromptSubmit 以退出码 2 阻断（TA-15）
    },
    // hook 进程出错或超时时放行（hooks 适配第 7 节；退出码 1 与超时放行经 TA-15 实测）；
    // PostToolUse 以 1 退出或超时时原输出保留（「执行后检查」实测）
    failureDefault: {
        beforeTool: allow,
        beforePrompt: allow,
        beforeStop: allow,
        afterTool: allow,
    },
    hookTimeoutSeconds: 30, // 条目的 timeout 字段，单位秒（TA-15）
    defaultTimeoutSeconds: 600,
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
