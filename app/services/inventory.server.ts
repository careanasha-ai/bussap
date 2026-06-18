/**
 * Fetch inventory levels and alerts via GraphQL Admin API
 */
export async function getInventoryAlerts(admin: any): Promise<any[]> {
  try {
    const response = await admin.graphql(`
      query GetInventoryAlerts {
        productVariants(first: 250, query: "inventory_quantity:<11") {
          edges {
            node {
              id
              title
              inventoryQuantity
              product {
                id
                title
                status
              }
            }
          }
        }
      }
    `);

    const json = await response.json();
    const variants = json.data?.productVariants?.edges ?? [];

    return variants
      .filter((edge: any) => edge.node.product.status === "ACTIVE")
      .map((edge: any) => ({
        variantId: edge.node.id,
        variantTitle: edge.node.title === "Default Title" ? null : edge.node.title,
        productId: edge.node.product.id,
        productTitle: edge.node.product.title,
        available: edge.node.inventoryQuantity ?? 0,
      }));
  } catch (err) {
    console.error("Error fetching inventory alerts:", err);
    return [];
  }
}

/**
 * Fetch all active product variants with inventory levels
 */
export async function getInventoryWithVelocity(admin: any): Promise<any[]> {
  try {
    const response = await admin.graphql(`
      query GetInventory {
        productVariants(first: 250) {
          edges {
            node {
              id
              title
              inventoryQuantity
              sku
              product {
                id
                title
                status
                productType
                vendor
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `);

    const json = await response.json();
    const variants = json.data?.productVariants?.edges ?? [];

    return variants
      .filter((edge: any) => edge.node.product.status === "ACTIVE")
      .map((edge: any) => ({
        variantId: edge.node.id,
        variantTitle: edge.node.title === "Default Title" ? null : edge.node.title,
        sku: edge.node.sku,
        productId: edge.node.product.id,
        productTitle: edge.node.product.title,
        productType: edge.node.product.productType,
        vendor: edge.node.product.vendor,
        available: edge.node.inventoryQuantity ?? 0,
      }));
  } catch (err) {
    console.error("Error fetching inventory:", err);
    return [];
  }
}