import OpenAI from "openai";
import prisma from "../db.server";

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  return new OpenAI({ apiKey });
}

const CACHE_TTL_HOURS = 6;

async function getCachedInsight(shopDomain: string, key: string): Promise<string | null> {
  try {
    const shop = await prisma.shop.findUnique({ where: { shopDomain } });
    if (!shop) return null;

    const entry = await prisma.cacheEntry.findUnique({
      where: { shopId_key: { shopId: shop.id, key } },
    });

    if (!entry) return null;
    if (new Date() > entry.expiresAt) {
      await prisma.cacheEntry.delete({ where: { id: entry.id } });
      return null;
    }

    return (entry.value as any)?.insight ?? null;
  } catch {
    return null;
  }
}

async function setCachedInsight(shopDomain: string, key: string, insight: string): Promise<void> {
  try {
    const shop = await prisma.shop.findUnique({ where: { shopDomain } });
    if (!shop) return;

    const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000);
    await prisma.cacheEntry.upsert({
      where: { shopId_key: { shopId: shop.id, key } },
      create: { shopId: shop.id, key, value: { insight }, expiresAt },
      update: { value: { insight }, expiresAt },
    });
  } catch {}
}

/**
 * Generate a daily summary insight for the dashboard
 */
export async function generateDailyInsight(
  shopDomain: string,
  data: {
    salesToday: any;
    salesYesterday: any;
    topProduct: any;
    sessions: any;
  }
): Promise<string | null> {
  const cacheKey = `daily_insight:${new Date().toISOString().split("T")[0]}`;
  const cached = await getCachedInsight(shopDomain, cacheKey);
  if (cached) return cached;

  const openai = getOpenAI();

  const todaySales = parseFloat(data.salesToday?.total_sales ?? "0");
  const yesterdaySales = parseFloat(data.salesYesterday?.total_sales ?? "0");
  const change = yesterdaySales > 0
    ? (((todaySales - yesterdaySales) / yesterdaySales) * 100).toFixed(1)
    : "N/A";

  const prompt = `You are a friendly Shopify business analyst. Write a 2-sentence insight for a merchant's dashboard.

Today's data:
- Today's sales: $${todaySales.toFixed(2)}
- Yesterday's sales: $${yesterdaySales.toFixed(2)}
- Change: ${change}%
- Today's orders: ${data.salesToday?.orders ?? 0}
- Top product this month: ${data.topProduct?.product_title ?? "N/A"} ($${parseFloat(data.topProduct?.total_sales ?? "0").toFixed(2)})
- Today's conversion rate: ${data.sessions?.conversion_rate ?? "N/A"}%

Be specific, encouraging, and end with one actionable tip. Keep it under 60 words.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 120,
    temperature: 0.7,
  });

  const insight = response.choices[0]?.message?.content?.trim() ?? null;
  if (insight) await setCachedInsight(shopDomain, cacheKey, insight);
  return insight;
}

/**
 * Generate a sales-focused insight
 */
export async function generateSalesInsight(
  shopDomain: string,
  data: { overview: any; byChannel: any[]; since: string }
): Promise<string | null> {
  const cacheKey = `sales_insight:${data.since}:${new Date().toISOString().split("T")[0]}`;
  const cached = await getCachedInsight(shopDomain, cacheKey);
  if (cached) return cached;

  const openai = getOpenAI();

  const topChannel = data.byChannel?.[0];
  const prompt = `You are a Shopify sales analyst. Write a 2-sentence insight about this store's sales performance.

Period: ${data.since.replace(/_/g, " ")}
Total sales: $${parseFloat(data.overview?.total_sales ?? "0").toFixed(2)}
Net sales: $${parseFloat(data.overview?.net_sales ?? "0").toFixed(2)}
Orders: ${data.overview?.orders ?? 0}
AOV: $${parseFloat(data.overview?.average_order_value ?? "0").toFixed(2)}
Discounts: $${parseFloat(data.overview?.discounts ?? "0").toFixed(2)}
Top channel: ${topChannel?.channel ?? "N/A"} ($${parseFloat(topChannel?.total_sales ?? "0").toFixed(2)})

Be specific and end with one actionable recommendation. Keep it under 60 words.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 120,
    temperature: 0.7,
  });

  const insight = response.choices[0]?.message?.content?.trim() ?? null;
  if (insight) await setCachedInsight(shopDomain, cacheKey, insight);
  return insight;
}

