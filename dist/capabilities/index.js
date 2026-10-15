import { agySubprocess } from './agy-subprocess.js';
import { claudeCodeInProcess } from './claude-code-in-process.js';
import { claudeCodeSubprocess } from './claude-code-subprocess.js';
import { codexSubprocess } from './codex-subprocess.js';
export const targetCapabilities = {
    'claude-code:in-process': claudeCodeInProcess,
    'claude-code:subprocess': claudeCodeSubprocess,
    'codex:subprocess': codexSubprocess,
    'agy:subprocess': agySubprocess,
};
