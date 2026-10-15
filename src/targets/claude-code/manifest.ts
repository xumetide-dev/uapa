// 生成 .claude-plugin/plugin.json（F-05-02）。字段与命名规则见 claude-code-plugins.md
// 「plugin.json 字段」。
import type { UapaConfig } from '../../config/types.ts'

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const RESERVED_PREFIXES = ['claude-', 'anthropic-', 'anthropics-', 'cc-plugin-']
const RESERVED_NAMES = ['claude', 'anthropic', 'claude-code', 'claude-mods']

// 其余保留名由宿主校验（F-05-09）发现
export function manifestErrors(config: UapaConfig): string[] {
  const errors: string[] = []
  const { name } = config
  if (!KEBAB_CASE.test(name)) {
    errors.push(`插件名 ${name} 不是 kebab-case：Claude Code 按路径加载时拒绝该插件`)
  }
  const prefix = RESERVED_PREFIXES.find(p => name.startsWith(p))
  if (prefix !== undefined) errors.push(`插件名 ${name} 以保留前缀 ${prefix} 开头`)
  if (RESERVED_NAMES.includes(name))
    errors.push(`插件名 ${name} 是 Claude Code 的保留名`)
  if (config.author === undefined) {
    errors.push(
      '配置未写 author：claude plugin validate --strict 把缺少 author 判为失败',
    )
  }
  return errors
}

// 键序固定；未配置的可选字段不写。types 为 hooks 模块的类型契约路径（F-05-07），
// 不生成契约时为 null，排在配置给出的字段之后
export function manifest(
  config: UapaConfig,
  types: string | null,
): Record<string, unknown> {
  const options = config.hosts?.['claude-code'] ?? {}
  const { author } = config
  return {
    ...(options.$schema === undefined ? {} : { $schema: options.$schema }),
    name: config.name,
    ...(options.displayName === undefined ? {} : { displayName: options.displayName }),
    version: config.version,
    description: config.description,
    ...(author === undefined
      ? {}
      : {
          author: {
            name: author.name,
            ...(author.email === undefined ? {} : { email: author.email }),
            ...(author.url === undefined ? {} : { url: author.url }),
          },
        }),
    ...(config.keywords === undefined ? {} : { keywords: config.keywords }),
    ...(options.dependencies === undefined
      ? {}
      : { dependencies: options.dependencies }),
    ...(options.userConfig === undefined ? {} : { userConfig: options.userConfig }),
    ...(types === null ? {} : { types }),
  }
}
