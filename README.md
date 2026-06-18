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
| 💳 Plans & Billing | Shopify-native subscription management (Free/Growth/Pro/Scale) |
| ⚙️ Settings | Email reports, AI preferences, dashboard defaults |

---

## 🚀 How Deployment Works

This app deploys **automatically from GitHub to Railway** — no local setup needed.

```
GitHub push → Railway detects change → builds → migrates DB → starts server
```

**Build pipeline (defined in railway.toml):**
1. `npm install` + `prisma generate` (postinstall)
2. `prisma migrate deploy` — runs DB migrations on Railway PostgreSQL
3. `remix vite:build` — compiles the Remix app
4. `remix-serve ./build/server/index.js` — starts the production server

---

## 🛍️ Shopify Partner Setup Guide

### Step 1: Create a Shopify Partner Account
1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Click **Join now** and complete registration
3. Verify your email — you'll land on the **Partner Dashboard**

### Step 2: Create a Development Store
1. Partner Dashboard → **Stores** → **Add store**
2. Select **Development store**
3. Fill in store name (e.g. `crestline-dev`), purpose: `Testing and building`
4. Choose **"Start with test data"** — gives you sample orders/products/customers
5. Click **Save**

### Step 3: Create the App
1. Partner Dashboard → **Apps** → **Create app** → **Create app manually**
2. App name: `Crestline`
3. App URL: `https://your-app.railway.app` *(update after Railway deploy)*
4. Allowed redirection URLs:
   ```
   https://your-app.railway.app/auth/callback
   https://your-app.railway.app/auth/shopify/callback
   https://your-app.railway.app/api/auth/callback
   ```
5. Click **Create app** → copy **API key** and **API secret key**

### Step 4: Configure App Scopes
App settings → **Configuration** → **Admin API integration** → **Configure**

Enable: `read_orders`, `read_products`, `read_customers`, `read_reports`,
`read_inventory`, `read_analytics`, `read_marketing_events`, `read_shipping`, `read_discounts`

### Step 5: Update shopify.app.toml
```toml
name = "Crestline"
client_id = "YOUR_API_KEY"
application_url = "https://YOUR_RAILWAY_URL.railway.app"
```
Commit and push — Railway auto-redeploys.

---

## 🚂 Railway Deployment Guide

> **No local setup needed.** Railway deploys automatically from GitHub on every push.

### Step 1: Create Railway Project
1. [railway.app](https://railway.app) → **Login with GitHub**
2. **New Project** → **Deploy from GitHub repo** → select `careanasha-ai/bussap`

### Step 2: Add PostgreSQL
1. In Railway project → **+ New** → **Database** → **Add PostgreSQL**
2. `DATABASE_URL` is **auto-injected** — do NOT set it manually

### Step 3: Set Environment Variables
Railway → app service → **Variables** tab:

| Variable | Value |
|----------|-------|
| `SHOPIFY_API_KEY` | From Shopify Partner Dashboard |
| `SHOPIFY_API_SECRET` | From Shopify Partner Dashboard |
| `SHOPIFY_APP_URL` | `https://your-app.railway.app` |
| `SESSION_SECRET` | Random 32+ char string (`openssl rand -hex 32`) |
| `OPENAI_API_KEY` | From [platform.openai.com](https://platform.openai.com/api-keys) |
| `RESEND_API_KEY` | From [resend.com](https://resend.com) (free, for email reports) |
| `EMAIL_FROM` | `reports@yourdomain.com` |
| `NODE_ENV` | `production` |
| `SCOPES` | `read_orders,read_products,read_customers,read_reports,read_inventory,read_analytics,read_marketing_events,read_shipping,read_discounts` |

### Step 4: Get Your Railway URL
Railway → app service → **Settings** → **Networking** → **Generate Domain**

### Step 5: Update Shopify App URLs
Partner Dashboard → your app → **Configuration**:
- **App URL**: `https://bussap-production.up.railway.app`
- **Redirect URLs** (all 3):
  ```
  https://bussap-production.up.railway.app/auth/callback
  https://bussap-production.up.railway.app/auth/shopify/callback
  https://bussap-production.up.railway.app/api/auth/callback
  ```

### Step 6: Install on Dev Store
Partner Dashboard → **Apps** → **Crestline** → **Select store** → **Install app** 🎉

---

## 🔧 Troubleshooting

| Error | Fix |
|-------|-----|
| "App not found" | Check `SHOPIFY_API_KEY` matches Partner Dashboard exactly |
| OAuth redirect mismatch | Add all 3 redirect URLs in Partner Dashboard |
| `DATABASE_URL` error | Add PostgreSQL plugin — do NOT set manually |
| ShopifyQL returns empty | Ensure `read_reports` scope is enabled |
| Email not sending | Add `RESEND_API_KEY` to Railway env vars |
| Build fails | Check Railway deploy logs for specific error |

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
│   │   ├── app.billing.tsx       # Plans & Billing
│   │   ├── app.settings.tsx      # Settings page
│   │   └── webhooks.tsx          # Webhook handlers
│   ├── services/
│   │   ├── shopifyql.server.ts   # ShopifyQL executor + NL→SQL
│   │   ├── ai.server.ts          # All GPT-4o insight generators
│   │   ├── billing.server.ts     # Shopify Billing API + plan management
│   │   ├── email.server.ts       # Email reports via Resend
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
│   ├── shopify.server.ts
│   └── db.server.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│       ├── 20260618_init/
│       └── 20260618_billing_settings/
├── shopify.app.toml
├── railway.toml
├── vite.config.ts
└── .env.example
```

---

## 💳 Pricing Plans

| Plan | Price | Key Features |
|------|-------|-------------|
| **Free** | $0/mo | Dashboard, Sales overview, 30-day history |
| **Growth** | $19/mo | 1-year history, Inventory, Promotions, Email reports, Basic AI |
| **Pro** | $49/mo | Cohort retention, Forecasting, AI Advisor, NL queries |
| **Scale** | $99/mo | Unlimited history, Priority AI, Custom reports, API access |

All paid plans include a **14-day free trial**. Billing handled by Shopify.

---

## 🤖 AI Features (GPT-4o)

All AI insights are cached for 6 hours to minimize API costs.

- Daily dashboard insight
- Sales, product, customer, inventory, promotion insights
- Cohort retention benchmark comparison
- Revenue forecast explanation
- Full AI Advisor report (insights + opportunities + warnings)
- Natural language → ShopifyQL translation

---

## 📧 Email Reports (Resend)

Weekly and monthly HTML email digests including:
- Revenue, orders, AOV, conversion rate
- New vs returning customers
- Top 5 products
- Discount rate summary

Requires `RESEND_API_KEY` (free at resend.com, 3,000 emails/month).

---

## 📈 Roadmap

- [x] Dashboard, Sales, Products, Customers, Inventory, Promotions
- [x] AI Advisor + Natural language queries
- [x] Cohort retention analysis
- [x] Revenue forecasting
- [x] Shopify Billing API (Free/Growth/Pro/Scale plans)
- [x] Email reports (Resend)
- [x] Settings page
- [ ] Customer Lifetime Value (CLV) engine
- [ ] Anomaly detection & real-time alerts
- [ ] Shopify App Store submission
- [ ] Multi-currency support
- [ ] POS analytics

---

Built with ❤️ using [Shopify App Bridge](https://shopify.dev/docs/api/app-bridge), [Polaris](https://polaris.shopify.com), [Remix](https://remix.run), [OpenAI](https://openai.com), and [Resend](https://resend.com).
