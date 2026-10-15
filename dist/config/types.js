// 命令 hooks 声明的事件（命令 hooks 声明第 1 节，F-01-09）
export const COMMAND_HOOK_EVENTS = [
    'SessionStart',
    'SessionEnd',
    'UserPromptSubmit',
    'PreToolUse',
    'PostToolUse',
    'Stop',
];
export function defineConfig(config) {
    return config;
}
