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
  agy: HostDir // agy 的根 plugin.json 只允许 name 与 description，没有其他宿主选项（F-11-02）
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
  hosts?: { [H in HostName]?: HostOptions[H] }
}

export function defineConfig(config: UapaConfig): UapaConfig {
  return config
}
