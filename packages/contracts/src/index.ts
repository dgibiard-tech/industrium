export type CompanySummary = { id: string; name: string; sector: string; balanceCents: string };
export type ProductSummary = { id: string; sku: string; name: string; unit: string };
export type ListingSummary = { id: string; product: ProductSummary; sellerName: string; quantity: string; unitPriceCents: string };
