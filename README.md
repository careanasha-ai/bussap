# Crestline — Shopify Business Intelligence App

> AI-powered analytics and insights for Shopify merchants. Understand your store's performance at a glance with intelligent dashboards, natural language queries, and proactive AI recommendations.

---

## ✨ Features

| Module | Description |
|--------|-------------|
| 📊 Dashboard | KPIs, 30-day revenue chart, top products, AI daily insight |
| 💰 Sales Analytics | Revenue trends, by channel, geography, discount impact |
| 📦 Product Intelligence | Top sellers, slow movers, variants, inventory alerts |
| 👥 Customer Insights | New vs returning, top customers by LTV, geography |
| 🔄 Cohort Retention | Monthly cohort heatmap, M+1 to M+6 retention rates |
| 🔮 Revenue Forecasting | 30/60/90-day projections, trend detection, seasonal adjustment |
| 📦 Inventory Intelligence | Days of stock, velocity, reorder alerts |
| 🏷️ Promotions | Discount code performance, discount rate analysis |
| 🤖 AI Advisor | GPT-4o daily insights, opportunities, warnings |
| 💬 Ask Your Store | Natural language → ShopifyQL query interface |

---

## 🚀 How Deployment Works

This app deploys **automatically from GitHub to Railway** — no local setup needed.

```
GitHub push → Railway detects change → builds → migrates DB → starts server
```

**Build pipeline (defined in railway.toml):**
1. `prisma generate` — generates Prisma client
2. `prisma migrate deploy` — runs DB migrations on Railway's PostgreSQL
3. `remix vite:build` — compiles the Remix app
4. `remix-serve ./build/server/index.js` — starts the production server

---

## 🛍️ Shopify Partner Setup Guide

### Step 1: Create a Shopify Partner Account

1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Click **Join now** and complete registration
3. Verify your email — you'll land on the **Partner Dashboard**

---

### Step 2: Create a Development Store

1. Partner Dashboard → **Stores** → **Add store**
2. Select **Development store**
3. Fill in:
   - **Store name**: e.g. `crestline-dev`
   - **Store purpose**: `Testing and building`
   - **Data**: Choose **"Start with test data"** (gives you sample orders/products/customers)
4. Click **Save** — your dev store URL: `crestline-dev.myshopify.com`

---

### Step 3: Create the App

1. Partner Dashboard → **Apps** → **Create app** → **Create app manually**
2. Fill in:
   - **App name**: `Crestline`
   - **App URL**: `https://your-app.railway.app` *(update after Railway deploy)*
   - **Allowed redirection URL(s)**:
     ```
     https://your-app.railway.app/auth/callback
     https://your-app.railway.app/auth/shopify/callback
     https://your-app.railway.app/api/auth/callback
     ```
3. Click **Create app**
4. Copy your **API key** and **API secret key**

---

### Step 4: Configure App Scopes

1. App settings → **Configuration** tab → **Admin API integration** → **Configure**
2. Enable these scopes:
   - `read_orders`
   - `read_products`
   - `read_customers`
   - `read_reports` *(required for ShopifyQL analytics)*
   - `read_inventory`
   - `read_analytics`
   - `read_marketing_events`
   - `read_shipping`
   - `read_discounts`
3. Click **Save**

---

### Step 5: Update shopify.app.toml

Edit `shopify.app.toml` in the repo:

```toml
name = "Crestline"
client_id = "YOUR_API_KEY_FROM_STEP_3"
application_url = "https://YOUR_RAILWAY_URL.railway.app"
```

Commit and push — Railway will auto-redeploy.

---

## 🚂 Railway Deployment Guide

> **No local setup needed.** Railway deploys automatically from GitHub on every push.

### Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app) → **Login with GitHub**
2. Click **New Project** → **Deploy from GitHub repo**
3. Select `careanasha-ai/bussap`
4. Railway detects `railway.toml` and starts the first build automatically

### Step 2: Add PostgreSQL Database

1. In your Railway project → click **+ New**
2. Select **Database** → **Add PostgreSQL**
3. Railway creates the DB and **auto-injects `DATABASE_URL`** into your app's environment

### Step 3: Set Environment Variables

In Railway → click your **app service** → **Variables** tab → add:

| Variable | Value | Where to get it |
|----------|-------|-----------------|
| `SHOPIFY_API_KEY` | Your app's API key | Shopify Partner Dashboard → App → API credentials |
| `SHOPIFY_API_SECRET` | Your app's API secret | Shopify Partner Dashboard → App → API credentials |
| `SHOPIFY_APP_URL` | `https://your-app.railway.app` | Railway → your service → Settings → Networking |
| `SESSION_SECRET` | Random 32+ char string | Generate: `openssl rand -hex 32` |
| `OPENAI_API_KEY` | Your OpenAI key | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `NODE_ENV` | `production` | Hardcode this |
| `SCOPES` | `read_orders,read_products,read_customers,read_reports,read_inventory,read_analytics,read_marketing_events,read_shipping,read_discounts` | Copy exactly |