/**
 * Generate a product-focused insight
 */
export async function generateProductInsight(
  shopDomain: string,
  data: { topProduct: any; slowMover: any; inventoryAlerts: any[] }
): Promise<string | null> {
  const cacheKey = `product_insight:${new Date().toISOString().split("T")[0]}`;
  const cached = await getCachedInsight(shopDomain, cacheKey);
  if (cached) return cached;

  const openai = getOpenAI();

  const prompt = `You are a Shopify product analyst. Write a 2-sentence insight about this store's product performance.

Top selling product: ${data.topProduct?.product_title ?? "N/A"} ($${parseFloat(data.topProduct?.total_sales ?? "0").toFixed(2)}, ${data.topProduct?.units_sold ?? 0} units)
Slowest product: ${data.slowMover?.product_title ?? "N/A"} (${data.slowMover?.units_sold ?? 0} units)
Inventory alerts: ${data.inventoryAlerts.length} products low/out of stock

Be specific and end with one actionable recommendation. Keep it under 60 words.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 120,
    temperature: 0.7,
  });

  const insight = response.choices[0]?.message?.content?.trim() ?? null;
  if (insight) await setCachedInsight(shopDomain, cacheKey, insight);
  return insight;
}

/**
 * Generate a customer-focused insight
 */
export async function generateCustomerInsight(
  shopDomain: string,
  data: { overview: any; newCustomers: any; returningCustomers: any; topCountry: any }
): Promise<string | null> {
  const cacheKey = `customer_insight:${new Date().toISOString().split("T")[0]}`;
  const cached = await getCachedInsight(shopDomain, cacheKey);
  if (cached) return cached;

  const openai = getOpenAI();

  const total = parseInt(data.overview?.customer_count ?? "0");
  const newC = parseInt(data.newCustomers?.customer_count ?? "0");
  const returning = parseInt(data.returningCustomers?.customer_count ?? "0");
  const retentionRate = total > 0 ? ((returning / total) * 100).toFixed(1) : "0";

  const prompt = `You are a Shopify customer analyst. Write a 2-sentence insight about this store's customer base.

Total customers: ${total}
New customers: ${newC}
Returning customers: ${returning}
Retention rate: ${retentionRate}%
Top country: ${data.topCountry?.billing_country ?? "N/A"} (${data.topCountry?.customer_count ?? 0} customers)

Be specific and end with one actionable recommendation. Keep it under 60 words.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 120,
    temperature: 0.7,
  });

  const insight = response.choices[0]?.message?.content?.trim() ?? null;
  if (insight) await setCachedInsight(shopDomain, cacheKey, insight);
  return insight;
}

/**
 * Generate inventory insight
 */
export async function generateInventoryInsight(
  shopDomain: string,
  data: { outOfStockCount: number; lowStockCount: number; criticalItems: any[] }
): Promise<string | null> {
  const cacheKey = `inventory_insight:${new Date().toISOString().split("T")[0]}`;
  const cached = await getCachedInsight(shopDomain, cacheKey);
  if (cached) return cached;

  const openai = getOpenAI();

  const prompt = `You are a Shopify inventory analyst. Write a 2-sentence insight about this store's inventory health.

Out of stock products: ${data.outOfStockCount}
Low stock products (≤10 units): ${data.lowStockCount}
Critical items (≤7 days of stock): ${data.criticalItems.map((i: any) => i.productTitle).join(", ") || "None"}

Be specific and end with one actionable recommendation. Keep it under 60 words.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 120,
    temperature: 0.7,
  });

  const insight = response.choices[0]?.message?.content?.trim() ?? null;
  if (insight) await setCachedInsight(shopDomain, cacheKey, insight);
  return insight;
}

/**
 * Generate promotion insight
 */
export async function generatePromotionInsight(
  shopDomain: string,
  data: { totalSales: number; totalDiscounts: number; discountRate: number; topCode: any }
): Promise<string | null> {
  const cacheKey = `promotion_insight:${new Date().toISOString().split("T")[0]}`;
  const cached = await getCachedInsight(shopDomain, cacheKey);
  if (cached) return cached;

  const openai = getOpenAI();

  const prompt = `You are a Shopify promotions analyst. Write a 2-sentence insight about this store's discount strategy.

Total sales (last 30 days): $${data.totalSales.toFixed(2)}
Total discounts given: $${data.totalDiscounts.toFixed(2)}
Discount rate: ${data.discountRate.toFixed(1)}% of gross sales
Most used code: ${data.topCode?.title ?? data.topCode?.code ?? "N/A"} (${data.topCode?.usageCount ?? 0} uses)

Be specific and end with one actionable recommendation. Keep it under 60 words.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 120,
    temperature: 0.7,
  });

  const insight = response.choices[0]?.message?.content?.trim() ?? null;
  if (insight) await setCachedInsight(shopDomain, cacheKey, insight);
  return insight;
}


 */
