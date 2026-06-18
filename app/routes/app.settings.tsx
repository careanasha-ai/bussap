import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useSearchParams } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  TextField,
  Select,
  Button,
  Divider,
  Box,
  Banner,
  Badge,
  Tabs,
  InlineStack,
  Checkbox,
  Tag,
  Layout,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getOrCreateSettings, getShopPlan, PLANS, type PlanKey } from "../services/billing.server";
import { sendEmailReport, getEmailReportHistory } from "../services/email.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const [settings, currentPlan, emailHistory] = await Promise.all([
    getOrCreateSettings(session.shop),
    getShopPlan(session.shop),
    getEmailReportHistory(session.shop),
  ]);

  return json({ settings, currentPlan, emailHistory, shop: session.shop });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "save_settings") {
    const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
    if (!shop) return json({ error: "Shop not found." });

    const emailReportsEnabled = formData.get("emailReportsEnabled") === "true";
    const emailReportFrequency = formData.get("emailReportFrequency") as string;
    const emailReportDay = parseInt(formData.get("emailReportDay") as string || "1");
    const emailReportRecipients = (formData.get("emailReportRecipients") as string)
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));
    const defaultDateRange = formData.get("defaultDateRange") as string;
    const timezone = formData.get("timezone") as string;
    const aiInsightsEnabled = formData.get("aiInsightsEnabled") === "true";
    const aiAdvisorEnabled = formData.get("aiAdvisorEnabled") === "true";
    const lowStockThreshold = parseInt(formData.get("lowStockThreshold") as string || "10");

    await prisma.shopSettings.upsert({
      where: { shopId: shop.id },
      create: {
        shopId: shop.id,
        emailReportsEnabled,
        emailReportFrequency,
        emailReportDay,
        emailReportRecipients,
        defaultDateRange,
        timezone,
        aiInsightsEnabled,
        aiAdvisorEnabled,
        lowStockThreshold,
      },
      update: {
        emailReportsEnabled,
        emailReportFrequency,
        emailReportDay,
        emailReportRecipients,
        defaultDateRange,
        timezone,
        aiInsightsEnabled,
        aiAdvisorEnabled,
        lowStockThreshold,
      },
    });

    return json({ success: "Settings saved successfully." });
  }

  if (intent === "send_test_report") {
    const reportType = formData.get("reportType") as "weekly" | "monthly";
    const result = await sendEmailReport(admin, session.shop, reportType);
    return json(result.success
      ? { success: result.message }
      : { error: result.message }
    );
  }

  return json({ error: "Unknown action." });
};

const TIMEZONE_OPTIONS = [
  { label: "UTC", value: "UTC" },
  { label: "America/New_York (EST)", value: "America/New_York" },
  { label: "America/Chicago (CST)", value: "America/Chicago" },
  { label: "America/Denver (MST)", value: "America/Denver" },
  { label: "America/Los_Angeles (PST)", value: "America/Los_Angeles" },
  { label: "Europe/London (GMT)", value: "Europe/London" },
  { label: "Europe/Paris (CET)", value: "Europe/Paris" },
  { label: "Europe/Berlin (CET)", value: "Europe/Berlin" },
  { label: "Asia/Dubai (GST)", value: "Asia/Dubai" },
  { label: "Asia/Kolkata (IST)", value: "Asia/Kolkata" },
  { label: "Asia/Singapore (SGT)", value: "Asia/Singapore" },
  { label: "Asia/Tokyo (JST)", value: "Asia/Tokyo" },
  { label: "Australia/Sydney (AEST)", value: "Australia/Sydney" },
];

const DATE_RANGE_OPTIONS = [
  { label: "Last 7 days", value: "last_7_days" },
  { label: "Last 30 days", value: "last_30_days" },
  { label: "This month", value: "this_month" },
  { label: "This quarter", value: "this_quarter" },
  { label: "This year", value: "this_year" },
];

const FREQUENCY_OPTIONS = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];

