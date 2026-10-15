// 生成 .codex-plugin/plugin.json（F-06-02）。Codex 0.162.1 对带 $schema 的根 plugin.json
// （AgentPlugin 格式）不加载任何 hooks，因此写兼容格式；字段见 codex-plugins.md
// 「源码核对（rust-v0.162.1）」。该文件与其他宿主的 manifest 不同路径，不需合并。
import type { UapaConfig } from '../../config/types.ts'

export const MANIFEST = '.codex-plugin/plugin.json'

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function manifestErrors(config: UapaConfig): string[] {
  if (KEBAB_CASE.test(config.name)) return []
  return [`插件名 ${config.name} 不是 kebab-case：Codex 以插件名作为组件命名空间`]
}

// 不加载任何 hooks 的 manifest hooks 取值：内联的空 hooks 对象被解析为内联 hooks，空条目跳过且
// 不回退到默认的 hooks/hooks.json；空数组 [] 被解析为未写，仍会读取默认文件
// （codex-source-review.md「manifest 的发现与格式」）
export const NO_HOOKS: Readonly<Record<string, unknown>> = { hooks: {} }

// hooks 为以 ./ 开头的 hooks 文件路径或 NO_HOOKS，为 null 时不写。manifest 写了 hooks 时
// Codex 不再读取默认的 hooks/hooks.json。键序固定；未配置的可选字段不写；Codex 不读取
// author，不写
export function manifest(
  config: UapaConfig,
  hooks: string | typeof NO_HOOKS | null,
): Record<string, unknown> {
  const options = config.hosts?.codex ?? {}
  return {
    name: config.name,
    version: config.version,
    description: config.description,
    ...(config.keywords === undefined ? {} : { keywords: config.keywords }),
    ...(hooks === null ? {} : { hooks }),
    ...(options.interface === undefined ? {} : { interface: options.interface }),
  }
}
