import type { UapaConfig } from 'uapa'

export default {
  name: 'merged-guard',
  version: '0.1.0',
  description: '同 full；三个宿主的全部目标写入源项目根目录的夹具',
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
    agy: { dir: '.' },
  },
} satisfies UapaConfig
