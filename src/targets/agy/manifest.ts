// 生成 plugin.json 或 .antigravity-plugin/plugin.json（F-11-02、F-11-15，SD-47）。字段与命名
// 规则见 agy-plugins.md「插件 manifest」：文档所列 schema 不允许 name、description 之外的字段；
// $schema 的地址返回 404，不写；skills/ 下的 skill 无需在 manifest 中声明。
import type { HostName } from '../../config/targets.ts'
import type { UapaConfig } from '../../config/types.ts'

export const MANIFEST = 'plugin.json'
export const ALT_MANIFEST = '.antigravity-plugin/plugin.json'

const NAME = /^[a-zA-Z0-9_-]+$/

// 合并布局中与其他宿主的根 plugin.json 冲突时附在冲突错误之后
export const MANIFEST_CONFLICT_HINT =
  'agy 的根 plugin.json 只允许 name 与 description，不能与其他宿主的根 plugin.json 合并；' +
  '为 hosts.agy.dir 设置单独的目录'

// 省略 hosts.agy.manifest 时，默认布局写 plugin.json，合并布局写 .antigravity-plugin/plugin.json
export function manifestPathOf(
  config: UapaConfig,
  sharedWith: readonly HostName[],
): 'plugin.json' | '.antigravity-plugin/plugin.json' {
  return (
    config.hosts?.agy?.manifest ?? (sharedWith.length > 0 ? ALT_MANIFEST : MANIFEST)
  )
}

export function manifestErrors(config: UapaConfig): string[] {
  if (NAME.test(config.name)) return []
  return [
    `插件名 ${config.name} 不匹配 ^[a-zA-Z0-9_-]+$：agy 的 plugin.json 不接受该名称`,
  ]
}

export function manifest(config: UapaConfig): Record<string, unknown> {
  return { name: config.name, description: config.description }
}
