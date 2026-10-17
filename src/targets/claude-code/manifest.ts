// 生成 .claude-plugin/plugin.json（F-05-02、F-05-20、F-05-25）。字段与命名规则见
// claude-code-plugins.md「plugin.json 字段」。
import type { UapaConfig } from '../../config/types.ts'
import type { GuardOptionDecl } from '../../source/guard.ts'

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
// 以 - 分隔的任一段为保留词，或以保留前缀开头时，claude plugin validate --strict 拒绝该名称；
// 按段检查同时覆盖了以 claude- 等开头与等于 claude-code 等保留名的情形
const RESERVED_SEGMENTS = ['claude', 'anthropic', 'anthropics']
const RESERVED_PREFIX = 'cc-plugin-'

// 其余保留名由宿主校验（F-05-09）发现
export function manifestErrors(config: UapaConfig): string[] {
  const errors: string[] = []
  const { name } = config
  if (!KEBAB_CASE.test(name)) {
    errors.push(`插件名 ${name} 不是 kebab-case：Claude Code 按路径加载时拒绝该插件`)
  }
  const segment = name.split('-').find(s => RESERVED_SEGMENTS.includes(s))
  if (segment !== undefined) {
    errors.push(
      `插件名 ${name} 含保留段 ${segment}：claude plugin validate --strict 拒绝该名称`,
    )
  }
  if (name.startsWith(RESERVED_PREFIX)) {
    errors.push(
      `插件名 ${name} 以保留前缀 ${RESERVED_PREFIX} 开头：claude plugin validate --strict ` +
        '拒绝该名称',
    )
  }
  if (config.author === undefined) {
    errors.push(
      '配置未写 author：claude plugin validate --strict 把缺少 author 判为失败',
    )
  }
  return errors
}

export type UserConfigResult =
  | { readonly ok: true; readonly value: unknown } // undefined 时不写 userConfig
  | { readonly ok: false; readonly errors: readonly string[] }

// userConfig（F-05-17）：先写 hosts['claude-code'].userConfig 的选项，再按选项名写守卫选项。
// 宿主以选项名的全大写作环境变量名，因此全大写后相同的键视为重名
export function userConfig(
  config: UapaConfig,
  guardOptions: readonly GuardOptionDecl[],
): UserConfigResult {
  const own = config.hosts?.['claude-code']?.userConfig
  if (guardOptions.length === 0) return { ok: true, value: own }
  if (own !== undefined && !isRecord(own)) {
    return {
      ok: false,
      errors: ["hosts['claude-code'].userConfig 不是对象，不能写入守卫选项"],
    }
  }
  const ownKeys = Object.keys(own ?? {})
  const errors = guardOptions.flatMap(option => {
    const same = ownKeys.find(key => key.toUpperCase() === option.name.toUpperCase())
    if (same === undefined) return []
    return [
      `hosts['claude-code'].userConfig 的 ${same} 与守卫选项 ${option.name} 全大写后相同`,
    ]
  })
  if (errors.length > 0) return { ok: false, errors }
  const written = guardOptions.map(option => [
    option.name,
    {
      type: option.type,
      title: option.title,
      description: option.description,
      default: option.default,
    },
  ])
  return { ok: true, value: { ...own, ...Object.fromEntries(written) } }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// 键序固定；未配置的可选字段不写。types 为 hooks 模块的类型契约路径（F-05-07），
// 不生成契约时为 null，排在配置给出的字段之后；userConfig 取 userConfig() 的结果。
// hosts['claude-code'].manifest 的字段按写入顺序追加在最后（F-05-20）；保留键已由配置校验拒绝
export function manifest(
  config: UapaConfig,
  types: string | null,
  userConfigValue: unknown,
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
    ...(userConfigValue === undefined ? {} : { userConfig: userConfigValue }),
    ...(types === null ? {} : { types }),
    ...options.manifest,
  }
}
