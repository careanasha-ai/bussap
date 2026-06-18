# StoreIQ — Shopify Business Intelligence App

> AI-powered analytics and insights for Shopify merchants. Understand your store's performance at a glance with intelligent dashboards, natural language queries, and proactive AI recommendations.

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

---

## ✨ Features

### 📊 Dashboard
- Real-time KPIs: Revenue, Orders, AOV, Conversion Rate
- 30-day revenue trend chart
- Top products this month
- AI-generated daily insight

### 💰 Sales Analytics
- Revenue over time (daily/weekly/monthly)
- Sales by channel, geography, and time-of-day
- Gross vs Net sales breakdown
- Discount impact analysis

### 📦 Product Intelligence
- Top sellers & slow movers
- Variant performance
- Sales by product type & vendor
- Inventory alerts (out of stock / low stock)

### 👥 Customer Insights
- New vs returning customer ratio
- Customer acquisition trends
- Top customers by lifetime value
- Geographic distribution

### 📦 Inventory Intelligence
- Days of stock remaining (based on sell velocity)
- Out-of-stock & low-stock alerts
- Reorder recommendations

### 🏷️ Promotions & Discounts
- Discount code performance
- Discount rate as % of gross revenue
- Monthly discount impact trend

### 🤖 AI Advisor
- Daily auto-generated executive summary
- Key insights, growth opportunities, and warnings
- Powered by GPT-4o

### 💬 Ask Your Store
- Natural language query interface
- Type questions in plain English → get charts & data
- AI translates to ShopifyQL automatically

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A [Shopify Partner account](https://partners.shopify.com)
- A Shopify development store
- An [OpenAI API key](https://platform.openai.com)
- A [Railway account](https://railway.app) for hosting

### 1. Clone & Install

```bash
git clone https://github.com/careanasha-ai/bussap.git
cd bussap
npm install
```

### 2. Set Up Shopify App

1. Go to [Shopify Partner Dashboard](https://partners.shopify.com)
2. Create a new app → **Public app**
3. Copy your **API key** and **API secret**
4. Set the App URL to your Railway deployment URL

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:
```env
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
SHOPIFY_APP_URL=https://your-app.railway.app
DATABASE_URL=postgresql://...
SESSION_SECRET=your_random_secret_here
OPENAI_API_KEY=sk-your-openai-key
```

### 4. Set Up Database

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 5. Run Locally

```bash
npm run dev
```

This starts the Shopify CLI dev server with tunneling.

---

## 🚂 Deploy to Railway

### One-Click Deploy

1. Push this repo to GitHub
2. Go to [Railway](https://railway.app) → **New Project** → **Deploy from GitHub**
3. Select this repository
4. Add a **PostgreSQL** plugin
5. Set environment variables (see `.env.example`)
6. Railway auto-deploys on every push

### Environment Variables on Railway

Set these in Railway's Variables tab:
```
SHOPIFY_API_KEY
SHOPIFY_API_SECRET
SHOPIFY_APP_URL        # Your Railway app URL
SESSION_SECRET         # Random 32+ char string
OPENAI_API_KEY
NODE_ENV=production
SCOPES=read_orders,read_products,read_customers,read_reports,read_inventory,read_analytics,read_marketing_events,read_shipping,read_discounts
```

`DATABASE_URL` is automatically set by Railway's PostgreSQL plugin.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         Shopify Admin (iframe)           │
│    React + Polaris + App Bridge          │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│           Railway Backend                │
│  Remix (React Router) + Node.js          │
│  ShopifyQL Service + AI Service          │
│  PostgreSQL (sessions + cache)           │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         Shopify Platform                 │
│  GraphQL Admin API + ShopifyQL           │
└─────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
bussap/
├── app/
│   ├── routes/
│   │   ├── app._index.tsx      # Dashboard
│   │   ├── app.sales.tsx       # Sales analytics
│   │   ├── app.products.tsx    # Product intelligence
│   │   ├── app.customers.tsx   # Customer insights
│   │   ├── app.inventory.tsx   # Inventory management
│   │   ├── app.promotions.tsx  # Discount analytics
│   │   ├── app.ai-advisor.tsx  # AI Advisor
│   │   ├── app.ask.tsx         # NL Query interface
│   │   └── webhooks.tsx        # Webhook handlers
│   ├── services/
│   │   ├── shopifyql.server.ts # ShopifyQL + NL→SQL
│   │   ├── ai.server.ts        # OpenAI integrations
│   │   ├── inventory.server.ts # Inventory GraphQL
│   │   ├── customers.server.ts # Customer GraphQL
│   │   └── discounts.server.ts # Discount GraphQL
│   ├── components/
│   │   ├── kpi-card/           # KPI metric cards
│   │   ├── insight-card/       # AI insight banners
│   │   └── charts/             # Recharts wrappers
│   ├── shopify.server.ts       # Shopify auth config
│   └── db.server.ts            # Prisma client
├── prisma/
│   └── schema.prisma           # Database schema
├── shopify.app.toml            # Shopify app config
├── railway.toml                # Railway deploy config
└── vite.config.ts              # Vite/Remix config
```

---

## 🔑 Required Shopify Scopes

```
read_orders
read_products
read_customers
read_reports
read_inventory
read_analytics
read_marketing_events
read_shipping
read_discounts
```

---

## 🤖 AI Features

StoreIQ uses **GPT-4o** for:
- **Daily insights** — Plain-English summaries of your store's performance
- **AI Advisor** — Structured report with insights, opportunities, and warnings
- **Natural Language Queries** — Translates plain English to ShopifyQL

AI insights are cached for 6 hours to minimize API costs.

---

## 📈 Roadmap

- [ ] Cohort retention analysis
- [ ] Customer Lifetime Value (CLV) engine
- [ ] Revenue forecasting (30/60/90 days)
- [ ] Anomaly detection & alerts
- [ ] Email digest reports
- [ ] Shopify App Store submission
- [ ] Multi-currency support
- [ ] POS analytics

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

Built with ❤️ using [Shopify App Bridge](https://shopify.dev/docs/api/app-bridge), [Polaris](https://polaris.shopify.com), [Remix](https://remix.run), and [OpenAI](https://openai.com).