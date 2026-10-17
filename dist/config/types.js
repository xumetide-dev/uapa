// hosts['claude-code'].manifest 不得含的键：UAPA 生成或依赖默认位置的字段（SD-42）
export const MANIFEST_RESERVED_KEYS = [
    'name',
    'version',
    'description',
    'author',
    'keywords',
    'displayName',
    'userConfig',
    'dependencies',
    '$schema',
    'types',
    'skills',
    'agents',
    'commands',
    'mcpServers',
];
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
