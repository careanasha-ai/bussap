/**
 * Fetch discount codes via GraphQL Admin API
 */
export async function getDiscountCodes(admin: any): Promise<any[]> {
  try {
    const response = await admin.graphql(`
      query GetDiscountCodes {
        codeDiscountNodes(first: 50, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              codeDiscount {
                ... on DiscountCodeBasic {
                  title
                  status
                  usageLimit
                  appliesOncePerCustomer
                  startsAt
                  endsAt
                  codes(first: 1) {
                    edges {
                      node {
                        code
                        usageCount
                      }
                    }
                  }
                  customerGets {
                    value {
                      ... on DiscountPercentage {
                        percentage
                      }
                      ... on DiscountAmount {
                        amount {
                          amount
                          currencyCode
                        }
                      }
                    }
                  }
                }
                ... on DiscountCodeFreeShipping {
                  title
                  status
                  usageLimit
                  startsAt
                  endsAt
                  codes(first: 1) {
                    edges {
                      node {
                        code
                        usageCount
                      }
                    }
                  }
                }
                ... on DiscountCodeBxgy {
                  title
                  status
                  usageLimit
                  startsAt
                  endsAt
                  codes(first: 1) {
                    edges {
                      node {
                        code
                        usageCount
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `);

    const json = await response.json();
    const nodes = json.data?.codeDiscountNodes?.edges ?? [];

    return nodes.map((edge: any) => {
      const discount = edge.node.codeDiscount;
      const firstCode = discount?.codes?.edges?.[0]?.node;
      return {
        id: edge.node.id,
        title: discount?.title,
        code: firstCode?.code,
        usageCount: firstCode?.usageCount ?? 0,
        usageLimit: discount?.usageLimit,
        status: discount?.status,
        startsAt: discount?.startsAt,
        endsAt: discount?.endsAt,
        appliesOncePerCustomer: discount?.appliesOncePerCustomer,
        discountValue: discount?.customerGets?.value,
      };
    });
  } catch (err) {
    console.error("Error fetching discount codes:", err);
    return [];
  }
}