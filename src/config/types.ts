// 构建配置类型（模块接口 §2），由包入口导出。字段的校验见 validate.ts。
import type { HostName, TargetName } from './targets.ts'

interface HostDir {
  dir?: string // 该宿主的插件目录；默认 `<outDir>/<宿主>`
}

// 各宿主在 hosts 中的选项；新宿主在此加入键，缺键时 UapaConfig.hosts 的类型报错
export interface HostOptions {
  'claude-code': HostDir & {
    displayName?: string
    // 守卫声明了选项时须为对象，守卫选项按选项名追加在其后（F-05-17）
    userConfig?: unknown
    dependencies?: unknown
    $schema?: string
    // 按写入顺序追加在生成的字段之后；不得含 MANIFEST_RESERVED_KEYS（F-05-20，SD-42）
    manifest?: Readonly<Record<string, unknown>>
    // 守卫条目写 onFailure: "block"，入口无法启动时阻断（F-05-21，SD-43）
    onFailure?: 'block'
  }
  codex: HostDir & {
    interface?: Readonly<Record<string, unknown>> // 写入 .codex-plugin/plugin.json 的 interface
    hooksFile?: string // 插件目录内的相对路径，默认 hooks/hooks.json（SD-07）
  }
  agy: HostDir // agy 的根 plugin.json 只允许 name 与 description，没有其他宿主选项（F-11-02）
}

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
] as const

// marketplace 文件的配置（F-01-14，SD-41）：为 Claude Code 与 Codex 写 marketplace 文件
export interface MarketplaceConfig {
  name: string // kebab-case
  owner: { name: string; email?: string }
  dir?: string // marketplace 根目录，相对配置文件所在目录；默认为 outDir
}

// 命令 hooks 声明的事件（命令 hooks 声明第 1 节，F-01-09）
export const COMMAND_HOOK_EVENTS = [
  'SessionStart',
  'SessionEnd',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'Stop',
] as const
export type CommandHookEvent = (typeof COMMAND_HOOK_EVENTS)[number]

// 原样写入各目标 hooks 配置的命令，不经守卫逻辑；v0.1.0 不支持 matcher 与超时字段
export interface CommandHookDecl {
  readonly event: CommandHookEvent
  readonly command: string // 单行；插件根目录写作 {pluginRoot}，由宿主模块按目标替换
  readonly targets?: readonly TargetName[] // 限定目标；省略时适用于全部已配置目标
}

export interface UapaConfig {
  name: string // 插件名，写入各宿主 manifest；各宿主的命名约束由宿主模块检查
  version: string // semver
  description: string
  author?: { name: string; email?: string; url?: string }
  keywords?: readonly string[]
  guard?: string // 守卫逻辑文件；省略时不生成入口与守卫条目
  targets: readonly TargetName[] // 非空，不重复
  outDir?: string // 输出根目录，默认 'dist'；构建报告写在这里
  commandHooks?: readonly CommandHookDecl[] // 原样声明的命令 hooks，见 command-hooks.md
  marketplace?: MarketplaceConfig
  hosts?: { [H in HostName]?: HostOptions[H] }
}

export function defineConfig(config: UapaConfig): UapaConfig {
  return config
}
