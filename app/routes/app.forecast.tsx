import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  Box,
  Divider,
  Banner,
  Badge,
  InlineStack,
  DataTable,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { runShopifyQL } from "../services/shopifyql.server";
import { buildForecast } from "../services/forecast.server";
import { generateForecastInsight } from "../services/ai.server";
import { KpiCard } from "../components/kpi-card/KpiCard";
import { InsightCard } from "../components/insight-card/InsightCard";
import { ForecastChart } from "../components/charts/ForecastChart";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Fetch 12 months of historical daily sales for forecasting
  const [historicalResult, monthlyResult] = await Promise.allSettled([
    runShopifyQL(admin, `
      FROM sales
      SHOW total_sales, orders
      TIMESERIES day
      SINCE last_year
      ORDER BY day ASC
    `),
    runShopifyQL(admin, `
      FROM sales
      SHOW total_sales, orders, average_order_value
      TIMESERIES month
      SINCE last_year
      ORDER BY month ASC
    `),
  ]);

  const historicalDaily = historicalResult.status === "fulfilled"
    ? historicalResult.value?.rows ?? []
    : [];

  const historicalMonthly = monthlyResult.status === "fulfilled"
    ? monthlyResult.value?.rows ?? []
    : [];

  // Build forecast
  const forecast = buildForecast(historicalDaily, historicalMonthly);

  let aiInsight = null;
  try {
    aiInsight = await generateForecastInsight(session.shop, {
      forecast30: forecast.next30Days,
      forecast90: forecast.next90Days,
      trend: forecast.trend,
      avgMonthlyRevenue: forecast.avgMonthlyRevenue,
    });
  } catch (e) {}

  return json({ forecast, historicalMonthly, aiInsight });
};

export default function ForecastPage() {
  const { forecast, historicalMonthly, aiInsight } = useLoaderData<typeof loader>();

  const trendBadge = forecast.trend === "up"
    ? <Badge tone="success">📈 Upward Trend</Badge>
    : forecast.trend === "down"
    ? <Badge tone="critical">📉 Downward Trend</Badge>
    : <Badge tone="info">➡️ Stable Trend</Badge>;

  const forecastTableRows = forecast.monthlyForecast.map((m: any) => [
    m.label,
    `$${parseFloat(m.low).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    `$${parseFloat(m.mid).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    `$${parseFloat(m.high).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
  ]);

  return (
    <Page
      title="Revenue Forecasting"
      subtitle="AI-powered revenue projections based on your historical trends"
    >
      <BlockStack gap="500">

        {/* AI Insight */}
        {aiInsight && (
          <InsightCard title="🤖 Forecast Insight" content={aiInsight} tone="info" />
        )}

        {/* Trend + KPIs */}
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text variant="headingMd" as="h2">Revenue Trend</Text>
              {trendBadge}
            </InlineStack>
            <Text variant="bodySm" as="p" tone="subdued">
              Based on {forecast.dataPointsUsed} days of historical data
            </Text>
          </BlockStack>
        </Card>

        <InlineGrid columns={{ xs: 2, md: 4 }} gap="400">
          <KpiCard
            title="Next 30 Days (Mid)"
            value={`$${parseFloat(forecast.next30Days.mid).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            change={null}
            changeLabel={`$${parseFloat(forecast.next30Days.low).toLocaleString("en-US", { minimumFractionDigits: 0 })} – $${parseFloat(forecast.next30Days.high).toLocaleString("en-US", { minimumFractionDigits: 0 })} range`}
          />
          <KpiCard
            title="Next 60 Days (Mid)"
            value={`$${parseFloat(forecast.next60Days.mid).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            change={null}
            changeLabel={`$${parseFloat(forecast.next60Days.low).toLocaleString("en-US", { minimumFractionDigits: 0 })} – $${parseFloat(forecast.next60Days.high).toLocaleString("en-US", { minimumFractionDigits: 0 })} range`}
          />
          <KpiCard
            title="Next 90 Days (Mid)"
            value={`$${parseFloat(forecast.next90Days.mid).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            change={null}
            changeLabel={`$${parseFloat(forecast.next90Days.low).toLocaleString("en-US", { minimumFractionDigits: 0 })} – $${parseFloat(forecast.next90Days.high).toLocaleString("en-US", { minimumFractionDigits: 0 })} range`}
          />
          <KpiCard
            title="Avg Monthly Revenue"
            value={`$${parseFloat(forecast.avgMonthlyRevenue).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            change={null}
            changeLabel="last 12 months average"
          />
        </InlineGrid>

        {/* Forecast Chart */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">Historical + Forecast Chart</Text>
            <Text variant="bodySm" as="p" tone="subdued">
              Solid line = actual revenue. Dashed area = forecast range (low / mid / high).
            </Text>
            <Divider />
            <ForecastChart
              historical={historicalMonthly}
              forecast={forecast.monthlyForecast}
            />
          </BlockStack>
        </Card>

        {/* Monthly Forecast Table */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">Monthly Forecast Breakdown</Text>
            <Text variant="bodySm" as="p" tone="subdued">
              Low = conservative estimate · Mid = most likely · High = optimistic scenario
            </Text>
            <Divider />
            {forecastTableRows.length > 0 ? (
              <DataTable
                columnContentTypes={["text", "numeric", "numeric", "numeric"]}
                headings={["Month", "Low Estimate", "Mid Estimate", "High Estimate"]}
                rows={forecastTableRows}
              />
            ) : (
              <Banner tone="info">
                <p>Not enough historical data to generate a forecast. You need at least 3 months of sales data.</p>
              </Banner>
            )}
          </BlockStack>
        </Card>

        {/* Methodology Note */}
        <Banner tone="info" title="How forecasting works">
          <p>
            Crestline uses a weighted moving average with trend detection and seasonal adjustment
            based on your store's historical daily and monthly revenue patterns.
            Forecasts become more accurate with more historical data.
            Always use forecasts as a guide, not a guarantee.
          </p>
        </Banner>

      </BlockStack>
    </Page>
  );
}