import { useState } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  Select,
  Tabs,
  DataTable,
  Badge,
  Box,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { runShopifyQL } from "../services/shopifyql.server";
import { SalesChart } from "../components/charts/SalesChart";
import { GeoChart } from "../components/charts/GeoChart";
import { KpiCard } from "../components/kpi-card/KpiCard";
import { InsightCard } from "../components/insight-card/InsightCard";
import { generateSalesInsight } from "../services/ai.server";

const DATE_RANGES = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 days", value: "last_7_days" },
  { label: "Last 30 days", value: "last_30_days" },
  { label: "This month", value: "this_month" },
  { label: "Last month", value: "last_month" },
  { label: "This quarter", value: "this_quarter" },
  { label: "This year", value: "this_year" },
  { label: "Last year", value: "last_year" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const since = url.searchParams.get("since") || "last_30_days";
  const timeseries = since.includes("today") || since.includes("yesterday") || since.includes("7_days")
    ? "day" : since.includes("month") ? "day" : "month";

  const [
    overviewResult,
    trendResult,
    byChannelResult,
    byCountryResult,
    discountImpactResult,
    hourlyResult,
  ] = await Promise.allSettled([
    runShopifyQL(admin, `
      FROM sales
      SHOW total_sales, net_sales, gross_sales, discounts, returns, orders, average_order_value
      SINCE ${since}
      WITH PERCENT_CHANGE
      COMPARE TO previous_period
    `),
    runShopifyQL(admin, `
      FROM sales
      SHOW total_sales, orders
      TIMESERIES ${timeseries}
      SINCE ${since}
      ORDER BY ${timeseries} ASC
    `),
    runShopifyQL(admin, `
      FROM sales
      SHOW total_sales, orders
      GROUP BY channel
      SINCE ${since}
      ORDER BY total_sales DESC
    `),
    runShopifyQL(admin, `
      FROM sales
      SHOW total_sales, orders
      GROUP BY billing_country
      SINCE ${since}
      ORDER BY total_sales DESC
      LIMIT 20
    `),
    runShopifyQL(admin, `
      FROM sales
      SHOW total_sales, discounts, net_sales
      TIMESERIES month
      SINCE last_year
      ORDER BY month ASC
    `),
    runShopifyQL(admin, `
      FROM sales
      SHOW total_sales, orders
      GROUP BY hour
      SINCE last_30_days
      ORDER BY hour ASC
    `),
  ]);

  const overview = overviewResult.status === "fulfilled" ? overviewResult.value?.rows?.[0] : null;
  const trend = trendResult.status === "fulfilled" ? trendResult.value?.rows ?? [] : [];
  const byChannel = byChannelResult.status === "fulfilled" ? byChannelResult.value?.rows ?? [] : [];
  const byCountry = byCountryResult.status === "fulfilled" ? byCountryResult.value?.rows ?? [] : [];
  const discountImpact = discountImpactResult.status === "fulfilled" ? discountImpactResult.value?.rows ?? [] : [];
  const hourly = hourlyResult.status === "fulfilled" ? hourlyResult.value?.rows ?? [] : [];

  let aiInsight = null;
  try {
    aiInsight = await generateSalesInsight(session.shop, { overview, byChannel, since });
  } catch (e) {}

  return json({ overview, trend, byChannel, byCountry, discountImpact, hourly, aiInsight, since });
};

