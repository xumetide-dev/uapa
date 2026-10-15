import type { UapaConfig } from 'uapa'

export default {
  name: 'filter-demo',
  version: '0.1.0',
  description: '按 frontmatter 限定 skill 的目标并以覆盖文件替换生成文件的夹具',
  author: { name: 'UAPA Fixtures' },
  targets: [
    'claude-code:in-process',
    'claude-code:subprocess',
    'codex:subprocess',
    'agy:subprocess',
  ],
} satisfies UapaConfig
