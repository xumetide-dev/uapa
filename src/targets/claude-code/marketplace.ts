// 生成 .claude-plugin/marketplace.json（F-05-24，SD-41）。字段与校验规则见
// claude-code-plugins.md「marketplace.json」与 claude-code-local-tests.md「marketplace 添加与安装」。
import type { HostInput, OutputFile } from '../types.ts'

export const MARKETPLACE_FILE = '.claude-plugin/marketplace.json'

export function marketplaceFiles(input: HostInput): readonly OutputFile[] | undefined {
  const source = input.marketplaceSource ?? null
  const market = input.config.marketplace
  if (source === null || market === undefined) return undefined
  const { owner } = market
  const value = {
    name: market.name,
    owner: {
      name: owner.name,
      ...(owner.email === undefined ? {} : { email: owner.email }),
    },
    metadata: { description: input.config.description },
    plugins: [
      {
        name: input.config.name,
        source,
        description: input.config.description,
      },
    ],
  }
  return [{ path: MARKETPLACE_FILE, content: `${JSON.stringify(value, null, 2)}\n` }]
}
