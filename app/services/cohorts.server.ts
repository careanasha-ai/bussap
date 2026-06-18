/**
 * Cohort Retention Analysis Service
 *
 * Builds monthly cohort data by:
 * 1. Fetching all orders with customer + date info via GraphQL
 * 2. Grouping customers by their first-order month (acquisition cohort)
 * 3. For each cohort, calculating what % returned in M+1, M+2, ... M+N
 */

interface Order {
  customerId: string;
  processedAt: string; // ISO date string
  totalPrice: number;
}

interface CohortRow {
  label: string;          // e.g. "Jan 2025"
  yearMonth: string;      // e.g. "2025-01"
  initialCustomers: number;
  retention: (number | null)[]; // % who returned in M+1, M+2, ...
  m1Retention: number | null;
  revenueTotal: number;
}

/**
 * Fetch all orders (up to 2000) with customer IDs and dates
 */
async function fetchAllOrders(admin: any): Promise<Order[]> {
  const orders: Order[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;
  let pageCount = 0;
  const MAX_PAGES = 8; // ~2000 orders max to avoid rate limits

  while (hasNextPage && pageCount < MAX_PAGES) {
    const query = `
      query GetOrders($cursor: String) {
        orders(
          first: 250,
          after: $cursor,
          query: "financial_status:paid",
          sortKey: PROCESSED_AT
        ) {
          edges {
            cursor
            node {
              id
              processedAt
              totalPriceSet {
                shopMoney {
                  amount
                }
              }
              customer {
                id
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const response = await admin.graphql(query, {
      variables: { cursor },
    });

    const json = await response.json();
    const edges = json.data?.orders?.edges ?? [];
    const pageInfo = json.data?.orders?.pageInfo;

    for (const edge of edges) {
      const node = edge.node;
      if (!node.customer?.id) continue; // skip guest orders
      orders.push({
        customerId: node.customer.id,
        processedAt: node.processedAt,
        totalPrice: parseFloat(node.totalPriceSet?.shopMoney?.amount ?? "0"),
      });
    }

    hasNextPage = pageInfo?.hasNextPage ?? false;
    cursor = pageInfo?.endCursor ?? null;
    pageCount++;
  }

  return orders;
}

/**
 * Convert ISO date to "YYYY-MM" string
 */
function toYearMonth(isoDate: string): string {
  return isoDate.substring(0, 7);
}

/**
 * Convert "YYYY-MM" to display label like "Jan 2025"
 */
function toLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/**
 * Add N months to a "YYYY-MM" string
 */
function addMonths(yearMonth: string, n: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(year, month - 1 + n, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Main cohort builder
 */
export async function buildCohortData(admin: any) {
  try {
    const orders = await fetchAllOrders(admin);

    if (orders.length === 0) {
      return emptyCohortResult();
    }

    // Step 1: Find each customer's first order month (acquisition cohort)
    const customerFirstMonth: Record<string, string> = {};
    for (const order of orders) {
      const ym = toYearMonth(order.processedAt);
      if (!customerFirstMonth[order.customerId] || ym < customerFirstMonth[order.customerId]) {
        customerFirstMonth[order.customerId] = ym;
      }
    }

    // Step 2: Build a map of customer → set of months they ordered in
    const customerOrderMonths: Record<string, Set<string>> = {};
    const customerRevenue: Record<string, number> = {};
    for (const order of orders) {
      const ym = toYearMonth(order.processedAt);
      if (!customerOrderMonths[order.customerId]) {
        customerOrderMonths[order.customerId] = new Set();
        customerRevenue[order.customerId] = 0;
      }
      customerOrderMonths[order.customerId].add(ym);
      customerRevenue[order.customerId] += order.totalPrice;
    }

    // Step 3: Group customers by acquisition cohort
    const cohortCustomers: Record<string, string[]> = {};
    for (const [customerId, firstMonth] of Object.entries(customerFirstMonth)) {
      if (!cohortCustomers[firstMonth]) cohortCustomers[firstMonth] = [];
      cohortCustomers[firstMonth].push(customerId);
    }

    // Step 4: Get current month to know how many months of data exist
    const currentYM = toYearMonth(new Date().toISOString());

    // Step 5: Sort cohorts chronologically
    const sortedCohortMonths = Object.keys(cohortCustomers).sort();

    // Only include cohorts from last 12 months
    const twelveMonthsAgo = addMonths(currentYM, -12);
    const recentCohorts = sortedCohortMonths.filter((ym) => ym >= twelveMonthsAgo);

    if (recentCohorts.length === 0) {
      return emptyCohortResult();
    }

    // Step 6: Build retention matrix
    const MAX_RETENTION_MONTHS = 6;
    const cohortRows: CohortRow[] = [];

    for (const cohortYM of recentCohorts) {
      const customers = cohortCustomers[cohortYM];
      const initialCount = customers.length;
      if (initialCount === 0) continue;

      const retention: (number | null)[] = [];

      for (let m = 1; m <= MAX_RETENTION_MONTHS; m++) {
        const targetYM = addMonths(cohortYM, m);

        // If target month is in the future, mark as null (no data yet)
        if (targetYM > currentYM) {
          retention.push(null);
          continue;
        }

        // Count customers who ordered in this target month
        const returned = customers.filter((cid) =>
          customerOrderMonths[cid]?.has(targetYM)
        ).length;

        retention.push((returned / initialCount) * 100);
      }

      // Total revenue from this cohort
      const revenueTotal = customers.reduce(
        (sum, cid) => sum + (customerRevenue[cid] ?? 0),
        0
      );

      cohortRows.push({
        label: toLabel(cohortYM),
        yearMonth: cohortYM,
        initialCustomers: initialCount,
        retention,
        m1Retention: retention[0],
        revenueTotal,
      });
    }

    // Step 7: Compute averages
    const m1Values = cohortRows.map((c) => c.retention[0]).filter((v): v is number => v !== null);
    const m3Values = cohortRows.map((c) => c.retention[2]).filter((v): v is number => v !== null);
    const m6Values = cohortRows.map((c) => c.retention[5]).filter((v): v is number => v !== null);

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    const avgRetentionM1 = avg(m1Values);
    const avgRetentionM3 = avg(m3Values);
    const avgRetentionM6 = avg(m6Values);

    // Best and worst cohort by M+1 retention
    const cohortsWithM1 = cohortRows.filter((c) => c.m1Retention !== null && c.initialCustomers >= 5);
    const bestCohort = cohortsWithM1.length > 0
      ? cohortsWithM1.reduce((a, b) => (a.m1Retention! > b.m1Retention! ? a : b))
      : null;
    const worstCohort = cohortsWithM1.length > 0
      ? cohortsWithM1.reduce((a, b) => (a.m1Retention! < b.m1Retention! ? a : b))
      : null;

    // Revenue per cohort for chart
    const revenuePerCohort = cohortRows.map((c) => ({
      month: c.yearMonth,
      total_revenue: c.revenueTotal.toFixed(2),
    }));

    return {
      cohorts: cohortRows,
      avgRetentionM1,
      avgRetentionM3,
      avgRetentionM6,
      bestCohort,
      worstCohort,
      revenuePerCohort,
      totalCohorts: cohortRows.length,
    };
  } catch (err) {
    console.error("Error building cohort data:", err);
    return emptyCohortResult();
  }
}

function emptyCohortResult() {
  return {
    cohorts: [],
    avgRetentionM1: null,
    avgRetentionM3: null,
    avgRetentionM6: null,
    bestCohort: null,
    worstCohort: null,
    revenuePerCohort: [],
    totalCohorts: 0,
  };
}