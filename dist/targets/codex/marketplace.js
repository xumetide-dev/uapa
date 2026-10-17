export const MARKETPLACE_FILE = '.agents/plugins/marketplace.json';
export function marketplaceFiles(input) {
    const source = input.marketplaceSource ?? null;
    const market = input.config.marketplace;
    if (source === null || market === undefined)
        return undefined;
    const value = {
        name: market.name,
        plugins: [{ name: input.config.name, source }],
    };
    return [{ path: MARKETPLACE_FILE, content: `${JSON.stringify(value, null, 2)}\n` }];
}
