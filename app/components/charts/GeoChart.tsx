import { Box, Text, DataTable } from "@shopify/polaris";

interface GeoChartProps {
  data: Record<string, string>[];
  loading?: boolean;
}

// Simple flag emoji helper
function getFlag(countryName: string): string {
  const flags: Record<string, string> = {
    "United States": "🇺🇸", "Canada": "🇨🇦", "United Kingdom": "🇬🇧",
    "Australia": "🇦🇺", "Germany": "🇩🇪", "France": "🇫🇷",
    "Japan": "🇯🇵", "China": "🇨🇳", "India": "🇮🇳",
    "Brazil": "🇧🇷", "Mexico": "🇲🇽", "Netherlands": "🇳🇱",
    "Sweden": "🇸🇪", "Norway": "🇳🇴", "Denmark": "🇩🇰",
    "Spain": "🇪🇸", "Italy": "🇮🇹", "South Korea": "🇰🇷",
    "Singapore": "🇸🇬", "New Zealand": "🇳🇿",
  };
  return flags[countryName] ?? "🌍";
}

export function GeoChart({ data, loading = false }: GeoChartProps) {
  if (!data || data.length === 0) {
    return (
      <Box padding="400">
        <Text as="p" tone="subdued" alignment="center">No geographic data available.</Text>
      </Box>
    );
  }

  const maxSales = parseFloat(data[0]?.total_sales ?? "1");

  const rows = data.slice(0, 10).map((row) => {
    const sales = parseFloat(row.total_sales ?? "0");
    const pct = maxSales > 0 ? ((sales / maxSales) * 100).toFixed(0) : "0";
    return [
      `${getFlag(row.billing_country ?? "")} ${row.billing_country ?? "Unknown"}`,
      `$${sales.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      row.orders ?? "0",
      `${pct}%`,
    ];
  });

  return (
    <DataTable
      columnContentTypes={["text", "numeric", "numeric", "numeric"]}
      headings={["Country", "Revenue", "Orders", "Share"]}
      rows={rows}
    />
  );
}