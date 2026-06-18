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
  Tabs,
  Box,
  Select,
  Badge,
  Avatar,
  ResourceList,
  ResourceItem,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { runShopifyQL } from "../services/shopifyql.server";
import { getTopCustomers } from "../services/customers.server";
import { generateCustomerInsight } from "../services/ai.server";
import { KpiCard } from "../components/kpi-card/KpiCard";
import { InsightCard } from "../components/insight-card/InsightCard";
import { SalesChart } from "../components/charts/SalesChart";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const since = url.searchParams.get("since") || "last_30_days";

  const [
    overviewResult,
    newVsReturningResult,
    byCountryResult,
    acquisitionTrendResult,
    topCustomersResult,
    cohortResult,
  ] = await Promise.allSettled([
    runShopifyQL(admin, `
      FROM customers
      SHOW customer_count, total_spent
      SINCE ${since}
    `),
    runShopifyQL(admin, `
      FROM customers
      SHOW customer_count, total_spent
      GROUP BY customer_type
      SINCE ${since}
    `),
    runShopifyQL(admin, `
      FROM customers
      SHOW customer_count
      GROUP BY billing_country
      SINCE ${since}
      ORDER BY customer_count DESC
      LIMIT 15
    `),
    runShopifyQL(admin, `
      FROM customers
      SHOW customer_count
      GROUP BY customer_type
      TIMESERIES month
      SINCE last_year
      ORDER BY month ASC
    `),
    getTopCustomers(admin, 20),
    runShopifyQL(admin, `
      FROM customers
      SHOW customer_count, total_spent
      TIMESERIES month
      SINCE last_year
      ORDER BY month ASC
    `),
  ]);

  const overview = overviewResult.status === "fulfilled" ? overviewResult.value?.rows?.[0] : null;
  const newVsReturning = newVsReturningResult.status === "fulfilled" ? newVsReturningResult.value?.rows ?? [] : [];
  const byCountry = byCountryResult.status === "fulfilled" ? byCountryResult.value?.rows ?? [] : [];
  const acquisitionTrend = acquisitionTrendResult.status === "fulfilled" ? acquisitionTrendResult.value?.rows ?? [] : [];
  const topCustomers = topCustomersResult.status === "fulfilled" ? topCustomersResult.value ?? [] : [];
  const cohort = cohortResult.status === "fulfilled" ? cohortResult.value?.rows ?? [] : [];

  const newCustomers = newVsReturning.find((r: any) => r.customer_type === "new");
  const returningCustomers = newVsReturning.find((r: any) => r.customer_type === "returning");

  let aiInsight = null;
  try {
    aiInsight = await generateCustomerInsight(session.shop, {
      overview,
      newCustomers,
      returningCustomers,
      topCountry: byCountry[0],
    });
  } catch (e) {}

  return json({
    overview,
    newCustomers,
    returningCustomers,
    byCountry,
    acquisitionTrend,
    topCustomers,
    cohort,
    aiInsight,
    since,
  });
};

