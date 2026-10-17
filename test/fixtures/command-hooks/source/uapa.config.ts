import type { UapaConfig } from 'uapa'

export default {
  name: 'hooks-demo',
  version: '0.1.0',
  description:
    '守卫只实现执行前检查，声明 SessionStart 与 SessionEnd 命令 hooks 的夹具',
  author: { name: 'UAPA Fixtures' },
  targets: [
    'claude-code:in-process',
    'claude-code:subprocess',
    'codex:subprocess',
    'agy:subprocess',
  ],
  guard: 'guard.ts',
  commandHooks: [
    {
      event: 'SessionStart',
      command: 'node "{pluginRoot}/scripts/session.mjs"',
      timeout: 10,
    },
    { event: 'SessionEnd', command: 'node "{pluginRoot}/scripts/session.mjs" end' },
  ],
} satisfies UapaConfig
