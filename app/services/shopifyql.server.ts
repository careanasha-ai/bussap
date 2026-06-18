import OpenAI from "openai";

/**
 * Execute a ShopifyQL query via the GraphQL Admin API
 */
export async function runShopifyQL(
  admin: any,
  query: string
): Promise<{ columns: any[]; rows: any[] } | null> {
  try {
    const response = await admin.graphql(`
      query ShopifyQLQuery($query: String!) {
        shopifyqlQuery(query: $query) {
          tableData {
            columns {
              name
              dataType
              displayName
            }
            rows
          }
          parseErrors {
            code
            message
            range {
              start { line column }
              end { line column }
            }
          }
        }
      }
    `, { variables: { query } });

    const json = await response.json();

    if (json.errors) {
      console.error("GraphQL errors:", json.errors);
      return null;
    }

    const result = json.data?.shopifyqlQuery;

    if (result?.parseErrors?.length > 0) {
      console.error("ShopifyQL parse errors:", result.parseErrors);
      return null;
    }

    const tableData = result?.tableData;
    if (!tableData) return null;

    const columns: any[] = tableData.columns ?? [];

    // Convert row arrays to objects keyed by column name
    const rows: Record<string, string>[] = (tableData.rows ?? []).map((row: any[]) => {
      const obj: Record<string, string> = {};
      columns.forEach((col, i) => {
        obj[col.name] = row[i] ?? null;
      });
      return obj;
    });

    return { columns, rows };
  } catch (err) {
    console.error("ShopifyQL query error:", err);
    return null;
  }
}

/**
 * Translate a natural language question to a ShopifyQL query using GPT-4o
 */
export async function nlQueryToShopifyQL(question: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({ apiKey });

  const systemPrompt = `You are a ShopifyQL expert. Convert the merchant's question into a valid ShopifyQL query.

Available tables and their key fields:
- sales: total_sales, net_sales, gross_sales, discounts, returns, orders, average_order_value, units_sold, product_title, product_type, product_vendor, variant_title, billing_country, billing_city, channel, hour
- customers: customer_count, total_spent, customer_type (new/returning), billing_country, billing_city
- sessions: sessions, conversion_rate, bounce_rate, traffic_source, device_type
- orders: orders, fulfillment_status, financial_status

ShopifyQL syntax rules:
- Every query MUST start with FROM and SHOW
- Use TIMESERIES for time-based trends (day, week, month, year)
- Use GROUP BY for breakdowns
- Use SINCE for date ranges: today, yesterday, last_7_days, last_30_days, this_month, last_month, this_quarter, this_year, last_year
- Use ORDER BY ... DESC/ASC
- Use LIMIT to cap results
- Use COMPARE TO previous_period or previous_year for comparisons
- Use WITH PERCENT_CHANGE for percentage changes

Return ONLY the ShopifyQL query, no explanation, no markdown, no code blocks.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: question },
    ],
    max_tokens: 300,
    temperature: 0.1,
  });

  const query = response.choices[0]?.message?.content?.trim();
  if (!query) return null;

  // Clean up any accidental markdown code blocks
  return query.replace(/```[\w]*\n?/g, "").replace(/```/g, "").trim();
}