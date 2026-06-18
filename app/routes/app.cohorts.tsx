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
  Tooltip,
  InlineStack,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { buildCohortData } from "../services/cohorts.server";
import { generateCohortInsight } from "../services/ai.server";
import { KpiCard } from "../components/kpi-card/KpiCard";
import { InsightCard } from "../components/insight-card/InsightCard";
import { SalesChart } from "../components/charts/SalesChart";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const cohortData = await buildCohortData(admin);

  let aiInsight = null;
  try {
    aiInsight = await generateCohortInsight(session.shop, {
      avgRetentionM1: cohortData.avgRetentionM1,
      avgRetentionM3: cohortData.avgRetentionM3,
      bestCohort: cohortData.bestCohort,
      worstCohort: cohortData.worstCohort,
    });
  } catch (e) {}

  return json({ cohortData, aiInsight });
};

// Color scale from red → yellow → green based on retention %
function retentionColor(pct: number | null): string {
  if (pct === null) return "#f4f6f8";
  if (pct >= 40) return "#aee9d1";
  if (pct >= 25) return "#ffd79d";
  if (pct >= 10) return "#ffc58b";
  if (pct > 0) return "#fead9a";
  return "#f4f6f8";
}

function retentionTextColor(pct: number | null): string {
  if (pct === null) return "#8c9196";
  if (pct >= 25) return "#1a4731";
  return "#4a1504";
}

export default function CohortsPage() {
  const { cohortData, aiInsight } = useLoaderData<typeof loader>();

  const {
    cohorts,
    avgRetentionM1,
    avgRetentionM3,
    avgRetentionM6,
    bestCohort,
    worstCohort,
    revenuePerCohort,
    totalCohorts,
  } = cohortData;

  // Max months to show across all cohorts
  const maxMonths = cohorts.length > 0
    ? Math.max(...cohorts.map((c: any) => c.retention.length))
    : 0;

  return (
    <Page
      title="Cohort Retention Analysis"
      subtitle="Track how well you retain customers acquired each month"
    >
      <BlockStack gap="500">

        {/* AI Insight */}
        {aiInsight && (
          <InsightCard title="🤖 Retention Insight" content={aiInsight} tone="info" />
        )}

        {/* KPIs */}
        <InlineGrid columns={{ xs: 2, md: 4 }} gap="400">
          <KpiCard
            title="Avg M+1 Retention"
            value={avgRetentionM1 !== null ? `${avgRetentionM1.toFixed(1)}%` : "N/A"}
            change={null}
            changeLabel="customers who bought again in month 1"
          />
          <KpiCard
            title="Avg M+3 Retention"
            value={avgRetentionM3 !== null ? `${avgRetentionM3.toFixed(1)}%` : "N/A"}
            change={null}
            changeLabel="customers who bought again in month 3"
          />
          <KpiCard
            title="Avg M+6 Retention"
            value={avgRetentionM6 !== null ? `${avgRetentionM6.toFixed(1)}%` : "N/A"}
            change={null}
            changeLabel="customers who bought again in month 6"
          />
          <KpiCard
            title="Cohorts Analyzed"
            value={totalCohorts.toString()}
            change={null}
            changeLabel="monthly acquisition cohorts"
          />
        </InlineGrid>

        {/* Best / Worst Cohort */}
        {(bestCohort || worstCohort) && (
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            {bestCohort && (
              <Card>
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text variant="headingMd" as="h3">🏆 Best Performing Cohort</Text>
                    <Badge tone="success">Top Retention</Badge>
                  </InlineStack>
                  <Text variant="headingXl" as="p">{bestCohort.label}</Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    {bestCohort.initialCustomers} customers acquired · {bestCohort.m1Retention?.toFixed(1)}% returned in M+1
                  </Text>
                </BlockStack>
              </Card>
            )}
            {worstCohort && (
              <Card>
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text variant="headingMd" as="h3">📉 Lowest Retention Cohort</Text>
                    <Badge tone="warning">Needs Attention</Badge>
                  </InlineStack>
                  <Text variant="headingXl" as="p">{worstCohort.label}</Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    {worstCohort.initialCustomers} customers acquired · {worstCohort.m1Retention?.toFixed(1)}% returned in M+1
                  </Text>
                </BlockStack>
              </Card>
            )}
          </InlineGrid>
        )}

        {/* Cohort Heatmap Table */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">Retention Heatmap</Text>
            <Text variant="bodySm" as="p" tone="subdued">
              Each row is a monthly acquisition cohort. Columns show what % of that cohort made another purchase in subsequent months.
              <strong> Green = high retention, Red = low retention, Grey = not enough data yet.</strong>
            </Text>
            <Divider />

            {cohorts.length === 0 ? (
              <Banner tone="info">
                <p>Not enough order history to build cohort analysis. You need at least 2 months of order data.</p>
              </Banner>
            ) : (
              <Box overflowX="auto">
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px" }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "8px 12px", textAlign: "left", background: "#f6f6f7", borderBottom: "2px solid #e1e3e5", whiteSpace: "nowrap", minWidth: "120px" }}>
                        Cohort
                      </th>
                      <th style={{ padding: "8px 12px", textAlign: "center", background: "#f6f6f7", borderBottom: "2px solid #e1e3e5", whiteSpace: "nowrap" }}>
                        Customers
                      </th>
                      {Array.from({ length: maxMonths }, (_, i) => (
                        <th key={i} style={{ padding: "8px 10px", textAlign: "center", background: "#f6f6f7", borderBottom: "2px solid #e1e3e5", whiteSpace: "nowrap", minWidth: "60px" }}>
                          M+{i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cohorts.map((cohort: any, rowIdx: number) => (
                      <tr key={cohort.label} style={{ borderBottom: "1px solid #e1e3e5" }}>
                        <td style={{ padding: "8px 12px", fontWeight: "600", whiteSpace: "nowrap", background: rowIdx % 2 === 0 ? "#fff" : "#fafbfb" }}>
                          {cohort.label}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "center", background: rowIdx % 2 === 0 ? "#fff" : "#fafbfb" }}>
                          {cohort.initialCustomers.toLocaleString()}
                        </td>
                        {Array.from({ length: maxMonths }, (_, colIdx) => {
                          const pct = cohort.retention[colIdx] ?? null;
                          const bg = retentionColor(pct);
                          const color = retentionTextColor(pct);
                          return (
                            <td
                              key={colIdx}
                              style={{
                                padding: "8px 10px",
                                textAlign: "center",
                                background: bg,
                                color,
                                fontWeight: pct !== null ? "600" : "400",
                                borderLeft: "1px solid #e1e3e5",
                              }}
                            >
                              {pct !== null ? `${pct.toFixed(1)}%` : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            )}
          </BlockStack>
        </Card>

        {/* Revenue per Cohort Chart */}
        {revenuePerCohort.length > 0 && (
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">Revenue by Acquisition Cohort</Text>
              <Text variant="bodySm" as="p" tone="subdued">
                Total revenue generated by customers from each monthly cohort over their lifetime.
              </Text>
              <SalesChart
                data={revenuePerCohort}
                loading={false}
                valueKey="total_revenue"
                label="Cohort Revenue"
              />
            </BlockStack>
          </Card>
        )}

        {/* How to Improve Banner */}
        <Banner tone="info" title="How to improve retention">
          <p>
            Focus on post-purchase email flows, loyalty programs, and personalized re-engagement campaigns
            for cohorts with M+1 retention below 15%. Even a 5% improvement in retention can significantly
            increase customer lifetime value.
          </p>
        </Banner>

      </BlockStack>
    </Page>
  );
}