export default function SalesPage() {
  const data = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTab, setSelectedTab] = useState(0);

  const since = searchParams.get("since") || "last_30_days";

  const handleDateChange = (value: string) => {
    setSearchParams({ since: value });
  };

  const overview = data.overview;
  const totalSales = parseFloat(overview?.total_sales ?? "0");
  const netSales = parseFloat(overview?.net_sales ?? "0");
  const discounts = parseFloat(overview?.discounts ?? "0");
  const returns = parseFloat(overview?.returns ?? "0");
  const orders = parseInt(overview?.orders ?? "0");
  const aov = parseFloat(overview?.average_order_value ?? "0");

  const tabs = [
    { id: "overview", content: "Overview" },
    { id: "by-channel", content: "By Channel" },
    { id: "by-geography", content: "By Geography" },
    { id: "discounts", content: "Discount Impact" },
  ];

  const channelRows = data.byChannel.map((row: any) => [
    row.channel || "Unknown",
    `$${parseFloat(row.total_sales || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    row.orders || "0",
  ]);

  const countryRows = data.byCountry.map((row: any) => [
    row.billing_country || "Unknown",
    `$${parseFloat(row.total_sales || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    row.orders || "0",
  ]);

  return (
    <Page
      title="Sales Analytics"
      subtitle="Deep dive into your revenue performance"
    >
      <BlockStack gap="500">

        {/* Date Range Selector */}
        <Card>
          <InlineGrid columns={{ xs: 1, sm: "auto 1fr" }} gap="300" alignItems="center">
            <Text variant="bodyMd" as="p" fontWeight="semibold">Date Range:</Text>
            <Box maxWidth="200px">
              <Select
                label=""
                labelHidden
                options={DATE_RANGES}
                value={since}
                onChange={handleDateChange}
              />
            </Box>
          </InlineGrid>
        </Card>

        {/* AI Insight */}
        {data.aiInsight && (
          <InsightCard title="🤖 Sales Insight" content={data.aiInsight} tone="info" />
        )}

        {/* KPI Overview */}
        <InlineGrid columns={{ xs: 2, md: 3 }} gap="400">
          <KpiCard title="Total Sales" value={`$${totalSales.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} change={null} changeLabel={since.replace(/_/g, " ")} />
          <KpiCard title="Net Sales" value={`$${netSales.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} change={null} changeLabel="after discounts & returns" />
          <KpiCard title="Orders" value={orders.toString()} change={null} changeLabel={since.replace(/_/g, " ")} />
          <KpiCard title="Avg. Order Value" value={`$${aov.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} change={null} changeLabel={since.replace(/_/g, " ")} />
          <KpiCard title="Discounts Given" value={`$${discounts.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} change={null} changeLabel={`${totalSales > 0 ? ((discounts / totalSales) * 100).toFixed(1) : 0}% of gross`} />
          <KpiCard title="Returns" value={`$${returns.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} change={null} changeLabel={`${totalSales > 0 ? ((returns / totalSales) * 100).toFixed(1) : 0}% of gross`} />
        </InlineGrid>

        {/* Tabs */}
        <Card>
          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
            <Box paddingBlockStart="400">
              {selectedTab === 0 && (
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h3">Revenue Trend</Text>
                  <SalesChart data={data.trend} loading={false} />
                </BlockStack>
              )}
              {selectedTab === 1 && (
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h3">Sales by Channel</Text>
                  {channelRows.length > 0 ? (
                    <DataTable
                      columnContentTypes={["text", "numeric", "numeric"]}
                      headings={["Channel", "Revenue", "Orders"]}
                      rows={channelRows}
                    />
                  ) : (
                    <Text as="p" tone="subdued">No channel data available for this period.</Text>
                  )}
                </BlockStack>
              )}
              {selectedTab === 2 && (
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h3">Sales by Country</Text>
                  {countryRows.length > 0 ? (
                    <DataTable
                      columnContentTypes={["text", "numeric", "numeric"]}
                      headings={["Country", "Revenue", "Orders"]}
                      rows={countryRows}
                    />
                  ) : (
                    <Text as="p" tone="subdued">No geographic data available for this period.</Text>
                  )}
                </BlockStack>
              )}
              {selectedTab === 3 && (
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h3">Discount Impact Over Time</Text>
                  <SalesChart data={data.discountImpact} loading={false} showDiscounts />
                </BlockStack>
              )}
            </Box>
          </Tabs>
        </Card>

      </BlockStack>
    </Page>
  );
}