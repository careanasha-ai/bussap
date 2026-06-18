import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  DataTable,
  Badge,
  Box,
  Divider,
  Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { runShopifyQL } from "../services/shopifyql.server";
import { getDiscountCodes } from "../services/discounts.server";
import { generatePromotionInsight } from "../services/ai.server";
import { KpiCard } from "../components/kpi-card/KpiCard";
import { InsightCard } from "../components/insight-card/InsightCard";
import { SalesChart } from "../components/charts/SalesChart";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const [discountTrendResult, discountCodesResult, salesWithDiscountResult] = await Promise.allSettled([
    runShopifyQL(admin, `
      FROM sales
      SHOW total_sales, discounts, net_sales, orders
      TIMESERIES month
      SINCE last_year
      ORDER BY month ASC
    `),
    getDiscountCodes(admin),
    runShopifyQL(admin, `
      FROM sales
      SHOW total_sales, discounts, net_sales, orders
      SINCE last_30_days
    `),
  ]);

  const discountTrend = discountTrendResult.status === "fulfilled" ? discountTrendResult.value?.rows ?? [] : [];
  const discountCodes = discountCodesResult.status === "fulfilled" ? discountCodesResult.value ?? [] : [];
  const salesOverview = salesWithDiscountResult.status === "fulfilled" ? salesWithDiscountResult.value?.rows?.[0] : null;

  const totalSales = parseFloat(salesOverview?.total_sales ?? "0");
  const totalDiscounts = parseFloat(salesOverview?.discounts ?? "0");
  const discountRate = totalSales > 0 ? (totalDiscounts / totalSales) * 100 : 0;

  let aiInsight = null;
  try {
    aiInsight = await generatePromotionInsight(session.shop, {
      totalSales,
      totalDiscounts,
      discountRate,
      topCode: discountCodes[0],
    });
  } catch (e) {}

  return json({ discountTrend, discountCodes, salesOverview, totalSales, totalDiscounts, discountRate, aiInsight });
};

export default function PromotionsPage() {
  const data = useLoaderData<typeof loader>();

  const codeRows = data.discountCodes.map((code: any) => [
    code.title || code.code || "Unknown",
    code.usageCount?.toString() ?? "0",
    code.status ? <Badge tone={code.status === "ACTIVE" ? "success" : "subdued"}>{code.status}</Badge> : "—",
    code.startsAt ? new Date(code.startsAt).toLocaleDateString() : "—",
    code.endsAt ? new Date(code.endsAt).toLocaleDateString() : "No expiry",
  ]);

  return (
    <Page title="Promotions & Discounts" subtitle="Track the impact of your discount codes and promotions">
      <BlockStack gap="500">

        {/* AI Insight */}
        {data.aiInsight && (
          <InsightCard title="🤖 Promotion Insight" content={data.aiInsight} tone="info" />
        )}

        {/* KPIs */}
        <InlineGrid columns={{ xs: 2, md: 4 }} gap="400">
          <KpiCard
            title="Total Discounts Given"
            value={`$${data.totalDiscounts.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            change={null}
            changeLabel="last 30 days"
          />
          <KpiCard
            title="Discount Rate"
            value={`${data.discountRate.toFixed(1)}%`}
            change={null}
            changeLabel="of gross sales"
          />
          <KpiCard
            title="Net Sales"
            value={`$${parseFloat(data.salesOverview?.net_sales ?? "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            change={null}
            changeLabel="after discounts & returns"
          />
          <KpiCard
            title="Active Discount Codes"
            value={data.discountCodes.filter((c: any) => c.status === "ACTIVE").length.toString()}
            change={null}
            changeLabel="currently active"
          />
        </InlineGrid>

        {/* Discount Rate Warning */}
        {data.discountRate > 20 && (
          <Banner tone="warning" title="High discount rate detected">
            <p>
              You're giving away {data.discountRate.toFixed(1)}% of your gross revenue in discounts.
              Consider reviewing your promotion strategy to protect margins.
            </p>
          </Banner>
        )}

        {/* Discount Trend Chart */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h3">Discount Impact Over Time</Text>
            <Text variant="bodySm" as="p" tone="subdued">
              Monthly comparison of gross sales vs discounts given vs net sales
            </Text>
            <SalesChart data={data.discountTrend} loading={false} showDiscounts />
          </BlockStack>
        </Card>

        {/* Discount Codes Table */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h3">Discount Codes</Text>
            <Divider />
            {codeRows.length > 0 ? (
              <DataTable
                columnContentTypes={["text", "numeric", "text", "text", "text"]}
                headings={["Code / Title", "Uses", "Status", "Start Date", "End Date"]}
                rows={codeRows}
              />
            ) : (
              <Text as="p" tone="subdued">No discount codes found.</Text>
            )}
          </BlockStack>
        </Card>

      </BlockStack>
    </Page>
  );
}