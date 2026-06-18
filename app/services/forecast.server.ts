/**
 * Revenue Forecasting Engine
 *
 * Uses weighted moving average + linear trend detection + seasonal adjustment
 * to project future revenue. No external ML libraries needed.
 *
 * Algorithm:
 * 1. Compute weighted moving average of monthly revenue (recent months weighted higher)
 * 2. Detect linear trend (slope) using least-squares regression
 * 3. Apply seasonal index per month (based on historical month-over-month patterns)
 * 4. Generate low/mid/high confidence bands (±15% / ±30%)
 */

interface DailyRow {
  day?: string;
  total_sales?: string;
  orders?: string;
  [key: string]: string | undefined;
}

interface MonthlyRow {
  month?: string;
  total_sales?: string;
  orders?: string;
  average_order_value?: string;
  [key: string]: string | undefined;
}

interface ForecastBand {
  low: string;
  mid: string;
  high: string;
}

interface MonthlyForecastEntry {
  label: string;
  yearMonth: string;
  low: string;
  mid: string;
  high: string;
}

interface ForecastResult {
  next30Days: ForecastBand;
  next60Days: ForecastBand;
  next90Days: ForecastBand;
  monthlyForecast: MonthlyForecastEntry[];
  trend: "up" | "down" | "stable";
  trendPct: number;
  avgMonthlyRevenue: string;
  dataPointsUsed: number;
}

/**
 * Convert "YYYY-MM-DD" or "YYYY-MM" to a display label
 */
function toMonthLabel(dateStr: string): string {
  const ym = dateStr.substring(0, 7);
  const [year, month] = ym.split("-");
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/**
 * Add N months to "YYYY-MM"
 */
function addMonths(yearMonth: string, n: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const d = new Date(year, month - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Linear regression: returns slope and intercept
 */
function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };

  const xs = values.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((sum, x, i) => sum + x * values[i], 0);
  const sumX2 = xs.reduce((sum, x) => sum + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

/**
 * Weighted moving average (more recent = higher weight)
 */
function weightedMovingAverage(values: number[], windowSize = 6): number {
  const window = values.slice(-windowSize);
  const n = window.length;
  if (n === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;
  for (let i = 0; i < n; i++) {
    const weight = i + 1; // linear weights: 1, 2, 3, ...
    weightedSum += window[i] * weight;
    totalWeight += weight;
  }
  return weightedSum / totalWeight;
}

/**
 * Compute seasonal indices per calendar month (1–12)
 * based on how each month compares to the annual average
 */
function computeSeasonalIndices(monthlyRevenues: { month: number; revenue: number }[]): Record<number, number> {
  const byMonth: Record<number, number[]> = {};
  for (const { month, revenue } of monthlyRevenues) {
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(revenue);
  }

  const avgByMonth: Record<number, number> = {};
  for (const [m, vals] of Object.entries(byMonth)) {
    avgByMonth[parseInt(m)] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  const overallAvg = Object.values(avgByMonth).reduce((a, b) => a + b, 0) / Object.values(avgByMonth).length;

  const indices: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    indices[m] = avgByMonth[m] ? avgByMonth[m] / overallAvg : 1.0;
  }
  return indices;
}

/**
 * Main forecast builder
 */
export function buildForecast(
  dailyRows: DailyRow[],
  monthlyRows: MonthlyRow[]
): ForecastResult {
  // Parse monthly revenues
  const monthlyData = monthlyRows
    .filter((r) => r.month && r.total_sales)
    .map((r) => ({
      yearMonth: r.month!.substring(0, 7),
      revenue: parseFloat(r.total_sales ?? "0"),
      month: new Date(r.month!).getMonth() + 1,
    }))
    .filter((r) => r.revenue > 0);

  if (monthlyData.length < 3) {
    return emptyForecast();
  }

  const revenues = monthlyData.map((d) => d.revenue);
  const avgMonthlyRevenue = revenues.reduce((a, b) => a + b, 0) / revenues.length;

  // Linear trend
  const { slope, intercept } = linearRegression(revenues);
  const trendPct = avgMonthlyRevenue > 0 ? (slope / avgMonthlyRevenue) * 100 : 0;
  const trend: "up" | "down" | "stable" =
    trendPct > 3 ? "up" : trendPct < -3 ? "down" : "stable";

  // Weighted moving average base
  const wmaBase = weightedMovingAverage(revenues, Math.min(6, revenues.length));

  // Seasonal indices
  const seasonalIndices = computeSeasonalIndices(monthlyData);

  // Current month
  const lastYearMonth = monthlyData[monthlyData.length - 1].yearMonth;

  // Generate 3-month forecast
  const monthlyForecast: MonthlyForecastEntry[] = [];
  for (let i = 1; i <= 3; i++) {
    const forecastYM = addMonths(lastYearMonth, i);
    const calMonth = new Date(forecastYM + "-01").getMonth() + 1;
    const seasonal = seasonalIndices[calMonth] ?? 1.0;

    // Trend-adjusted base
    const trendAdjusted = wmaBase + slope * i;
    const mid = Math.max(0, trendAdjusted * seasonal);
    const low = mid * 0.80;   // -20% conservative
    const high = mid * 1.20;  // +20% optimistic

    monthlyForecast.push({
      label: toMonthLabel(forecastYM),
      yearMonth: forecastYM,
      low: low.toFixed(2),
      mid: mid.toFixed(2),
      high: high.toFixed(2),
    });
  }

  // 30/60/90 day projections (daily average × days)
  const dailyAvg = avgMonthlyRevenue / 30.44;
  const trendDailyAdj = (slope / 30.44);

  const project = (days: number): ForecastBand => {
    const mid = Math.max(0, (dailyAvg + trendDailyAdj * (days / 2)) * days);
    return {
      low: (mid * 0.80).toFixed(2),
      mid: mid.toFixed(2),
      high: (mid * 1.20).toFixed(2),
    };
  };

  return {
    next30Days: project(30),
    next60Days: project(60),
    next90Days: project(90),
    monthlyForecast,
    trend,
    trendPct: parseFloat(trendPct.toFixed(1)),
    avgMonthlyRevenue: avgMonthlyRevenue.toFixed(2),
    dataPointsUsed: dailyRows.length,
  };
}

function emptyForecast(): ForecastResult {
  const zero: ForecastBand = { low: "0.00", mid: "0.00", high: "0.00" };
  return {
    next30Days: zero,
    next60Days: zero,
    next90Days: zero,
    monthlyForecast: [],
    trend: "stable",
    trendPct: 0,
    avgMonthlyRevenue: "0.00",
    dataPointsUsed: 0,
  };
}