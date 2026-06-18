import { useState, useRef, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  TextField,
  Button,
  Box,
  Divider,
  Badge,
  Banner,
  Spinner,
  InlineStack,
  DataTable,
} from "@shopify/polaris";
import { SendIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { nlQueryToShopifyQL, runShopifyQL } from "../services/shopifyql.server";
import { SalesChart } from "../components/charts/SalesChart";

const EXAMPLE_QUESTIONS = [
  "What were my top 10 products last month?",
  "How many new customers did I get this week?",
  "Which country buys the most from me?",
  "What is my average order value this year?",
  "Show me daily sales for the last 30 days",
  "What are my slowest selling products?",
  "How much revenue did I make this quarter?",
  "What's my conversion rate this month?",
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({ ready: true });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const question = formData.get("question") as string;

  if (!question?.trim()) {
    return json({ error: "Please enter a question." });
  }

  try {
    // Step 1: Translate natural language to ShopifyQL
    const shopifyqlQuery = await nlQueryToShopifyQL(question);

    if (!shopifyqlQuery) {
      return json({ error: "Could not understand your question. Please try rephrasing it." });
    }

    // Step 2: Execute the ShopifyQL query
    const result = await runShopifyQL(admin, shopifyqlQuery);

    if (!result) {
      return json({
        question,
        query: shopifyqlQuery,
        error: "Query returned no results.",
      });
    }

    return json({
      question,
      query: shopifyqlQuery,
      columns: result.columns ?? [],
      rows: result.rows ?? [],
      rowCount: result.rows?.length ?? 0,
    });
  } catch (err: any) {
    return json({
      question,
      error: err.message || "An error occurred while processing your question.",
    });
  }
};

type Message = {
  id: string;
  type: "user" | "assistant" | "error";
  content: string;
  query?: string;
  columns?: Array<{ name: string; displayName: string; dataType: string }>;
  rows?: Record<string, string>[];
};

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      type: "assistant",
      content: "👋 Hi! I'm your store analyst. Ask me anything about your Shopify store in plain English and I'll fetch the data for you.",
    },
  ]);
  const fetcher = useFetcher<any>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isLoading = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data && fetcher.state === "idle") {
      const data = fetcher.data;
      if (data.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            type: "error",
            content: data.error,
            query: data.query,
          },
        ]);
      } else if (data.rows !== undefined) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            type: "assistant",
            content: `Found ${data.rowCount} result${data.rowCount !== 1 ? "s" : ""} for your query.`,
            query: data.query,
            columns: data.columns,
            rows: data.rows,
          },
        ]);
      }
    }
  }, [fetcher.data, fetcher.state]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = () => {
    if (!question.trim() || isLoading) return;

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        type: "user",
        content: question,
      },
    ]);

    const formData = new FormData();
    formData.append("question", question);
    fetcher.submit(formData, { method: "post" });
    setQuestion("");
  };

  const handleExampleClick = (q: string) => {
    setQuestion(q);
  };

  const renderMessage = (msg: Message) => {
    const isUser = msg.type === "user";
    const isError = msg.type === "error";

    return (
      <Box
        key={msg.id}
        padding="300"
        background={isUser ? "bg-fill-brand" : isError ? "bg-fill-critical-secondary" : "bg-surface-secondary"}
        borderRadius="200"
      >
        <BlockStack gap="200">
          <InlineStack align="space-between">
            <Text variant="bodySm" as="p" tone="subdued" fontWeight="semibold">
              {isUser ? "You" : isError ? "Error" : "Crestline"}
            </Text>
            {msg.query && (
              <Badge tone="info">ShopifyQL</Badge>
            )}
          </InlineStack>

          <Text variant="bodyMd" as="p">{msg.content}</Text>

          {msg.query && (
            <Box padding="200" background="bg-surface" borderRadius="100">
              <Text variant="bodySm" as="p" tone="subdued">
                <code>{msg.query}</code>
              </Text>
            </Box>
          )}

          {msg.rows && msg.rows.length > 0 && msg.columns && (
            <Box paddingBlockStart="200">
              {/* Show as chart if time-series data */}
              {msg.columns.some((c) => c.dataType?.includes("TIMESTAMP")) && msg.columns.some((c) => c.dataType === "MONEY") ? (
                <SalesChart
                  data={msg.rows}
                  loading={false}
                  valueKey={msg.columns.find((c) => c.dataType === "MONEY")?.name ?? "total_sales"}
                  label={msg.columns.find((c) => c.dataType === "MONEY")?.displayName ?? "Value"}
                />
              ) : (
                <DataTable
                  columnContentTypes={msg.columns.map((c) =>
                    c.dataType === "MONEY" || c.dataType === "INTEGER" || c.dataType === "FLOAT"
                      ? "numeric"
                      : "text"
                  )}
                  headings={msg.columns.map((c) => c.displayName || c.name)}
                  rows={msg.rows.map((row) =>
                    msg.columns!.map((col) => {
                      const val = row[col.name];
                      if (col.dataType === "MONEY" && val) {
                        return `$${parseFloat(val).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
                      }
                      return val ?? "—";
                    })
                  )}
                />
              )}
            </Box>
          )}

          {msg.rows && msg.rows.length === 0 && (
            <Text variant="bodySm" as="p" tone="subdued">No data found for this query.</Text>
          )}
        </BlockStack>
      </Box>
    );
  };

  return (
    <Page
      title="💬 Ask Your Store"
      subtitle="Ask questions about your store in plain English — powered by AI"
    >
      <BlockStack gap="500">

        {/* Example Questions */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h3">Try asking...</Text>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {EXAMPLE_QUESTIONS.map((q) => (
                <Button
                  key={q}
                  size="slim"
                  variant="secondary"
                  onClick={() => handleExampleClick(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
          </BlockStack>
        </Card>

        {/* Chat Window */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h3">Conversation</Text>
            <Divider />

            {/* Messages */}
            <Box
              minHeight="300px"
              maxHeight="500px"
              overflowY="auto"
              padding="200"
            >
              <BlockStack gap="300">
                {messages.map(renderMessage)}
                {isLoading && (
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <InlineStack gap="200" align="start">
                      <Spinner size="small" />
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Analyzing your store data...
                      </Text>
                    </InlineStack>
                  </Box>
                )}
                <div ref={messagesEndRef} />
              </BlockStack>
            </Box>

            <Divider />

            {/* Input */}
            <InlineStack gap="200" align="start" blockAlign="end">
              <Box flexGrow="1">
                <TextField
                  label=""
                  labelHidden
                  value={question}
                  onChange={setQuestion}
                  placeholder="Ask anything about your store... e.g. 'What were my top products last month?'"
                  autoComplete="off"
                  onKeyDown={(e: any) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  disabled={isLoading}
                />
              </Box>
              <Button
                icon={SendIcon}
                variant="primary"
                onClick={handleSubmit}
                loading={isLoading}
                disabled={!question.trim()}
              >
                Ask
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        <Banner tone="info">
          <p>
            Questions are translated to ShopifyQL queries using AI. Complex questions may not always
            produce perfect results — try rephrasing if you get unexpected answers.
          </p>
        </Banner>

      </BlockStack>
    </Page>
  );
}