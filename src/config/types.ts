// 构建配置类型（模块接口 §2），由包入口导出。字段的校验见 validate.ts。
import type { HostName, TargetName } from './targets.ts'

interface HostDir {
  dir?: string // 该宿主的插件目录；默认 `<outDir>/<宿主>`
}

// 各宿主在 hosts 中的选项；新宿主在此加入键，缺键时 UapaConfig.hosts 的类型报错
export interface HostOptions {
  'claude-code': HostDir & {
    displayName?: string
    userConfig?: unknown
    dependencies?: unknown
    $schema?: string
  }
  codex: HostDir & {
    interface?: Readonly<Record<string, unknown>> // 写入 extensions.com.openai.interface
    hooksFile?: string // 插件目录内的相对路径，默认 hooks/hooks.json（SD-07）
  }
  agy: HostDir // agy 的根 plugin.json 只允许 name 与 description，没有其他宿主选项（F-11-02）
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
  hosts?: { [H in HostName]?: HostOptions[H] }
}

export function defineConfig(config: UapaConfig): UapaConfig {
  return config
}
