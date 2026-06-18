import { useState } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  DataTable,
  Badge,
  Tabs,
  Box,
  Select,
  Banner,
  ProgressBar,
  Tooltip,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { runShopifyQL } from "../services/shopifyql.server";
import { getInventoryAlerts } from "../services/inventory.server";
import { generateProductInsight } from "../services/ai.server";
import { KpiCard } from "../components/kpi-card/KpiCard";
import { InsightCard } from "../components/insight-card/InsightCard";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const since = url.searchParams.get("since") || "last_30_days";

  const [
    topProductsResult,
    productTypeResult,
    vendorResult,
    slowMoversResult,
    variantResult,
    inventoryAlertsResult,
  ] = await Promise.allSettled([
    runShopifyQL(admin, `
      FROM sales
      SHOW total_sales, units_sold, product_title
      GROUP BY product_title
      SINCE ${since}
      ORDER BY total_sales DESC
      LIMIT 25
    `),
    runShopifyQL(admin, `
      FROM sales
      SHOW total_sales, units_sold
      GROUP BY product_type
      SINCE ${since}
      ORDER BY total_sales DESC
      LIMIT 15
    `),
    runShopifyQL(admin, `
      FROM sales
      SHOW total_sales, units_sold
      GROUP BY product_vendor
      SINCE ${since}
      ORDER BY total_sales DESC
      LIMIT 15
    `),
    runShopifyQL(admin, `
      FROM sales
      SHOW total_sales, units_sold, product_title
      GROUP BY product_title
      SINCE ${since}
      ORDER BY units_sold ASC
      LIMIT 10
    `),
    runShopifyQL(admin, `
      FROM sales
      SHOW total_sales, units_sold, variant_title, product_title
      GROUP BY product_title, variant_title
      SINCE ${since}
      ORDER BY units_sold DESC
      LIMIT 20
    `),
    getInventoryAlerts(admin),
  ]);

  const topProducts = topProductsResult.status === "fulfilled" ? topProductsResult.value?.rows ?? [] : [];
  const byType = productTypeResult.status === "fulfilled" ? productTypeResult.value?.rows ?? [] : [];
  const byVendor = vendorResult.status === "fulfilled" ? vendorResult.value?.rows ?? [] : [];
  const slowMovers = slowMoversResult.status === "fulfilled" ? slowMoversResult.value?.rows ?? [] : [];
  const variants = variantResult.status === "fulfilled" ? variantResult.value?.rows ?? [] : [];
  const inventoryAlerts = inventoryAlertsResult.status === "fulfilled" ? inventoryAlertsResult.value ?? [] : [];

  let aiInsight = null;
  try {
    aiInsight = await generateProductInsight(session.shop, {
      topProduct: topProducts[0],
      slowMover: slowMovers[0],
      inventoryAlerts: inventoryAlerts.slice(0, 3),
    });
  } catch (e) {}

  return json({ topProducts, byType, byVendor, slowMovers, variants, inventoryAlerts, aiInsight, since });
};

