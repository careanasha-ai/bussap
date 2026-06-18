import { Spinner, Box, Text } from "@shopify/polaris";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

interface TopProductsChartProps {
  data: Record<string, string>[];
  loading?: boolean;
}

const COLORS = [
  "#008060", "#1A73E8", "#E8710A", "#9C27B0",
  "#00BCD4", "#FF5722", "#4CAF50", "#FF9800",
  "#607D8B", "#E91E63",
];

function truncate(str: string, maxLen = 18) {
  if (!str) return "Unknown";
  return str.length > maxLen ? str.substring(0, maxLen) + "…" : str;
}

export function TopProductsChart({ data, loading = false }: TopProductsChartProps) {
  if (loading) {
    return (
      <Box minHeight="200px" padding="400">
        <Spinner size="large" />
      </Box>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Box minHeight="200px" padding="400">
        <Text as="p" tone="subdued" alignment="center">No product data available.</Text>
      </Box>
    );
  }

  const chartData = data.slice(0, 8).map((row) => ({
    name: truncate(row.product_title ?? "Unknown"),
    revenue: parseFloat(row.total_sales ?? "0"),
    units: parseInt(row.units_sold ?? "0"),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`}
          tick={{ fontSize: 10 }}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 10 }}
          width={90}
        />
        <Tooltip
          formatter={(value: number) => [
            `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
            "Revenue",
          ]}
        />
        <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
          {chartData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}