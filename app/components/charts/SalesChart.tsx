import { Spinner, Box, Text } from "@shopify/polaris";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";

interface SalesChartProps {
  data: Record<string, string>[];
  loading?: boolean;
  valueKey?: string;
  label?: string;
  showDiscounts?: boolean;
}

function formatCurrency(value: number) {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function detectTimeKey(data: Record<string, string>[]): string | null {
  if (!data || data.length === 0) return null;
  const keys = Object.keys(data[0]);
  return keys.find((k) =>
    ["day", "week", "month", "quarter", "year", "hour"].includes(k)
  ) ?? null;
}

export function SalesChart({
  data,
  loading = false,
  valueKey = "total_sales",
  label = "Revenue",
  showDiscounts = false,
}: SalesChartProps) {
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
        <Text as="p" tone="subdued" alignment="center">No data available for this period.</Text>
      </Box>
    );
  }

  const timeKey = detectTimeKey(data);

  const chartData = data.map((row) => {
    const entry: Record<string, any> = {};
    if (timeKey) {
      entry.date = formatDate(row[timeKey]);
    }
    entry[label] = parseFloat(row[valueKey] ?? "0");
    if (showDiscounts) {
      entry["Discounts"] = parseFloat(row["discounts"] ?? "0");
      entry["Net Sales"] = parseFloat(row["net_sales"] ?? "0");
    }
    return entry;
  });

  const COLORS = {
    primary: "#008060",
    discounts: "#E51C00",
    net: "#1A73E8",
  };

  if (showDiscounts) {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: number, name: string) => [
              `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
              name,
            ]}
          />
          <Legend />
          <Bar dataKey={label} fill={COLORS.primary} radius={[3, 3, 0, 0]} />
          <Bar dataKey="Net Sales" fill={COLORS.net} radius={[3, 3, 0, 0]} />
          <Bar dataKey="Discounts" fill={COLORS.discounts} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
            <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis
          tickFormatter={valueKey.includes("count") || valueKey.includes("orders") || valueKey.includes("customer")
            ? (v) => v.toLocaleString()
            : formatCurrency
          }
          tick={{ fontSize: 11 }}
        />
        <Tooltip
          formatter={(value: number) => [
            valueKey.includes("count") || valueKey.includes("customer")
              ? value.toLocaleString()
              : `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
            label,
          ]}
        />
        <Area
          type="monotone"
          dataKey={label}
          stroke={COLORS.primary}
          strokeWidth={2}
          fill="url(#colorRevenue)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}