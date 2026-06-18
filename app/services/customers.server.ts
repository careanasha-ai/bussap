/**
 * Fetch top customers by total spent via GraphQL Admin API
 */
export async function getTopCustomers(admin: any, limit = 20): Promise<any[]> {
  try {
    const response = await admin.graphql(`
      query GetTopCustomers($first: Int!) {
        customers(first: $first, sortKey: TOTAL_SPENT, reverse: true) {
          edges {
            node {
              id
              firstName
              lastName
              email
              ordersCount
              totalSpent {
                amount
                currencyCode
              }
              createdAt
              tags
              defaultAddress {
                country
                city
              }
            }
          }
        }
      }
    `, { variables: { first: limit } });

    const json = await response.json();
    const customers = json.data?.customers?.edges ?? [];

    return customers.map((edge: any) => ({
      id: edge.node.id,
      firstName: edge.node.firstName,
      lastName: edge.node.lastName,
      email: edge.node.email,
      ordersCount: edge.node.ordersCount,
      totalSpent: edge.node.totalSpent,
      createdAt: edge.node.createdAt,
      tags: edge.node.tags,
      country: edge.node.defaultAddress?.country,
      city: edge.node.defaultAddress?.city,
    }));
  } catch (err) {
    console.error("Error fetching top customers:", err);
    return [];
  }
}

/**
 * Fetch at-risk customers (haven't ordered in 90+ days but historically active)
 */
export async function getAtRiskCustomers(admin: any): Promise<any[]> {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const dateStr = ninetyDaysAgo.toISOString().split("T")[0];

    const response = await admin.graphql(`
      query GetAtRiskCustomers {
        customers(
          first: 50,
          query: "orders_count:>2 last_order_date:<${dateStr}",
          sortKey: TOTAL_SPENT,
          reverse: true
        ) {
          edges {
            node {
              id
              firstName
              lastName
              email
              ordersCount
              totalSpent {
                amount
                currencyCode
              }
              lastOrder {
                processedAt
              }
            }
          }
        }
      }
    `);

    const json = await response.json();
    const customers = json.data?.customers?.edges ?? [];

    return customers.map((edge: any) => ({
      id: edge.node.id,
      firstName: edge.node.firstName,
      lastName: edge.node.lastName,
      email: edge.node.email,
      ordersCount: edge.node.ordersCount,
      totalSpent: edge.node.totalSpent,
      lastOrderDate: edge.node.lastOrder?.processedAt,
    }));
  } catch (err) {
    console.error("Error fetching at-risk customers:", err);
    return [];
  }
}