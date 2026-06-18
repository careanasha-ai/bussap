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
  Banner,
  Box,
  ProgressBar,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { runShopifyQL } from "../services/shopifyql.server";
import { getInventoryAlerts, getInventoryWithVelocity } from "../services/inventory.server";
import { generateInventoryInsight } from "../services/ai.server";
import { KpiCard } from "../components/kpi-card/KpiCard";
import { InsightCard } from "../components/insight-card/InsightCard";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const [alertsResult, velocityResult, salesVelocityResult] = await Promise.allSettled([
    getInventoryAlerts(admin),
    getInventoryWithVelocity(admin),
    runShopifyQL(admin, `
      FROM sales
      SHOW units_sold, product_title
      GROUP BY product_title
      SINCE last_30_days
      ORDER BY units_sold DESC
      LIMIT 50
    `),
  ]);

  const alerts = alertsResult.status === "fulfilled" ? alertsResult.value ?? [] : [];
  const inventory = velocityResult.status === "fulfilled" ? velocityResult.value ?? [] : [];
  const salesVelocity = salesVelocityResult.status === "fulfilled" ? salesVelocityResult.value?.rows ?? [] : [];

  // Merge inventory with sales velocity to compute days of stock
  const velocityMap: Record<string, number> = {};
  salesVelocity.forEach((row: any) => {
    const dailyVelocity = parseFloat(row.units_sold || "0") / 30;
    velocityMap[row.product_title] = dailyVelocity;
  });

  const enrichedInventory = inventory.map((item: any) => {
    const velocity = velocityMap[item.productTitle] || 0;
    const daysOfStock = velocity > 0 ? Math.floor(item.available / velocity) : null;
    return { ...item, dailyVelocity: velocity.toFixed(2), daysOfStock };
  });

  const outOfStock = alerts.filter((a: any) => a.available === 0);
  const lowStock = alerts.filter((a: any) => a.available > 0 && a.available <= 10);
  const criticalItems = enrichedInventory.filter((i: any) => i.daysOfStock !== null && i.daysOfStock <= 7);

  let aiInsight = null;
  try {
    aiInsight = await generateInventoryInsight(session.shop, {
      outOfStockCount: outOfStock.length,
      lowStockCount: lowStock.length,
      criticalItems: criticalItems.slice(0, 3),
    });
  } catch (e) {}

  return json({
    alerts,
    outOfStock,
    lowStock,
    enrichedInventory: enrichedInventory.slice(0, 50),
    criticalItems,
    aiInsight,
  });
};

export default function InventoryPage() {
  const data = useLoaderData<typeof loader>();

  const outOfStockRows = data.outOfStock.map((item: any) => [
    item.productTitle || "Unknown",
    item.variantTitle || "Default",
    <Badge tone="critical">Out of Stock</Badge>,
    "—",
  ]);

  const lowStockRows = data.lowStock.map((item: any) => [
    item.productTitle || "Unknown",
    item.variantTitle || "Default",
    item.available.toString(),
    <Badge tone="warning">Low Stock</Badge>,
  ]);

  const velocityRows = data.enrichedInventory.map((item: any) => [
    item.productTitle || "Unknown",
    item.variantTitle || "Default",
    item.available?.toString() ?? "—",
    item.dailyVelocity ? `${item.dailyVelocity}/day` : "—",
    item.daysOfStock !== null
      ? (
        <Badge tone={item.daysOfStock <= 3 ? "critical" : item.daysOfStock <= 7 ? "warning" : item.daysOfStock <= 14 ? "attention" : "success"}>
          {item.daysOfStock} days
        </Badge>
      )
      : <Badge tone="info">No sales data</Badge>,
  ]);

  return (
    <Page title="Inventory Intelligence" subtitle="Stock levels, velocity, and reorder recommendations">
      <BlockStack gap="500">

        {/* AI Insight */}
        {data.aiInsight && (
          <InsightCard title="🤖 Inventory Insight" content={data.aiInsight} tone="warning" />
        )}

        {/* Alert Banners */}
        {data.outOfStock.length > 0 && (
          <Banner tone="critical" title={`${data.outOfStock.length} product${data.outOfStock.length > 1 ? "s" : ""} out of stock`}>
            <p>These products cannot be sold until restocked. Act immediately to avoid lost revenue.</p>
          </Banner>
        )}
        {data.lowStock.length > 0 && (
          <Banner tone="warning" title={`${data.lowStock.length} product${data.lowStock.length > 1 ? "s" : ""} running low (≤10 units)`}>
            <p>Consider reordering soon to avoid stockouts.</p>
          </Banner>
        )}

        {/* KPIs */}
        <InlineGrid columns={{ xs: 2, md: 4 }} gap="400">
          <KpiCard title="Out of Stock" value={data.outOfStock.length.toString()} change={null} changeLabel="need immediate restock" />
          <KpiCard title="Low Stock" value={data.lowStock.length.toString()} change={null} changeLabel="≤10 units remaining" />
          <KpiCard title="Critical (≤7 days)" value={data.criticalItems.length.toString()} change={null} changeLabel="based on sell rate" />
          <KpiCard title="Products Tracked" value={data.enrichedInventory.length.toString()} change={null} changeLabel="with inventory data" />
        </InlineGrid>

        {/* Out of Stock */}
        {outOfStockRows.length > 0 && (
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h3">🔴 Out of Stock</Text>
              <DataTable
                columnContentTypes={["text", "text", "text", "text"]}
                headings={["Product", "Variant", "Status", "Est. Daily Sales"]}
                rows={outOfStockRows}
              />
            </BlockStack>
          </Card>
        )}

        {/* Low Stock */}
        {lowStockRows.length > 0 && (
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h3">🟡 Low Stock</Text>
              <DataTable
                columnContentTypes={["text", "text", "numeric", "text"]}
                headings={["Product", "Variant", "Units Left", "Status"]}
                rows={lowStockRows}
              />
            </BlockStack>
          </Card>
        )}

        {/* Velocity Table */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h3">📊 Inventory Velocity & Days of Stock</Text>
            <Text variant="bodySm" as="p" tone="subdued">
              Days of stock is calculated based on your average daily sell rate over the last 30 days.
            </Text>
            <Divider />
            {velocityRows.length > 0 ? (
              <DataTable
                columnContentTypes={["text", "text", "numeric", "text", "text"]}
                headings={["Product", "Variant", "In Stock", "Sell Rate", "Days of Stock"]}
                rows={velocityRows}
              />
            ) : (
              <Text as="p" tone="subdued">No inventory data available.</Text>
            )}
          </BlockStack>
        </Card>

      </BlockStack>
    </Page>
  );
}