export default function CustomersPage() {
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
    { id: "overview", content: "Overview" },
    { id: "new-vs-returning", content: "New vs Returning" },
    { id: "geography", content: "Geography" },
    { id: "top-customers", content: "Top Customers" },
    { id: "acquisition", content: "Acquisition Trend" },
  ];

  const totalCustomers = parseInt(data.overview?.customer_count ?? "0");
  const newCount = parseInt(data.newCustomers?.customer_count ?? "0");
  const returningCount = parseInt(data.returningCustomers?.customer_count ?? "0");
  const retentionRate = totalCustomers > 0 ? ((returningCount / totalCustomers) * 100).toFixed(1) : "0";

  const countryRows = data.byCountry.map((row: any) => [
    row.billing_country || "Unknown",
    row.customer_count || "0",
    `${totalCustomers > 0 ? ((parseInt(row.customer_count) / totalCustomers) * 100).toFixed(1) : 0}%`,
  ]);

  const topCustomerRows = data.topCustomers.map((c: any) => [
    `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.email || "Unknown",
    c.email || "—",
    c.ordersCount?.toString() || "0",
    `$${parseFloat(c.totalSpent?.amount ?? "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
  ]);

  return (
    <Page title="Customer Insights" subtitle="Understand your customer base and retention">
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
          <InsightCard title="🤖 Customer Insight" content={data.aiInsight} tone="info" />
        )}

        {/* KPIs */}
        <InlineGrid columns={{ xs: 2, md: 4 }} gap="400">
          <KpiCard title="Total Customers" value={totalCustomers.toLocaleString()} change={null} changeLabel={since.replace(/_/g, " ")} />
          <KpiCard title="New Customers" value={newCount.toLocaleString()} change={null} changeLabel={since.replace(/_/g, " ")} />
          <KpiCard title="Returning Customers" value={returningCount.toLocaleString()} change={null} changeLabel={since.replace(/_/g, " ")} />
          <KpiCard title="Retention Rate" value={`${retentionRate}%`} change={null} changeLabel="returning / total" />
        </InlineGrid>

        {/* Tabs */}
        <Card>
          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
            <Box paddingBlockStart="400">
              {selectedTab === 0 && (
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h3">Customer Overview</Text>
                  <SalesChart data={data.cohort} loading={false} valueKey="customer_count" label="Customers" />
                </BlockStack>
              )}
              {selectedTab === 1 && (
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h3">New vs Returning Customers</Text>
                  <InlineGrid columns={2} gap="400">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="200">
                        <Text variant="headingLg" as="p" alignment="center">{newCount.toLocaleString()}</Text>
                        <Text variant="bodyMd" as="p" alignment="center" tone="subdued">New Customers</Text>
                        <Text variant="bodyMd" as="p" alignment="center">
                          {totalCustomers > 0 ? ((newCount / totalCustomers) * 100).toFixed(1) : 0}% of total
                        </Text>
                      </BlockStack>
                    </Card>
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="200">
                        <Text variant="headingLg" as="p" alignment="center">{returningCount.toLocaleString()}</Text>
                        <Text variant="bodyMd" as="p" alignment="center" tone="subdued">Returning Customers</Text>
                        <Text variant="bodyMd" as="p" alignment="center">
                          {retentionRate}% retention rate
                        </Text>
                      </BlockStack>
                    </Card>
                  </InlineGrid>
                  <SalesChart data={data.acquisitionTrend} loading={false} valueKey="customer_count" label="Customers" />
                </BlockStack>
              )}
              {selectedTab === 2 && (
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h3">Customers by Country</Text>
                  {countryRows.length > 0 ? (
                    <DataTable
                      columnContentTypes={["text", "numeric", "numeric"]}
                      headings={["Country", "Customers", "% of Total"]}
                      rows={countryRows}
                    />
                  ) : (
                    <Text as="p" tone="subdued">No geographic data available.</Text>
                  )}
                </BlockStack>
              )}
              {selectedTab === 3 && (
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h3">Top Customers by Lifetime Value</Text>
                  {topCustomerRows.length > 0 ? (
                    <DataTable
                      columnContentTypes={["text", "text", "numeric", "numeric"]}
                      headings={["Name", "Email", "Orders", "Total Spent"]}
                      rows={topCustomerRows}
                    />
                  ) : (
                    <Text as="p" tone="subdued">No customer data available.</Text>
                  )}
                </BlockStack>
              )}
              {selectedTab === 4 && (
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h3">Customer Acquisition Trend (Last 12 Months)</Text>
                  <SalesChart data={data.acquisitionTrend} loading={false} valueKey="customer_count" label="New Customers" />
                </BlockStack>
              )}
            </Box>
          </Tabs>
        </Card>

      </BlockStack>
    </Page>
  );
}