import type { UapaConfig } from 'uapa'

export default {
  name: 'merged-conflict-guard',
  version: '0.1.0',
  description:
    '同 merged，但 Codex 不设 hooksFile，与 Claude Code 都生成 hooks/hooks.json 的夹具',
  author: { name: 'UAPA Fixtures' },
  targets: [
    'claude-code:in-process',
    'claude-code:subprocess',
    'codex:subprocess',
    'agy:subprocess',
  ],
  guard: 'guard.ts',
  hosts: {
    'claude-code': { dir: '.' },
    codex: { dir: '.' },
  },
} satisfies UapaConfig
