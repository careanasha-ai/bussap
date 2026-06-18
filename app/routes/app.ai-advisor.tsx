import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useRevalidator } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  Badge,
  Button,
  Divider,
  Box,
  Banner,
  Spinner,
  Icon,
  InlineStack,
} from "@shopify/polaris";
import {
  RefreshIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  InfoIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { runShopifyQL } from "../services/shopifyql.server";
import { generateFullAdvisorReport } from "../services/ai.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Gather comprehensive store data for AI analysis
  const [
    salesLast30Result,
    salesLast7Result,
    topProductsResult,
    customerOverviewResult,
    sessionsResult,
    inventoryResult,
  ] = await Promise.allSettled([
    runShopifyQL(admin, `
      FROM sales
      SHOW total_sales, net_sales, orders, average_order_value, discounts, returns
      SINCE last_30_days
      WITH PERCENT_CHANGE
      COMPARE TO previous_period
    `),
    runShopifyQL(admin, `
      FROM sales
      SHOW total_sales, orders
      TIMESERIES day
      SINCE last_7_days
      ORDER BY day ASC
    `),
    runShopifyQL(admin, `
      FROM sales
      SHOW total_sales, units_sold, product_title
      GROUP BY product_title
      SINCE last_30_days
      ORDER BY total_sales DESC
      LIMIT 5
    `),
    runShopifyQL(admin, `
      FROM customers
      SHOW customer_count, total_spent
      GROUP BY customer_type
      SINCE last_30_days
    `),
    runShopifyQL(admin, `
      FROM sessions
      SHOW sessions, conversion_rate, bounce_rate
      SINCE last_30_days
    `),
    runShopifyQL(admin, `
      FROM sales
      SHOW total_sales, units_sold, product_title
      GROUP BY product_title
      SINCE last_30_days
      ORDER BY units_sold ASC
      LIMIT 5
    `),
  ]);

  const salesLast30 = salesLast30Result.status === "fulfilled" ? salesLast30Result.value?.rows?.[0] : null;
  const salesLast7 = salesLast7Result.status === "fulfilled" ? salesLast7Result.value?.rows ?? [] : [];
  const topProducts = topProductsResult.status === "fulfilled" ? topProductsResult.value?.rows ?? [] : [];
  const customerOverview = customerOverviewResult.status === "fulfilled" ? customerOverviewResult.value?.rows ?? [] : [];
  const sessions = sessionsResult.status === "fulfilled" ? sessionsResult.value?.rows?.[0] : null;
  const slowMovers = inventoryResult.status === "fulfilled" ? inventoryResult.value?.rows ?? [] : [];

  let advisorReport = null;
  try {
    advisorReport = await generateFullAdvisorReport(session.shop, {
      salesLast30,
      salesLast7,
      topProducts,
      customerOverview,
      sessions,
      slowMovers,
    });
  } catch (e) {
    advisorReport = {
      summary: "AI Advisor is temporarily unavailable. Please check your OpenAI API key configuration.",
      insights: [],
      opportunities: [],
      warnings: [],
    };
  }

  return json({ advisorReport, shop: session.shop });
};

type InsightItem = {
  title: string;
  description: string;
  action?: string;
};

type AdvisorReport = {
  summary: string;
  insights: InsightItem[];
  opportunities: InsightItem[];
  warnings: InsightItem[];
};

function InsightSection({
  title,
  items,
  tone,
  icon,
}: {
  title: string;
  items: InsightItem[];
  tone: "success" | "warning" | "critical" | "info";
  icon: string;
}) {
  if (!items || items.length === 0) return null;

  const toneMap: Record<string, "success" | "warning" | "critical" | "info"> = {
    success: "success",
    warning: "warning",
    critical: "critical",
    info: "info",
  };

  return (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd" as="h3">{icon} {title}</Text>
        <Divider />
        {items.map((item, i) => (
          <Box key={i} padding="300" background="bg-surface-secondary" borderRadius="200">
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text variant="bodyMd" as="p" fontWeight="semibold">{item.title}</Text>
                <Badge tone={toneMap[tone]}>{tone}</Badge>
              </InlineStack>
              <Text variant="bodyMd" as="p">{item.description}</Text>
              {item.action && (
                <Text variant="bodySm" as="p" tone="subdued">
                  💡 <strong>Action:</strong> {item.action}
                </Text>
              )}
            </BlockStack>
          </Box>
        ))}
      </BlockStack>
    </Card>
  );
}

export default function AiAdvisorPage() {
  const { advisorReport, shop } = useLoaderData<typeof loader>();
  const { revalidate, state } = useRevalidator();
  const isLoading = state === "loading";

  const report = advisorReport as AdvisorReport | null;

  return (
    <Page
      title="🤖 AI Advisor"
      subtitle="AI-powered insights and recommendations for your store"
      primaryAction={
        <Button icon={RefreshIcon} onClick={revalidate} loading={isLoading}>
          Refresh Insights
        </Button>
      }
    >
      <BlockStack gap="500">

        {isLoading && (
          <Card>
            <BlockStack gap="300" align="center">
              <Spinner size="large" />
              <Text variant="bodyMd" as="p" alignment="center">
                Analyzing your store data with AI...
              </Text>
            </BlockStack>
          </Card>
        )}

        {!isLoading && report && (
          <>
            {/* Executive Summary */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h2">📋 Executive Summary</Text>
                  <Badge tone="info">AI Generated</Badge>
                </InlineStack>
                <Divider />
                <Text variant="bodyMd" as="p">{report.summary}</Text>
              </BlockStack>
            </Card>

            {/* Warnings */}
            <InsightSection
              title="Warnings & Issues"
              items={report.warnings}
              tone="warning"
              icon="⚠️"
            />

            {/* Opportunities */}
            <InsightSection
              title="Growth Opportunities"
              items={report.opportunities}
              tone="success"
              icon="🚀"
            />

            {/* Insights */}
            <InsightSection
              title="Key Insights"
              items={report.insights}
              tone="info"
              icon="💡"
            />

            {/* Disclaimer */}
            <Banner tone="info">
              <p>
                AI insights are generated based on your store's recent data and are meant to guide decision-making.
                Always validate recommendations against your business context before acting.
              </p>
            </Banner>
          </>
        )}

        {!isLoading && !report && (
          <Banner tone="warning" title="AI Advisor Unavailable">
            <p>
              Could not generate AI insights. Please ensure your OpenAI API key is configured correctly
              in your environment settings.
            </p>
          </Banner>
        )}

      </BlockStack>
    </Page>
  );
}