> ⚠️ Do **NOT** set `DATABASE_URL` manually — Railway injects it automatically from the PostgreSQL plugin.

### Step 4: Get Your Railway App URL

1. Railway → your app service → **Settings** tab
2. Under **Networking** → click **Generate Domain**
3. Copy the URL: e.g. `https://bussap-production.up.railway.app`

### Step 5: Update Shopify App URLs

Go back to **Shopify Partner Dashboard** → your app → **Configuration**:

- **App URL**: `https://bussap-production.up.railway.app`
- **Allowed redirection URLs** (add all 3):
  ```
  https://bussap-production.up.railway.app/auth/callback
  https://bussap-production.up.railway.app/auth/shopify/callback
  https://bussap-production.up.railway.app/api/auth/callback
  ```

Also update `shopify.app.toml`:
```toml
application_url = "https://bussap-production.up.railway.app"
```

Push the change → Railway auto-redeploys.

### Step 6: Verify the Build

In Railway → your service → **Deployments** tab → click the latest deployment → **View logs**.

You should see:
```
✓ Generated Prisma Client
✓ Applied migration 20260618_init
✓ Built Remix app
✓ Server started on port 3000
```

### Step 7: Install App on Dev Store

1. Shopify Partner Dashboard → **Apps** → click **Crestline**
2. Click **Select store** → choose your development store
3. Click **Install app**
4. You'll go through OAuth → app installs
5. 🎉 Crestline dashboard appears inside your Shopify admin!

---

## 🔧 Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| "App not found" | Wrong API key | Check `SHOPIFY_API_KEY` matches Partner Dashboard exactly |
| OAuth redirect mismatch | URL not registered | Add all 3 redirect URLs in Partner Dashboard |
| `DATABASE_URL` error | PostgreSQL not connected | Add PostgreSQL plugin in Railway, do NOT set manually |
| ShopifyQL returns empty | Missing scope | Ensure `read_reports` is enabled in app scopes |
| Build fails: "prisma not found" | Missing devDep | `prisma` is in devDependencies — Railway installs all deps by default |
| Port binding error | Wrong PORT | Railway sets `PORT` automatically — app uses `process.env.PORT` |

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
│   │   ├── shopifyql.server.ts   # ShopifyQL executor + NL→SQL
│   │   ├── ai.server.ts          # All GPT-4o insight generators
│   │   ├── cohorts.server.ts     # Cohort retention builder
│   │   ├── forecast.server.ts    # Revenue forecasting engine
│   │   ├── inventory.server.ts   # Inventory GraphQL queries
│   │   ├── customers.server.ts   # Customer GraphQL queries
│   │   └── discounts.server.ts   # Discount GraphQL queries
│   ├── components/
│   │   ├── kpi-card/KpiCard.tsx
│   │   ├── insight-card/InsightCard.tsx
│   │   └── charts/
│   │       ├── SalesChart.tsx
│   │       ├── TopProductsChart.tsx
│   │       ├── ForecastChart.tsx
│   │       └── GeoChart.tsx
│   ├── shopify.server.ts         # Shopify OAuth config
│   └── db.server.ts              # Prisma client singleton
├── prisma/
│   ├── schema.prisma             # DB schema
│   └── migrations/               # SQL migrations (auto-applied on deploy)
├── shopify.app.toml              # Shopify app config
├── railway.toml                  # Railway build + deploy config
├── vite.config.ts                # Vite/Remix config
└── .env.example                  # Environment variable template
```

---

## 🔑 Required Shopify Scopes

```
read_orders           read_products         read_customers
read_reports          read_inventory        read_analytics
read_marketing_events read_shipping         read_discounts
```

---

## 🤖 AI Features (GPT-4o)

| Feature | Description | Cache TTL |
|---------|-------------|-----------|
| Daily Insight | Dashboard summary with action tip | 6 hours |
| Sales Insight | Revenue trend analysis | 6 hours |
| Product Insight | Top/slow mover analysis | 6 hours |
| Customer Insight | Retention rate analysis | 6 hours |
| Inventory Insight | Stock health summary | 6 hours |
| Promotion Insight | Discount strategy analysis | 6 hours |
| Cohort Insight | Retention benchmark comparison | 6 hours |
| Forecast Insight | Revenue trend explanation | 6 hours |
| AI Advisor Report | Full structured JSON report | 6 hours |
| NL Query | Plain English → ShopifyQL | No cache |

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
- [ ] Anomaly detection & real-time alerts
- [ ] Email digest reports
- [ ] Shopify App Store submission
- [ ] Multi-currency support
- [ ] POS analytics

---

Built with ❤️ using [Shopify App Bridge](https://shopify.dev/docs/api/app-bridge), [Polaris](https://polaris.shopify.com), [Remix](https://remix.run), and [OpenAI](https://openai.com).