export default function SettingsPage() {
  const { settings, currentPlan, emailHistory, shop } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<any>();
  const isLoading = fetcher.state !== "idle";
  const [selectedTab, setSelectedTab] = useState(0);

  // Form state
  const [emailEnabled, setEmailEnabled] = useState(settings?.emailReportsEnabled ?? false);
  const [emailFrequency, setEmailFrequency] = useState(settings?.emailReportFrequency ?? "weekly");
  const [emailRecipients, setEmailRecipients] = useState(
    (settings?.emailReportRecipients ?? []).join(", ")
  );
  const [defaultDateRange, setDefaultDateRange] = useState(settings?.defaultDateRange ?? "last_30_days");
  const [timezone, setTimezone] = useState(settings?.timezone ?? "UTC");
  const [aiInsightsEnabled, setAiInsightsEnabled] = useState(settings?.aiInsightsEnabled ?? true);
  const [aiAdvisorEnabled, setAiAdvisorEnabled] = useState(settings?.aiAdvisorEnabled ?? true);
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(settings?.lowStockThreshold ?? 10)
  );

  const planConfig = PLANS[currentPlan as PlanKey];
  const hasEmailReports = planConfig?.limits?.emailReports ?? false;
  const hasAI = planConfig?.limits?.aiInsights ?? false;

  const tabs = [
    { id: "general", content: "General" },
    { id: "email", content: "Email Reports" },
    { id: "ai", content: "AI Settings" },
    { id: "history", content: `Report History (${emailHistory.length})` },
  ];

  const historyRows = emailHistory.map((r: any) => ({
    id: r.id,
    type: r.type,
    sentAt: new Date(r.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    recipients: r.recipients?.join(", ") ?? "—",
    status: r.status,
    subject: r.subject,
  }));

  return (
    <Page title="Settings" subtitle="Configure Crestline for your store">
      <BlockStack gap="500">

        {/* Feedback banners */}
        {fetcher.data?.success && (
          <Banner tone="success">{fetcher.data.success}</Banner>
        )}
        {fetcher.data?.error && (
          <Banner tone="critical">{fetcher.data.error}</Banner>
        )}

        {/* Plan badge */}
        <Card>
          <InlineStack align="space-between">
            <BlockStack gap="100">
              <Text variant="headingMd" as="h2">Current Plan</Text>
              <Text variant="bodySm" as="p" tone="subdued">
                Manage your subscription on the Billing page
              </Text>
            </BlockStack>
            <InlineStack gap="200">
              <Badge tone={currentPlan === "free" ? "subdued" : "success"}>
                {planConfig?.name ?? "Free"}
              </Badge>
              <Button url="/app/billing" variant="secondary" size="slim">
                Manage Plan
              </Button>
            </InlineStack>
          </InlineStack>
        </Card>

        {/* Tabs */}
        <Card>
          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
            <Box paddingBlockStart="400">

              {/* ── GENERAL TAB ── */}
              {selectedTab === 0 && (
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="save_settings" />
                  <input type="hidden" name="emailReportsEnabled" value={String(emailEnabled)} />
                  <input type="hidden" name="aiInsightsEnabled" value={String(aiInsightsEnabled)} />
                  <input type="hidden" name="aiAdvisorEnabled" value={String(aiAdvisorEnabled)} />
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h3">Dashboard Preferences</Text>
                    <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                      <Select
                        label="Default Date Range"
                        options={DATE_RANGE_OPTIONS}
                        value={defaultDateRange}
                        onChange={setDefaultDateRange}
                        name="defaultDateRange"
                        helpText="Applied to all charts and reports by default"
                      />
                      <Select
                        label="Timezone"
                        options={TIMEZONE_OPTIONS}
                        value={timezone}
                        onChange={setTimezone}
                        name="timezone"
                        helpText="Used for date calculations and report scheduling"
                      />
                    </InlineGrid>
                    <TextField
                      label="Low Stock Alert Threshold"
                      type="number"
                      value={lowStockThreshold}
                      onChange={setLowStockThreshold}
                      name="lowStockThreshold"
                      min="1"
                      max="100"
                      helpText="Products with stock at or below this number will trigger low stock alerts"
                      autoComplete="off"
                    />
                    <Box>
                      <Button variant="primary" submit loading={isLoading}>
                        Save Settings
                      </Button>
                    </Box>
                  </BlockStack>
                </fetcher.Form>
              )}

              {/* ── EMAIL REPORTS TAB ── */}
              {selectedTab === 1 && (
                <BlockStack gap="400">
                  {!hasEmailReports && (
                    <Banner tone="warning" title="Email reports require Growth plan or higher">
                      <p>
                        Upgrade your plan to enable automated weekly and monthly email reports.{" "}
                        <a href="/app/billing">View plans →</a>
                      </p>
                    </Banner>
                  )}

                  <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="save_settings" />
                    <input type="hidden" name="aiInsightsEnabled" value={String(aiInsightsEnabled)} />
                    <input type="hidden" name="aiAdvisorEnabled" value={String(aiAdvisorEnabled)} />
                    <input type="hidden" name="defaultDateRange" value={defaultDateRange} />
                    <input type="hidden" name="timezone" value={timezone} />
                    <input type="hidden" name="lowStockThreshold" value={lowStockThreshold} />
                    <input type="hidden" name="emailReportsEnabled" value={String(emailEnabled)} />

                    <BlockStack gap="400">
                      <Checkbox
                        label="Enable email reports"
                        checked={emailEnabled}
                        onChange={setEmailEnabled}
                        disabled={!hasEmailReports}
                        helpText="Automatically send performance reports to your team"
                      />

                      <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                        <Select
                          label="Report Frequency"
                          options={FREQUENCY_OPTIONS}
                          value={emailFrequency}
                          onChange={setEmailFrequency}
                          name="emailReportFrequency"
                          disabled={!emailEnabled || !hasEmailReports}
                        />
                        <TextField
                          label={emailFrequency === "weekly" ? "Send on day (1=Mon, 7=Sun)" : "Send on day of month (1–28)"}
                          type="number"
                          value={String(settings?.emailReportDay ?? 1)}
                          onChange={() => {}}
                          name="emailReportDay"
                          min="1"
                          max={emailFrequency === "weekly" ? "7" : "28"}
                          disabled={!emailEnabled || !hasEmailReports}
                          autoComplete="off"
                        />
                      </InlineGrid>

                      <TextField
                        label="Recipients (comma-separated emails)"
                        value={emailRecipients}
                        onChange={setEmailRecipients}
                        name="emailReportRecipients"
                        placeholder="owner@store.com, manager@store.com"
                        disabled={!emailEnabled || !hasEmailReports}
                        helpText="Reports will be sent to all addresses listed here"
                        autoComplete="off"
                      />

                      <InlineStack gap="300">
                        <Button
                          variant="primary"
                          submit
                          loading={isLoading}
                          disabled={!hasEmailReports}
                        >
                          Save Email Settings
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </fetcher.Form>

                  <Divider />

                  {/* Send test report */}
                  <BlockStack gap="300">
                    <Text variant="headingMd" as="h3">Send Test Report</Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      Send a report right now to verify your email configuration.
                      Requires RESEND_API_KEY to be set in Railway environment variables.
                    </Text>
                    <InlineStack gap="300">
                      <fetcher.Form method="post">
                        <input type="hidden" name="intent" value="send_test_report" />
                        <input type="hidden" name="reportType" value="weekly" />
                        <Button
                          submit
                          loading={isLoading}
                          disabled={!hasEmailReports || !emailEnabled}
                        >
                          Send Weekly Test
                        </Button>
                      </fetcher.Form>
                      <fetcher.Form method="post">
                        <input type="hidden" name="intent" value="send_test_report" />
                        <input type="hidden" name="reportType" value="monthly" />
                        <Button
                          submit
                          loading={isLoading}
                          disabled={!hasEmailReports || !emailEnabled}
                        >
                          Send Monthly Test
                        </Button>
                      </fetcher.Form>
                    </InlineStack>

                    <Banner tone="info">
                      <p>
                        Email delivery uses <strong>Resend</strong> (resend.com).
                        Add <code>RESEND_API_KEY</code> and <code>EMAIL_FROM</code> to your Railway environment variables.
                        Free tier: 3,000 emails/month.
                      </p>
                    </Banner>
                  </BlockStack>
                </BlockStack>
              )}

              {/* ── AI SETTINGS TAB ── */}
              {selectedTab === 2 && (
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="save_settings" />
                  <input type="hidden" name="emailReportsEnabled" value={String(emailEnabled)} />
                  <input type="hidden" name="emailReportFrequency" value={emailFrequency} />
                  <input type="hidden" name="emailReportRecipients" value={emailRecipients} />
                  <input type="hidden" name="defaultDateRange" value={defaultDateRange} />
                  <input type="hidden" name="timezone" value={timezone} />
                  <input type="hidden" name="lowStockThreshold" value={lowStockThreshold} />
                  <input type="hidden" name="aiInsightsEnabled" value={String(aiInsightsEnabled)} />
                  <input type="hidden" name="aiAdvisorEnabled" value={String(aiAdvisorEnabled)} />

                  <BlockStack gap="400">
                    {!hasAI && (
                      <Banner tone="warning" title="AI features require Growth plan or higher">
                        <p>
                          Upgrade to unlock AI-powered insights and recommendations.{" "}
                          <a href="/app/billing">View plans →</a>
                        </p>
                      </Banner>
                    )}

                    <Text variant="headingMd" as="h3">AI Feature Controls</Text>

                    <Checkbox
                      label="Enable AI insight cards"
                      checked={aiInsightsEnabled}
                      onChange={setAiInsightsEnabled}
                      disabled={!hasAI}
                      helpText="Show AI-generated insight banners on each analytics page"
                    />

                    <Checkbox
                      label="Enable AI Advisor"
                      checked={aiAdvisorEnabled}
                      onChange={setAiAdvisorEnabled}
                      disabled={!hasAI}
                      helpText="Generate daily AI Advisor reports with insights, opportunities, and warnings"
                    />

                    <Banner tone="info">
                      <p>
                        AI features use <strong>OpenAI GPT-4o</strong>. Insights are cached for 6 hours
                        to minimize API costs. Add <code>OPENAI_API_KEY</code> to your Railway environment variables.
                      </p>
                    </Banner>

                    <Box>
                      <Button variant="primary" submit loading={isLoading} disabled={!hasAI}>
                        Save AI Settings
                      </Button>
                    </Box>
                  </BlockStack>
                </fetcher.Form>
              )}

              {/* ── REPORT HISTORY TAB ── */}
              {selectedTab === 3 && (
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h3">Email Report History</Text>
                  {historyRows.length === 0 ? (
                    <Banner tone="info">
                      <p>No email reports have been sent yet. Configure email reports in the Email Reports tab.</p>
                    </Banner>
                  ) : (
                    <BlockStack gap="200">
                      {historyRows.map((r: any) => (
                        <Box key={r.id} padding="300" background="bg-surface-secondary" borderRadius="200">
                          <InlineStack align="space-between">
                            <BlockStack gap="100">
                              <Text variant="bodyMd" as="p" fontWeight="semibold">{r.subject}</Text>
                              <Text variant="bodySm" as="p" tone="subdued">
                                {r.sentAt} · To: {r.recipients}
                              </Text>
                            </BlockStack>
                            <Badge tone={r.status === "sent" ? "success" : "critical"}>
                              {r.status}
                            </Badge>
                          </InlineStack>
                        </Box>
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              )}

            </Box>
          </Tabs>
        </Card>

        {/* About section */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">About Crestline</Text>
            <Divider />
            <InlineGrid columns={{ xs: 1, md: 3 }} gap="300">
              <BlockStack gap="100">
                <Text variant="bodySm" as="p" tone="subdued">Version</Text>
                <Text variant="bodyMd" as="p">1.0.0</Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text variant="bodySm" as="p" tone="subdued">Store</Text>
                <Text variant="bodyMd" as="p">{shop}</Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text variant="bodySm" as="p" tone="subdued">Support</Text>
                <Text variant="bodyMd" as="p">
                  <a href="mailto:support@crestline.app" style={{ color: "#008060" }}>
                    support@crestline.app
                  </a>
                </Text>
              </BlockStack>
            </InlineGrid>
          </BlockStack>
        </Card>

      </BlockStack>
    </Page>
  );
}