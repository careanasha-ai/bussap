# Crestline — Shopify Business Intelligence App

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

### 🔄 Cohort Retention Analysis
- Monthly cohort table showing repeat purchase rates
- Retention curves by acquisition month
- Revenue per cohort over time
- Best-performing acquisition periods

### 📈 Revenue Forecasting
- 30/60/90-day revenue projections
- Trend-based forecasting using historical data
- Seasonal pattern detection
- Confidence intervals for projections

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

See the full [Shopify Partner Setup Guide](#-shopify-partner-setup-guide) below.

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials.

### 4. Set Up Database

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 5. Run Locally

```bash
npm run dev
```

---

## 🛍️ Shopify Partner Setup Guide

### Step 1: Create a Shopify Partner Account

1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Click **Join now** and complete registration
3. Verify your email address
4. You'll land on the **Partner Dashboard**

---

### Step 2: Create a Development Store

You need a test store to develop and install your app.

1. In Partner Dashboard → click **Stores** in the left sidebar
2. Click **Add store** → select **Development store**
3. Fill in:
   - **Store name**: e.g. `crestline-dev`
   - **Store purpose**: `Testing and building`
   - **Data**: Choose "Start with test data" (gives you sample orders/products)
4. Click **Save** — your dev store URL will be `crestline-dev.myshopify.com`

---

### Step 3: Create the App in Partner Dashboard

1. In Partner Dashboard → click **Apps** in the left sidebar
2. Click **Create app** → select **Create app manually**
3. Fill in:
   - **App name**: `Crestline`
   - **App URL**: `https://your-app.railway.app` *(update after Railway deploy)*
   - **Allowed redirection URL(s)**:
     ```
     https://your-app.railway.app/auth/callback
     https://your-app.railway.app/auth/shopify/callback
     https://your-app.railway.app/api/auth/callback
     ```
4. Click **Create app**
5. You'll see your **API key** and **API secret key** — copy both

---

### Step 4: Configure App Scopes

1. In your app settings → click **Configuration** tab
2. Under **Admin API integration** → click **Configure**
3. Enable these scopes:
   - `read_orders`
   - `read_products`
   - `read_customers`
   - `read_reports` *(required for ShopifyQL)*
   - `read_inventory`
   - `read_analytics`
   - `read_marketing_events`
   - `read_shipping`
   - `read_discounts`
4. Click **Save**

---

### Step 5: Update shopify.app.toml

Edit `shopify.app.toml` in the project root:

```toml
name = "Crestline"
client_id = "YOUR_API_KEY_FROM_STEP_3"
application_url = "https://YOUR_RAILWAY_URL.railway.app"
```

---

## 🚂 Railway Deployment Guide

### Step 1: Push to GitHub

```bash
git add -A
git commit -m "Configure for deployment"
git push origin master
```

### Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app) → **Login with GitHub**
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Choose `careanasha-ai/bussap`
5. Railway will detect the `railway.toml` and start building

### Step 3: Add PostgreSQL Database

1. In your Railway project → click **+ New**
2. Select **Database** → **Add PostgreSQL**
3. Railway creates the DB and auto-sets `DATABASE_URL` in your environment

### Step 4: Set Environment Variables

In Railway project → click your app service → **Variables** tab → add:

| Variable | Value |
|----------|-------|
| `SHOPIFY_API_KEY` | From Shopify Partner Dashboard |
| `SHOPIFY_API_SECRET` | From Shopify Partner Dashboard |
| `SHOPIFY_APP_URL` | Your Railway URL (e.g. `https://bussap-production.up.railway.app`) |
| `SESSION_SECRET` | Run `openssl rand -hex 32` to generate |
| `OPENAI_API_KEY` | From [platform.openai.com](https://platform.openai.com) |
| `NODE_ENV` | `production` |
| `SCOPES` | `read_orders,read_products,read_customers,read_reports,read_inventory,read_analytics,read_marketing_events,read_shipping,read_discounts` |

> `DATABASE_URL` is automatically injected by Railway's PostgreSQL plugin — do NOT set it manually.

### Step 5: Get Your Railway URL

1. In Railway → click your app service → **Settings** tab
2. Under **Networking** → click **Generate Domain**
3. Copy the URL (e.g. `https://bussap-production.up.railway.app`)

### Step 6: Update Shopify App URLs

Go back to Shopify Partner Dashboard → your app → **Configuration**:
- **App URL**: `https://bussap-production.up.railway.app`
- **Allowed redirection URLs**:
  ```
  https://bussap-production.up.railway.app/auth/callback
  https://bussap-production.up.railway.app/auth/shopify/callback
  https://bussap-production.up.railway.app/api/auth/callback
  ```

Also update `shopify.app.toml`:
```toml
application_url = "https://bussap-production.up.railway.app"
```

### Step 7: Run Database Migrations

Railway runs `npm run docker-start` which calls `prisma migrate deploy` automatically on each deploy. For the first deploy, this creates all tables.

To verify, check Railway logs — you should see:
```
✓ Generated Prisma Client
✓ Running migrations...
✓ Server started on port 3000
```

### Step 8: Install App on Dev Store

1. In Shopify Partner Dashboard → **Apps** → click **Crestline**
2. Click **Test your app** → select your development store
3. Click **Install app**
4. You'll be redirected through OAuth → app installs
5. You should see the Crestline dashboard inside your Shopify admin!

---

### Troubleshooting

**"App not found" error:**
- Check that `SHOPIFY_API_KEY` matches exactly what's in Partner Dashboard
- Ensure `SHOPIFY_APP_URL` has no trailing slash

**OAuth redirect mismatch:**
- Verify all 3 redirect URLs are added in Partner Dashboard
- URLs must match exactly (https, no trailing slash)

**Database connection error:**
- Check Railway logs — ensure PostgreSQL plugin is connected
- `DATABASE_URL` should be auto-set; if not, copy it from the PostgreSQL service

**ShopifyQL returns no data:**
- Ensure `read_reports` scope is enabled
- Dev stores with test data should return results immediately

---

## 📁 Project Structure

```
bussap/
├── app/
│   ├── routes/
│   │   ├── app._index.tsx        # Dashboard
│   │   ├── app.sales.tsx         # Sales analytics
│   │   ├── app.products.tsx      # Product intelligence
│   │   ├── app.customers.tsx     # Customer insights
│   │   ├── app.cohorts.tsx       # Cohort retention analysis
│   │   ├── app.forecast.tsx      # Revenue forecasting
│   │   ├── app.inventory.tsx     # Inventory management
│   │   ├── app.promotions.tsx    # Discount analytics
│   │   ├── app.ai-advisor.tsx    # AI Advisor
│   │   ├── app.ask.tsx           # NL Query interface
│   │   └── webhooks.tsx          # Webhook handlers
│   ├── services/
│   │   ├── shopifyql.server.ts   # ShopifyQL + NL→SQL
│   │   ├── ai.server.ts          # OpenAI integrations
│   │   ├── inventory.server.ts   # Inventory GraphQL
│   │   ├── customers.server.ts   # Customer GraphQL
│   │   ├── discounts.server.ts   # Discount GraphQL
│   │   └── forecast.server.ts    # Forecasting engine
│   ├── components/
│   │   ├── kpi-card/             # KPI metric cards
│   │   ├── insight-card/         # AI insight banners
│   │   └── charts/               # Recharts wrappers
│   ├── shopify.server.ts         # Shopify auth config
│   └── db.server.ts              # Prisma client
├── prisma/
│   └── schema.prisma             # Database schema
├── shopify.app.toml              # Shopify app config
├── railway.toml                  # Railway deploy config
└── vite.config.ts                # Vite/Remix config
```

---

## 🔑 Required Shopify Scopes

```
read_orders           read_products         read_customers
read_reports          read_inventory        read_analytics
read_marketing_events read_shipping         read_discounts
```

---

## 🤖 AI Features

Crestline uses **GPT-4o** for:
- **Daily insights** — Plain-English summaries of your store's performance
- **AI Advisor** — Structured report with insights, opportunities, and warnings
- **Natural Language Queries** — Translates plain English to ShopifyQL

AI insights are cached for 6 hours to minimize API costs.

---

## 📈 Roadmap

- [x] Dashboard with KPI cards
- [x] Sales analytics
- [x] Product intelligence
- [x] Customer insights
- [x] Inventory intelligence
- [x] Promotions analytics
- [x] AI Advisor
- [x] Natural language queries
- [x] Cohort retention analysis
- [x] Revenue forecasting
- [ ] Customer Lifetime Value (CLV) engine
- [ ] Anomaly detection & alerts
- [ ] Email digest reports
- [ ] Shopify App Store submission
- [ ] Multi-currency support
- [ ] POS analytics

---

## 📄 License

MIT License

---

Built with ❤️ using [Shopify App Bridge](https://shopify.dev/docs/api/app-bridge), [Polaris](https://polaris.shopify.com), [Remix](https://remix.run), and [OpenAI](https://openai.com).