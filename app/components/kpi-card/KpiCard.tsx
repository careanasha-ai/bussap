import { Card, Text, BlockStack, InlineStack, Spinner, Box, Badge } from "@shopify/polaris";

interface KpiCardProps {
  title: string;
  value: string;
  change: number | null;
  changeLabel: string;
  loading?: boolean;
}

export function KpiCard({ title, value, change, changeLabel, loading = false }: KpiCardProps) {
  const isPositive = change !== null && change > 0;
  const isNegative = change !== null && change < 0;
  const isNeutral = change === null || change === 0;

  const changeTone = isPositive ? "success" : isNegative ? "critical" : "subdued";
  const changePrefix = isPositive ? "▲" : isNegative ? "▼" : "";
  const changeText = change !== null ? `${changePrefix} ${Math.abs(change).toFixed(1)}%` : null;

  return (
    <Card>
      <BlockStack gap="200">
        <Text variant="bodySm" as="p" tone="subdued">
          {title}
        </Text>
        {loading ? (
          <Spinner size="small" />
        ) : (
          <Text variant="headingXl" as="p" fontWeight="bold">
            {value}
          </Text>
        )}
        <InlineStack gap="100" align="start" blockAlign="center">
          {changeText && (
            <Text variant="bodySm" as="span" tone={changeTone} fontWeight="semibold">
              {changeText}
            </Text>
          )}
          <Text variant="bodySm" as="span" tone="subdued">
            {changeLabel}
          </Text>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}