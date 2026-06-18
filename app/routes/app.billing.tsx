import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  Button,
  Badge,
  Divider,
  Box,
  List,
  Banner,
  InlineStack,
  Icon,
} from "@shopify/polaris";
import { CheckIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import {
  PLANS,
  type PlanKey,
  getShopPlan,
  createSubscription,
  cancelSubscription,
  syncSubscriptionStatus,
  getActiveSubscription,
} from "../services/billing.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Sync subscription status from Shopify
  await syncSubscriptionStatus(admin, session.shop);

  const currentPlan = await getShopPlan(session.shop);
  const activeSub = await getActiveSubscription(admin);

  const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });

  return json({
    currentPlan,
    activeSub,
    shop: session.shop,
    billingStatus: shop?.billingStatus ?? "active",
    trialEndsAt: shop?.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: shop?.currentPeriodEnd?.toISOString() ?? null,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const planKey = formData.get("plan") as PlanKey;

  if (intent === "subscribe") {
    const returnUrl = `${process.env.SHOPIFY_APP_URL}/app/billing?success=true`;
    const result = await createSubscription(admin, planKey, returnUrl);

    if (result?.confirmationUrl) {
      // Update DB with pending subscription
      await prisma.shop.update({
        where: { shopDomain: session.shop },
        data: { plan: planKey, subscriptionId: result.subscriptionId },
      });
      return redirect(result.confirmationUrl);
    }

    return json({ error: "Failed to create subscription. Please try again." });
  }

  if (intent === "cancel") {
    const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
    if (shop?.subscriptionId) {
      await cancelSubscription(admin, shop.subscriptionId);
      await prisma.shop.update({
        where: { shopDomain: session.shop },
        data: { plan: "free", billingStatus: "cancelled", subscriptionId: null },
      });
    }
    return json({ success: "Subscription cancelled. You've been moved to the Free plan." });
  }

  return json({ error: "Unknown action." });
};

const PLAN_ORDER: PlanKey[] = ["free", "growth", "pro", "scale"];

export default function BillingPage() {
  const { currentPlan, activeSub, shop, billingStatus, trialEndsAt, currentPeriodEnd } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<any>();
  const isLoading = fetcher.state !== "idle";

  const url = new URL(typeof window !== "undefined" ? window.location.href : "http://localhost");
  const successParam = url.searchParams.get("success");

  return (
    <Page title="Plans & Billing" subtitle="Choose the plan that fits your store">
      <BlockStack gap="500">

        {/* Success / Error banners */}
        {successParam === "true" && (
          <Banner tone="success" title="Subscription activated!">
            <p>Your plan has been upgraded. All features are now available.</p>
          </Banner>
        )}
        {fetcher.data?.error && (
          <Banner tone="critical" title="Error">
            <p>{fetcher.data.error}</p>
          </Banner>
        )}
        {fetcher.data?.success && (
          <Banner tone="info" title="Subscription cancelled">
            <p>{fetcher.data.success}</p>
          </Banner>
        )}

        {/* Current Plan Status */}
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text variant="headingMd" as="h2">Current Plan</Text>
              <Badge tone={currentPlan === "free" ? "subdued" : "success"}>
                {PLANS[currentPlan as PlanKey]?.name ?? "Free"}
              </Badge>
            </InlineStack>
            <Divider />
            <InlineGrid columns={{ xs: 1, md: 3 }} gap="300">
              <Box>
                <Text variant="bodySm" as="p" tone="subdued">Plan</Text>
                <Text variant="bodyMd" as="p" fontWeight="semibold">
                  {PLANS[currentPlan as PlanKey]?.name ?? "Free"}
                  {currentPlan !== "free" && ` — $${PLANS[currentPlan as PlanKey]?.price}/mo`}
                </Text>
              </Box>
              <Box>
                <Text variant="bodySm" as="p" tone="subdued">Status</Text>
                <Text variant="bodyMd" as="p" fontWeight="semibold">
                  {billingStatus === "active" ? "✅ Active" : billingStatus === "cancelled" ? "❌ Cancelled" : billingStatus}
                </Text>
              </Box>
              {currentPeriodEnd && (
                <Box>
                  <Text variant="bodySm" as="p" tone="subdued">Next Billing Date</Text>
                  <Text variant="bodyMd" as="p" fontWeight="semibold">
                    {new Date(currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </Text>
                </Box>
              )}
              {trialEndsAt && new Date(trialEndsAt) > new Date() && (
                <Box>
                  <Text variant="bodySm" as="p" tone="subdued">Trial Ends</Text>
                  <Text variant="bodyMd" as="p" fontWeight="semibold" tone="caution">
                    {new Date(trialEndsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </Text>
                </Box>
              )}
            </InlineGrid>

            {currentPlan !== "free" && (
              <Box paddingBlockStart="200">
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="cancel" />
                  <Button
                    variant="secondary"
                    tone="critical"
                    submit
                    loading={isLoading}
                  >
                    Cancel Subscription
                  </Button>
                </fetcher.Form>
              </Box>
            )}
          </BlockStack>
        </Card>

        {/* Plan Cards */}
        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          {PLAN_ORDER.map((planKey) => {
            const plan = PLANS[planKey];
            const isCurrent = currentPlan === planKey;
            const isUpgrade = PLAN_ORDER.indexOf(planKey) > PLAN_ORDER.indexOf(currentPlan as PlanKey);
            const isDowngrade = PLAN_ORDER.indexOf(planKey) < PLAN_ORDER.indexOf(currentPlan as PlanKey);

            return (
              <Card key={planKey} background={isCurrent ? "bg-surface-selected" : "bg-surface"}>
                <BlockStack gap="400">
                  {/* Plan header */}
                  <BlockStack gap="100">
                    <InlineStack align="space-between">
                      <Text variant="headingMd" as="h3">{plan.name}</Text>
                      {isCurrent && <Badge tone="success">Current</Badge>}
                      {planKey === "pro" && !isCurrent && <Badge tone="info">Popular</Badge>}
                    </InlineStack>
                    <Text variant="headingXl" as="p" fontWeight="bold">
                      {plan.price === 0 ? "Free" : `$${plan.price}`}
                      {plan.price > 0 && (
                        <Text variant="bodySm" as="span" tone="subdued"> /mo</Text>
                      )}
                    </Text>
                    {plan.trialDays > 0 && (
                      <Text variant="bodySm" as="p" tone="subdued">
                        {plan.trialDays}-day free trial
                      </Text>
                    )}
                  </BlockStack>

                  <Divider />

                  {/* Features */}
                  <BlockStack gap="200">
                    {plan.features.map((feature) => (
                      <InlineStack key={feature} gap="200" blockAlign="start">
                        <Box>
                          <Text variant="bodySm" as="span" tone="success">✓</Text>
                        </Box>
                        <Text variant="bodySm" as="p">{feature}</Text>
                      </InlineStack>
                    ))}
                  </BlockStack>

                  {/* CTA */}
                  <Box paddingBlockStart="200">
                    {isCurrent ? (
                      <Button variant="secondary" disabled fullWidth>
                        Current Plan
                      </Button>
                    ) : planKey === "free" ? (
                      <Button variant="secondary" disabled fullWidth>
                        Downgrade to Free
                      </Button>
                    ) : (
                      <fetcher.Form method="post">
                        <input type="hidden" name="intent" value="subscribe" />
                        <input type="hidden" name="plan" value={planKey} />
                        <Button
                          variant={isUpgrade ? "primary" : "secondary"}
                          submit
                          loading={isLoading}
                          fullWidth
                        >
                          {isUpgrade ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`}
                        </Button>
                      </fetcher.Form>
                    )}
                  </Box>
                </BlockStack>
              </Card>
            );
          })}
        </InlineGrid>

        {/* Billing FAQ */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">Billing FAQ</Text>
            <Divider />
            <BlockStack gap="300">
              <BlockStack gap="100">
                <Text variant="bodyMd" as="p" fontWeight="semibold">When am I charged?</Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Billing is handled by Shopify and charged every 30 days. Your first charge starts after the free trial ends.
                </Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text variant="bodyMd" as="p" fontWeight="semibold">Can I cancel anytime?</Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Yes. Cancel anytime from this page. You'll keep access until the end of your current billing period.
                </Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text variant="bodyMd" as="p" fontWeight="semibold">What happens to my data if I downgrade?</Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Your data is never deleted. If you downgrade, you'll lose access to premium features but all historical data is preserved.
                </Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text variant="bodyMd" as="p" fontWeight="semibold">Is billing handled securely?</Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Yes. All billing is processed directly by Shopify — we never store your payment information.
                </Text>
              </BlockStack>
            </BlockStack>
          </BlockStack>
        </Card>

      </BlockStack>
    </Page>
  );
}