import { Box, Text } from "@shopify/polaris";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

interface ForecastChartProps {
  historical: Record<string, string>[];
  forecast: Array<{
    label: string;
    yearMonth: string;
    low: string;
    mid: string;
    high: string;
  }>;
}

function formatCurrency(value: number) {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

function toMonthLabel(dateStr: string): string {
  const ym = dateStr.substring(0, 7);
  const [year, month] = ym.split("-");
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function ForecastChart({ historical, forecast }: ForecastChartProps) {
  if (!historical || historical.length === 0) {
    return (
      <Box padding="400">
        <Text as="p" tone="subdued" alignment="center">
          Not enough data to render forecast chart.
        </Text>
      </Box>
    );
  }

  // Build unified chart data
  const historicalPoints = historical.map((row) => ({
    label: toMonthLabel(row.month ?? row.day ?? ""),
    actual: parseFloat(row.total_sales ?? "0"),
    low: undefined as number | undefined,
    mid: undefined as number | undefined,
    high: undefined as number | undefined,
    isForecast: false,
  }));

  // Last historical point bridges into forecast
  const lastHistorical = historicalPoints[historicalPoints.length - 1];

  const forecastPoints = forecast.map((f, i) => ({
    label: f.label,
    actual: undefined as number | undefined,
    low: parseFloat(f.low),
    mid: parseFloat(f.mid),
    high: parseFloat(f.high),
    isForecast: true,
  }));

  // Bridge: duplicate last historical point as start of forecast band
  if (lastHistorical && forecastPoints.length > 0) {
    forecastPoints.unshift({
      label: lastHistorical.label,
      actual: undefined,
      low: lastHistorical.actual * 0.80,
      mid: lastHistorical.actual,
      high: lastHistorical.actual * 1.20,
      isForecast: true,
    });
  }

  const chartData = [...historicalPoints, ...forecastPoints];
  const dividerLabel = lastHistorical?.label;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div style={{
        background: "#fff",
        border: "1px solid #e1e3e5",
        borderRadius: "8px",
        padding: "10px 14px",
        fontSize: "13px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      }}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
        {payload.map((p: any) => (
          p.value !== undefined && (
            <p key={p.name} style={{ color: p.color, margin: "2px 0" }}>
              {p.name}: {formatCurrency(p.value)}
            </p>
          )
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="forecastBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1A73E8" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#1A73E8" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#008060" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#008060" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />

        {/* Forecast confidence band (area between low and high) */}
        <Area
          type="monotone"
          dataKey="high"
          stroke="none"
          fill="url(#forecastBand)"
          name="High Estimate"
          legendType="none"
          connectNulls
        />
        <Area
          type="monotone"
          dataKey="low"
          stroke="none"
          fill="#fff"
          name="Low Estimate"
          legendType="none"
          connectNulls
        />

        {/* Actual historical revenue */}
        <Area
          type="monotone"
          dataKey="actual"
          stroke="#008060"
          strokeWidth={2.5}
          fill="url(#actualGrad)"
          name="Actual Revenue"
          dot={false}
          activeDot={{ r: 4 }}
          connectNulls={false}
        />

        {/* Forecast mid line */}
        <Line
          type="monotone"
          dataKey="mid"
          stroke="#1A73E8"
          strokeWidth={2}
          strokeDasharray="6 3"
          name="Forecast (Mid)"
          dot={false}
          activeDot={{ r: 4 }}
          connectNulls
        />

        {/* Divider line between historical and forecast */}
        {dividerLabel && (
          <ReferenceLine
            x={dividerLabel}
            stroke="#8c9196"
            strokeDasharray="4 2"
            label={{ value: "Today", position: "top", fontSize: 11, fill: "#8c9196" }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}