export default function ProductsPage() {
  const data = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTab, setSelectedTab] = useState(0);

  const since = searchParams.get("since") || "last_30_days";

  const DATE_RANGES = [
    { label: "Last 7 days", value: "last_7_days" },
    { label: "Last 30 days", value: "last_30_days" },
    { label: "This month", value: "this_month" },
    { label: "Last month", value: "last_month" },
    { label: "This quarter", value: "this_quarter" },
    { label: "This year", value: "this_year" },
  ];

  const tabs = [
    { id: "top", content: "Top Sellers" },
    { id: "slow", content: "Slow Movers" },
    { id: "variants", content: "Variants" },
    { id: "by-type", content: "By Type" },
    { id: "by-vendor", content: "By Vendor" },
    { id: "inventory", content: `Inventory Alerts ${data.inventoryAlerts.length > 0 ? `(${data.inventoryAlerts.length})` : ""}` },
  ];

  const maxSales = data.topProducts.length > 0
    ? parseFloat(data.topProducts[0]?.total_sales ?? "1")
    : 1;

  const topProductRows = data.topProducts.map((row: any, i: number) => {
    const sales = parseFloat(row.total_sales || "0");
    const pct = (sales / maxSales) * 100;
    return [
      `#${i + 1}`,
      row.product_title || "Unknown",
      `$${sales.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      row.units_sold || "0",
    ];
  });

  const slowMoverRows = data.slowMovers.map((row: any) => [
    row.product_title || "Unknown",
    `$${parseFloat(row.total_sales || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    row.units_sold || "0",
  ]);

  const variantRows = data.variants.map((row: any) => [
    row.product_title || "Unknown",
    row.variant_title || "Default",
    `$${parseFloat(row.total_sales || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    row.units_sold || "0",
  ]);

  const typeRows = data.byType.map((row: any) => [
    row.product_type || "Uncategorized",
    `$${parseFloat(row.total_sales || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    row.units_sold || "0",
  ]);

  const vendorRows = data.byVendor.map((row: any) => [
    row.product_vendor || "Unknown",
    `$${parseFloat(row.total_sales || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    row.units_sold || "0",
  ]);

  return (
    <Page title="Product Intelligence" subtitle="Understand what's selling and what's not">
      <BlockStack gap="500">

        {/* Date Range */}
        <Card>
          <InlineGrid columns={{ xs: 1, sm: "auto 1fr" }} gap="300" alignItems="center">
            <Text variant="bodyMd" as="p" fontWeight="semibold">Date Range:</Text>
            <Box maxWidth="200px">
              <Select
                label=""
                labelHidden
                options={DATE_RANGES}
                value={since}
                onChange={(v) => setSearchParams({ since: v })}
              />
            </Box>
          </InlineGrid>
        </Card>

        {/* AI Insight */}
        {data.aiInsight && (
          <InsightCard title="🤖 Product Insight" content={data.aiInsight} tone="info" />
        )}

        {/* Inventory Alert Banner */}
        {data.inventoryAlerts.length > 0 && (
          <Banner title={`${data.inventoryAlerts.length} inventory alert${data.inventoryAlerts.length > 1 ? "s" : ""} need your attention`} tone="warning">
            <p>Some products are running low or out of stock. Check the Inventory Alerts tab.</p>
          </Banner>
        )}

        {/* KPIs */}
        <InlineGrid columns={{ xs: 2, md: 4 }} gap="400">
          <KpiCard title="Products Tracked" value={data.topProducts.length.toString()} change={null} changeLabel={since.replace(/_/g, " ")} />
          <KpiCard title="Top Product Revenue" value={`$${parseFloat(data.topProducts[0]?.total_sales ?? "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}`} change={null} changeLabel={data.topProducts[0]?.product_title?.substring(0, 20) ?? "N/A"} />
          <KpiCard title="Inventory Alerts" value={data.inventoryAlerts.length.toString()} change={null} changeLabel="low/out of stock" />
          <KpiCard title="Slow Movers" value={data.slowMovers.length.toString()} change={null} changeLabel="need attention" />
        </InlineGrid>

        {/* Tabs */}
        <Card>
          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
            <Box paddingBlockStart="400">
              {selectedTab === 0 && (
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h3">Top Selling Products</Text>
                  {topProductRows.length > 0 ? (
                    <DataTable
                      columnContentTypes={["numeric", "text", "numeric", "numeric"]}
                      headings={["Rank", "Product", "Revenue", "Units Sold"]}
                      rows={topProductRows}
                    />
                  ) : (
                    <Text as="p" tone="subdued">No sales data for this period.</Text>
                  )}
                </BlockStack>
              )}
              {selectedTab === 1 && (
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h3">Slow Moving Products</Text>
                  <Text as="p" tone="subdued">Products with the lowest sales volume — consider promotions or clearance.</Text>
                  {slowMoverRows.length > 0 ? (
                    <DataTable
                      columnContentTypes={["text", "numeric", "numeric"]}
                      headings={["Product", "Revenue", "Units Sold"]}
                      rows={slowMoverRows}
                    />
                  ) : (
                    <Text as="p" tone="subdued">No data available.</Text>
                  )}
                </BlockStack>
              )}
              {selectedTab === 2 && (
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h3">Variant Performance</Text>
                  {variantRows.length > 0 ? (
                    <DataTable
                      columnContentTypes={["text", "text", "numeric", "numeric"]}
                      headings={["Product", "Variant", "Revenue", "Units Sold"]}
                      rows={variantRows}
                    />
                  ) : (
                    <Text as="p" tone="subdued">No variant data available.</Text>
                  )}
                </BlockStack>
              )}
              {selectedTab === 3 && (
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h3">Sales by Product Type</Text>
                  {typeRows.length > 0 ? (
                    <DataTable
                      columnContentTypes={["text", "numeric", "numeric"]}
                      headings={["Product Type", "Revenue", "Units Sold"]}
                      rows={typeRows}
                    />
                  ) : (
                    <Text as="p" tone="subdued">No product type data available.</Text>
                  )}
                </BlockStack>
              )}
              {selectedTab === 4 && (
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h3">Sales by Vendor</Text>
                  {vendorRows.length > 0 ? (
                    <DataTable
                      columnContentTypes={["text", "numeric", "numeric"]}
                      headings={["Vendor", "Revenue", "Units Sold"]}
                      rows={vendorRows}
                    />
                  ) : (
                    <Text as="p" tone="subdued">No vendor data available.</Text>
                  )}
                </BlockStack>
              )}
              {selectedTab === 5 && (
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h3">Inventory Alerts</Text>
                  {data.inventoryAlerts.length > 0 ? (
                    <DataTable
                      columnContentTypes={["text", "text", "numeric", "text"]}
                      headings={["Product", "Variant", "Stock", "Status"]}
                      rows={data.inventoryAlerts.map((a: any) => [
                        a.productTitle,
                        a.variantTitle || "Default",
                        a.available.toString(),
                        a.available === 0 ? "Out of Stock" : "Low Stock",
                      ])}
                    />
                  ) : (
                    <Banner tone="success">
                      <p>All products have healthy inventory levels. 🎉</p>
                    </Banner>
                  )}
                </BlockStack>
              )}
            </Box>
          </Tabs>
        </Card>

      </BlockStack>
    </Page>
  );
}