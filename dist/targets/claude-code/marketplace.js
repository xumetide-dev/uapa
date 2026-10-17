export const MARKETPLACE_FILE = '.claude-plugin/marketplace.json';
export function marketplaceFiles(input) {
    const source = input.marketplaceSource ?? null;
    const market = input.config.marketplace;
    if (source === null || market === undefined)
        return undefined;
    const { owner } = market;
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
    };
    return [{ path: MARKETPLACE_FILE, content: `${JSON.stringify(value, null, 2)}\n` }];
}
