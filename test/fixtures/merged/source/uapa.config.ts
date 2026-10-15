import type { UapaConfig } from 'uapa'

export default {
  name: 'merged-guard',
  version: '0.1.0',
  description: '同 full；Claude Code 的两个目标与 Codex 写入源项目根目录的夹具',
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
    codex: { dir: '.', hooksFile: 'hooks/codex-hooks.json' },
  },
} satisfies UapaConfig
