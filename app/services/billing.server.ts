/**
 * Shopify Billing API Service
 *
 * Handles subscription plans, trial periods, and billing checks.
 * Uses Shopify's AppSubscription GraphQL API.
 */

import prisma from "../db.server";

export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    trialDays: 0,
    features: [
      "Dashboard & KPI cards",
      "Sales overview (30-day history)",
      "Product performance",
      "Customer overview",
    ],
    limits: {
      historyDays: 30,
      aiInsights: false,
      nlQuery: false,
      emailReports: false,
      cohorts: false,
      forecast: false,
    },
  },
  growth: {
    name: "Growth",
    price: 19,
    trialDays: 14,
    features: [
      "Everything in Free",
      "1-year history",
      "Sales by channel & geography",
      "Inventory intelligence",
      "Promotions analytics",
      "Weekly email reports",
      "Basic AI insights",
    ],
    limits: {
      historyDays: 365,
      aiInsights: true,
      nlQuery: false,
      emailReports: true,
      cohorts: false,
      forecast: false,
    },
  },
  pro: {
    name: "Pro",
    price: 49,
    trialDays: 14,
    features: [
      "Everything in Growth",
      "Cohort retention analysis",
      "Revenue forecasting",
      "AI Advisor (full report)",
      "Ask Your Store (NL queries)",
      "Weekly & monthly email reports",
    ],
    limits: {
      historyDays: 730,
      aiInsights: true,
      nlQuery: true,
      emailReports: true,
      cohorts: true,
      forecast: true,
    },
  },
  scale: {
    name: "Scale",
    price: 99,
    trialDays: 14,
    features: [
      "Everything in Pro",
      "Unlimited history",
      "Priority AI processing",
      "Custom email report schedules",
      "API access",
      "Dedicated support",
    ],
    limits: {
      historyDays: 99999,
      aiInsights: true,
      nlQuery: true,
      emailReports: true,
      cohorts: true,
      forecast: true,
    },
  },
} as const;

export type PlanKey = keyof typeof PLANS;

/**
 * Check if a shop has access to a specific feature based on their plan
 */
export async function hasFeatureAccess(
  shopDomain: string,
  feature: keyof typeof PLANS.free.limits
): Promise<boolean> {
  try {
    const shop = await prisma.shop.findUnique({ where: { shopDomain } });
    if (!shop) return false;

    const plan = (shop.plan as PlanKey) || "free";
    const planConfig = PLANS[plan] || PLANS.free;
    return !!planConfig.limits[feature];
  } catch {
    return false;
  }
}

/**
 * Get the current plan for a shop
 */
export async function getShopPlan(shopDomain: string): Promise<PlanKey> {
  try {
    const shop = await prisma.shop.findUnique({ where: { shopDomain } });
    return (shop?.plan as PlanKey) || "free";
  } catch {
    return "free";
  }
}

/**
 * Create a Shopify App Subscription (redirect merchant to billing confirmation)
 */
export async function createSubscription(
  admin: any,
  planKey: PlanKey,
  returnUrl: string
): Promise<{ confirmationUrl: string; subscriptionId: string } | null> {
  const plan = PLANS[planKey];
  if (!plan || plan.price === 0) return null;

  try {
    const response = await admin.graphql(`
      mutation AppSubscriptionCreate(
        $name: String!
        $lineItems: [AppSubscriptionLineItemInput!]!
        $returnUrl: URL!
        $trialDays: Int
        $test: Boolean
      ) {
        appSubscriptionCreate(
          name: $name
          lineItems: $lineItems
          returnUrl: $returnUrl
          trialDays: $trialDays
          test: $test
        ) {
          userErrors {
            field
            message
          }
          confirmationUrl
          appSubscription {
            id
            status
          }
        }
      }
    `, {
      variables: {
        name: `Crestline ${plan.name}`,
        returnUrl,
        trialDays: plan.trialDays,
        test: process.env.NODE_ENV !== "production",
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                price: { amount: plan.price, currencyCode: "USD" },
                interval: "EVERY_30_DAYS",
              },
            },
          },
        ],
      },
    });

    const json = await response.json();
    const result = json.data?.appSubscriptionCreate;

    if (result?.userErrors?.length > 0) {
      console.error("Billing errors:", result.userErrors);
      return null;
    }

    return {
      confirmationUrl: result?.confirmationUrl,
      subscriptionId: result?.appSubscription?.id,
    };
  } catch (err) {
    console.error("Error creating subscription:", err);
    return null;
  }
}

/**
 * Cancel a Shopify App Subscription
 */
export async function cancelSubscription(
  admin: any,
  subscriptionId: string
): Promise<boolean> {
  try {
    const response = await admin.graphql(`
      mutation AppSubscriptionCancel($id: ID!) {
        appSubscriptionCancel(id: $id) {
          userErrors {
            field
            message
          }
          appSubscription {
            id
            status
          }
        }
      }
    `, { variables: { id: subscriptionId } });

    const json = await response.json();
    const result = json.data?.appSubscriptionCancel;

    if (result?.userErrors?.length > 0) {
      console.error("Cancel errors:", result.userErrors);
      return false;
    }

    return result?.appSubscription?.status === "CANCELLED";
  } catch (err) {
    console.error("Error cancelling subscription:", err);
    return false;
  }
}

/**
 * Fetch current active subscription from Shopify
 */
export async function getActiveSubscription(admin: any): Promise<{
  id: string;
  status: string;
  name: string;
  currentPeriodEnd: string | null;
  trialDays: number | null;
} | null> {
  try {
    const response = await admin.graphql(`
      query GetActiveSubscription {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            currentPeriodEnd
            trialDays
            lineItems {
              plan {
                pricingDetails {
                  ... on AppRecurringPricing {
                    price {
                      amount
                      currencyCode
                    }
                    interval
                  }
                }
              }
            }
          }
        }
      }
    `);

    const json = await response.json();
    const subs = json.data?.currentAppInstallation?.activeSubscriptions ?? [];
    return subs[0] ?? null;
  } catch (err) {
    console.error("Error fetching subscription:", err);
    return null;
  }
}

/**
 * Sync subscription status from Shopify to our DB
 */
export async function syncSubscriptionStatus(
  admin: any,
  shopDomain: string
): Promise<void> {
  try {
    const sub = await getActiveSubscription(admin);

    if (!sub) {
      await prisma.shop.update({
        where: { shopDomain },
        data: { plan: "free", billingStatus: "active", subscriptionId: null },
      });
      return;
    }

    // Map subscription name back to plan key
    const planKey = Object.entries(PLANS).find(
      ([, p]) => sub.name.toLowerCase().includes(p.name.toLowerCase())
    )?.[0] as PlanKey ?? "free";

    await prisma.shop.update({
      where: { shopDomain },
      data: {
        plan: planKey,
        billingStatus: sub.status.toLowerCase(),
        subscriptionId: sub.id,
        currentPeriodEnd: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null,
      },
    });
  } catch (err) {
    console.error("Error syncing subscription:", err);
  }
}

/**
 * Get or create shop settings
 */
export async function getOrCreateSettings(shopDomain: string) {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    include: { settings: true },
  });

  if (!shop) return null;

  if (shop.settings) return shop.settings;

  // Create default settings
  return await prisma.shopSettings.create({
    data: { shopId: shop.id },
  });
}