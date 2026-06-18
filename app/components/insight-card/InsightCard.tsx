import { Banner, Text } from "@shopify/polaris";

interface InsightCardProps {
  title: string;
  content: string;
  tone?: "info" | "success" | "warning" | "critical";
}

export function InsightCard({ title, content, tone = "info" }: InsightCardProps) {
  return (
    <Banner title={title} tone={tone}>
      <Text variant="bodyMd" as="p">{content}</Text>
    </Banner>
  );
}