export async function generateFullAdvisorReport(
  shopDomain: string,
  data: {
    salesLast30: any;
    salesLast7: any[];
    topProducts: any[];
    customerOverview: any[];
    sessions: any;
    slowMovers: any[];
  }
): Promise<{
  summary: string;
  insights: Array<{ title: string; description: string; action?: string }>;
  opportunities: Array<{ title: string; description: string; action?: string }>;
  warnings: Array<{ title: string; description: string; action?: string }>;
} | null> {
  const cacheKey = `advisor_report:${new Date().toISOString().split("T")[0]}`;
  const cached = await getCachedInsight(shopDomain, cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }

  const openai = getOpenAI();

  const newCustomers = data.customerOverview.find((r: any) => r.customer_type === "new");
  const returningCustomers = data.customerOverview.find((r: any) => r.customer_type === "returning");

  const prompt = `You are an expert Shopify business analyst. Analyze this store's data and return a JSON report.

Store data (last 30 days):
- Total sales: $${parseFloat(data.salesLast30?.total_sales ?? "0").toFixed(2)}
- Net sales: $${parseFloat(data.salesLast30?.net_sales ?? "0").toFixed(2)}
- Orders: ${data.salesLast30?.orders ?? 0}
- AOV: $${parseFloat(data.salesLast30?.average_order_value ?? "0").toFixed(2)}
- Discounts: $${parseFloat(data.salesLast30?.discounts ?? "0").toFixed(2)}
- Returns: $${parseFloat(data.salesLast30?.returns ?? "0").toFixed(2)}
- New customers: ${newCustomers?.customer_count ?? 0}
- Returning customers: ${returningCustomers?.customer_count ?? 0}
- Sessions: ${data.sessions?.sessions ?? 0}
- Conversion rate: ${data.sessions?.conversion_rate ?? 0}%
- Bounce rate: ${data.sessions?.bounce_rate ?? 0}%
- Top product: ${data.topProducts[0]?.product_title ?? "N/A"} ($${parseFloat(data.topProducts[0]?.total_sales ?? "0").toFixed(2)})
- Slowest product: ${data.slowMovers[0]?.product_title ?? "N/A"} (${data.slowMovers[0]?.units_sold ?? 0} units)

Return ONLY valid JSON in this exact format:
{
  "summary": "2-3 sentence executive summary of the store's performance",
  "insights": [
    {"title": "Insight title", "description": "Detailed description", "action": "Specific action to take"}
  ],
  "opportunities": [
    {"title": "Opportunity title", "description": "Detailed description", "action": "Specific action to take"}
  ],
  "warnings": [
    {"title": "Warning title", "description": "Detailed description", "action": "Specific action to take"}
  ]
}

Provide 2-3 items in each array. Be specific, data-driven, and actionable.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1000,
    temperature: 0.5,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) return null;

  try {
    const report = JSON.parse(content);
    await setCachedInsight(shopDomain, cacheKey, JSON.stringify(report));
    return report;
  } catch {
    return null;
  }
}