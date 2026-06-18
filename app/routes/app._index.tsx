import { useState } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useRevalidator } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  Badge,
  Button,
  Divider,
  Banner,
  Spinner,
  Box,
  InlineStack,
  Icon,
} from "@shopify/polaris";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  RefreshIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { runShopifyQL } from "../services/shopifyql.server";
import { generateDailyInsight } from "../services/ai.server";
import { KpiCard } from "../components/kpi-card/KpiCard";
import { SalesChart } from "../components/charts/SalesChart";
import { TopProductsChart } from "../components/charts/TopProductsChart";
import { InsightCard } from "../components/insight-card/InsightCard";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Fetch KPI data in parallel
  const [
    salesTodayResult,
    salesYesterdayResult,
    salesLast30Result,
    topProductsResult,
    sessionsResult,
    newCustomersResult,
  ] = await Promise.allSettled([
    // Today's sales
    runShopifyQL(admin, `
      FROM sales
      SHOW total_sales, orders, average_order_value
      SINCE today
    `),
    // Yesterday's sales
    runShopifyQL(admin, `
      FROM sales
      SHOW total_sales, orders, average_order_value
      SINCE yesterday UNTIL yesterday
    `),
    // Last 30 days trend
    runShopifyQL(admin, `
      FROM sales
      SHOW total_sales, orders
      TIMESERIES day
      SINCE last_30_days
      ORDER BY day ASC
    `),
    // Top products this month
    runShopifyQL(admin, `
      FROM sales
      SHOW total_sales, units_sold, product_title
      GROUP BY product_title
      SINCE this_month
      ORDER BY total_sales DESC
      LIMIT 10
    `),
    // Sessions today
    runShopifyQL(admin, `
      FROM sessions
      SHOW sessions, conversion_rate
      SINCE today
    `),
    // New customers this month
    runShopifyQL(admin, `
      FROM customers
      SHOW customer_count
      WHERE customer_type = 'new'
      SINCE this_month
    `),
  ]);

  const salesToday = salesTodayResult.status === "fulfilled" ? salesTodayResult.value : null;
  const salesYesterday = salesYesterdayResult.status === "fulfilled" ? salesYesterdayResult.value : null;
  const salesLast30 = salesLast30Result.status === "fulfilled" ? salesLast30Result.value : null;
  const topProducts = topProductsResult.status === "fulfilled" ? topProductsResult.value : null;
  const sessions = sessionsResult.status === "fulfilled" ? sessionsResult.value : null;
  const newCustomers = newCustomersResult.status === "fulfilled" ? newCustomersResult.value : null;

  // Generate AI insight (cached for 6 hours)
  let aiInsight = null;
  try {
    aiInsight = await generateDailyInsight(session.shop, {
      salesToday: salesToday?.rows?.[0],
      salesYesterday: salesYesterday?.rows?.[0],
      topProduct: topProducts?.rows?.[0],
      sessions: sessions?.rows?.[0],
    });
  } catch (e) {
    // AI insight is non-critical
  }

  return json({
    salesToday: salesToday?.rows?.[0] ?? null,
    salesYesterday: salesYesterday?.rows?.[0] ?? null,
    salesLast30: salesLast30?.rows ?? [],
    topProducts: topProducts?.rows ?? [],
    sessions: sessions?.rows?.[0] ?? null,
    newCustomers: newCustomers?.rows?.[0] ?? null,
    aiInsight,
    shop: session.shop,
  });
};

export default function Dashboard() {
  const data = useLoaderData<typeof loader>();
  const { revalidate, state } = useRevalidator();
  const isLoading = state === "loading";

  const todaySales = parseFloat(data.salesToday?.total_sales ?? "0");
  const yesterdaySales = parseFloat(data.salesYesterday?.total_sales ?? "0");
  const salesChange = yesterdaySales > 0
    ? ((todaySales - yesterdaySales) / yesterdaySales) * 100
    : 0;

  const todayOrders = parseInt(data.salesToday?.orders ?? "0");
  const yesterdayOrders = parseInt(data.salesYesterday?.orders ?? "0");
  const ordersChange = yesterdayOrders > 0
    ? ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100
    : 0;

  const todayAOV = parseFloat(data.salesToday?.average_order_value ?? "0");
  const yesterdayAOV = parseFloat(data.salesYesterday?.average_order_value ?? "0");
  const aovChange = yesterdayAOV > 0
    ? ((todayAOV - yesterdayAOV) / yesterdayAOV) * 100
    : 0;

  const conversionRate = parseFloat(data.sessions?.conversion_rate ?? "0");

  return (
    <Page
      title="Dashboard"
      subtitle={`Welcome back! Here's what's happening at ${data.shop}`}
      primaryAction={
        <Button
          icon={RefreshIcon}
          onClick={revalidate}
          loading={isLoading}
        >
          Refresh
        </Button>
      }
    >
      <BlockStack gap="500">

        {/* AI Insight Banner */}
        {data.aiInsight && (
          <InsightCard
            title="🤖 Today's AI Insight"
            content={data.aiInsight}
            tone="info"
          />
        )}

        {/* KPI Cards */}
        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <KpiCard
            title="Today's Revenue"
            value={`$${todaySales.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            change={salesChange}
            changeLabel="vs yesterday"
            loading={isLoading}
          />
          <KpiCard
            title="Orders Today"
            value={todayOrders.toString()}
            change={ordersChange}
            changeLabel="vs yesterday"
            loading={isLoading}
          />
          <KpiCard
            title="Avg. Order Value"
            value={`$${todayAOV.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            change={aovChange}
            changeLabel="vs yesterday"
            loading={isLoading}
          />
          <KpiCard
            title="Conversion Rate"
            value={`${conversionRate.toFixed(2)}%`}
            change={null}
            changeLabel="today"
            loading={isLoading}
          />
        </InlineGrid>

        {/* Charts Row */}
        <InlineGrid columns={{ xs: 1, md: "2fr 1fr" }} gap="400">
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">Revenue — Last 30 Days</Text>
              <SalesChart data={data.salesLast30} loading={isLoading} />
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">Top Products This Month</Text>
              <TopProductsChart data={data.topProducts} loading={isLoading} />
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* Quick Links */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">Explore More</Text>
            <Divider />
            <InlineGrid columns={{ xs: 2, md: 5 }} gap="300">
              <Button url="/app/sales" variant="secondary">📈 Sales</Button>
              <Button url="/app/products" variant="secondary">📦 Products</Button>
              <Button url="/app/customers" variant="secondary">👥 Customers</Button>
              <Button url="/app/cohorts" variant="secondary">🔄 Cohort Retention</Button>
              <Button url="/app/forecast" variant="secondary">🔮 Revenue Forecast</Button>
              <Button url="/app/inventory" variant="secondary">🏭 Inventory</Button>
              <Button url="/app/promotions" variant="secondary">🏷️ Promotions</Button>
              <Button url="/app/ai-advisor" variant="secondary">🤖 AI Advisor</Button>
              <Button url="/app/billing" variant="secondary">💳 Plans &amp; Billing</Button>
              <Button url="/app/settings" variant="secondary">⚙️ Settings</Button>
            </InlineGrid>
          </BlockStack>
        </Card>

      </BlockStack>
    </Page>
  );
}