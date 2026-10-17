// 生成 .agents/plugins/marketplace.json（F-06-15，SD-41）。字段按 rust-v0.162.1
// core-plugins/src/marketplace.rs，见 codex-plugins.md「marketplace.json」。
import type { HostInput, OutputFile } from '../types.ts'

export const MARKETPLACE_FILE = '.agents/plugins/marketplace.json'

export function marketplaceFiles(input: HostInput): readonly OutputFile[] | undefined {
  const source = input.marketplaceSource ?? null
  const market = input.config.marketplace
  if (source === null || market === undefined) return undefined
  const value = {
    name: market.name,
    plugins: [{ name: input.config.name, source }],
  }
  return [{ path: MARKETPLACE_FILE, content: `${JSON.stringify(value, null, 2)}\n` }]
}
