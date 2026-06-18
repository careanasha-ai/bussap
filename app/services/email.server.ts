/**
 * Email Reports Service
 *
 * Generates and sends weekly/monthly digest reports.
 * Uses Resend (https://resend.com) as the email provider — free tier: 3,000 emails/month.
 * Falls back to console.log in development.
 *
 * To use: add RESEND_API_KEY to Railway environment variables.
 * Sign up free at resend.com — no credit card required.
 */

import prisma from "../db.server";
import { runShopifyQL } from "./shopifyql.server";

/**
 * Build the HTML email body for a weekly/monthly report
 */
function buildEmailHtml(data: {
  shopDomain: string;
  period: string;
  totalSales: number;
  orders: number;
  aov: number;
  newCustomers: number;
  returningCustomers: number;
  topProducts: Array<{ name: string; revenue: number; units: number }>;
  conversionRate: number;
  netSales: number;
  discounts: number;
  reportType: "weekly" | "monthly";
}): string {
  const {
    shopDomain, period, totalSales, orders, aov,
    newCustomers, returningCustomers, topProducts,
    conversionRate, netSales, discounts, reportType,
  } = data;

  const formatCurrency = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const topProductRows = topProducts.slice(0, 5).map((p, i) => `
    <tr style="border-bottom: 1px solid #f0f0f0;">
      <td style="padding: 10px 12px; color: #6d7175;">#${i + 1}</td>
      <td style="padding: 10px 12px; font-weight: 500;">${p.name}</td>
      <td style="padding: 10px 12px; text-align: right; color: #008060; font-weight: 600;">${formatCurrency(p.revenue)}</td>
      <td style="padding: 10px 12px; text-align: right; color: #6d7175;">${p.units} units</td>
    </tr>
  `).join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Crestline ${reportType === "weekly" ? "Weekly" : "Monthly"} Report</title>
</head>
<body style="margin: 0; padding: 0; background: #f6f6f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">

    <!-- Header -->
    <div style="background: #008060; border-radius: 12px 12px 0 0; padding: 28px 32px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 700;">📊 Crestline</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 15px;">
        ${reportType === "weekly" ? "Weekly" : "Monthly"} Report · ${period}
      </p>
      <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0; font-size: 13px;">${shopDomain}</p>
    </div>

    <!-- KPI Cards -->
    <div style="background: #fff; padding: 28px 32px; border-left: 1px solid #e1e3e5; border-right: 1px solid #e1e3e5;">
      <h2 style="margin: 0 0 20px; font-size: 16px; color: #202223; font-weight: 600;">Performance Summary</h2>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">

        <div style="background: #f6f6f7; border-radius: 8px; padding: 16px;">
          <p style="margin: 0; font-size: 12px; color: #6d7175; text-transform: uppercase; letter-spacing: 0.5px;">Total Sales</p>
          <p style="margin: 6px 0 0; font-size: 24px; font-weight: 700; color: #008060;">${formatCurrency(totalSales)}</p>
        </div>

        <div style="background: #f6f6f7; border-radius: 8px; padding: 16px;">
          <p style="margin: 0; font-size: 12px; color: #6d7175; text-transform: uppercase; letter-spacing: 0.5px;">Orders</p>
          <p style="margin: 6px 0 0; font-size: 24px; font-weight: 700; color: #202223;">${orders.toLocaleString()}</p>
        </div>

        <div style="background: #f6f6f7; border-radius: 8px; padding: 16px;">
          <p style="margin: 0; font-size: 12px; color: #6d7175; text-transform: uppercase; letter-spacing: 0.5px;">Avg. Order Value</p>
          <p style="margin: 6px 0 0; font-size: 24px; font-weight: 700; color: #202223;">${formatCurrency(aov)}</p>
        </div>

        <div style="background: #f6f6f7; border-radius: 8px; padding: 16px;">
          <p style="margin: 0; font-size: 12px; color: #6d7175; text-transform: uppercase; letter-spacing: 0.5px;">Conversion Rate</p>
          <p style="margin: 6px 0 0; font-size: 24px; font-weight: 700; color: #202223;">${conversionRate.toFixed(2)}%</p>
        </div>

        <div style="background: #f6f6f7; border-radius: 8px; padding: 16px;">
          <p style="margin: 0; font-size: 12px; color: #6d7175; text-transform: uppercase; letter-spacing: 0.5px;">New Customers</p>
          <p style="margin: 6px 0 0; font-size: 24px; font-weight: 700; color: #202223;">${newCustomers.toLocaleString()}</p>
        </div>

        <div style="background: #f6f6f7; border-radius: 8px; padding: 16px;">
          <p style="margin: 0; font-size: 12px; color: #6d7175; text-transform: uppercase; letter-spacing: 0.5px;">Returning Customers</p>
          <p style="margin: 6px 0 0; font-size: 24px; font-weight: 700; color: #202223;">${returningCustomers.toLocaleString()}</p>
        </div>

      </div>

      <!-- Net Sales breakdown -->
      <div style="margin-top: 20px; padding: 16px; background: #f0f9f5; border-radius: 8px; border-left: 4px solid #008060;">
        <p style="margin: 0; font-size: 13px; color: #6d7175;">
          Net Sales: <strong style="color: #008060;">${formatCurrency(netSales)}</strong>
          &nbsp;·&nbsp; Discounts Given: <strong style="color: #e51c00;">${formatCurrency(discounts)}</strong>
          &nbsp;·&nbsp; Discount Rate: <strong>${totalSales > 0 ? ((discounts / totalSales) * 100).toFixed(1) : 0}%</strong>
        </p>
      </div>
    </div>

    <!-- Top Products -->
    ${topProductRows ? `
    <div style="background: #fff; padding: 28px 32px; border-left: 1px solid #e1e3e5; border-right: 1px solid #e1e3e5; border-top: 1px solid #f0f0f0;">
      <h2 style="margin: 0 0 16px; font-size: 16px; color: #202223; font-weight: 600;">🏆 Top Products</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f6f6f7;">
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #6d7175; font-weight: 600;">#</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #6d7175; font-weight: 600;">Product</th>
            <th style="padding: 10px 12px; text-align: right; font-size: 12px; color: #6d7175; font-weight: 600;">Revenue</th>
            <th style="padding: 10px 12px; text-align: right; font-size: 12px; color: #6d7175; font-weight: 600;">Units</th>
          </tr>
        </thead>
        <tbody>${topProductRows}</tbody>
      </table>
    </div>
    ` : ""}

    <!-- Footer -->
    <div style="background: #f6f6f7; border-radius: 0 0 12px 12px; padding: 20px 32px; text-align: center; border: 1px solid #e1e3e5; border-top: none;">
      <p style="margin: 0; font-size: 13px; color: #6d7175;">
        Sent by <strong>Crestline</strong> · Business Intelligence for Shopify
      </p>
      <p style="margin: 8px 0 0; font-size: 12px; color: #8c9196;">
        View full report in your
        <a href="https://${shopDomain}/admin/apps/crestline" style="color: #008060;">Shopify admin</a>
        · To unsubscribe, update your
        <a href="https://${shopDomain}/admin/apps/crestline/app/settings" style="color: #008060;">email settings</a>
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();
}

/**
 * Send an email via Resend API
 */
async function sendEmail(opts: {
  to: string[];
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Development fallback — log to console
    console.log("📧 [EMAIL - no RESEND_API_KEY set]");
    console.log("To:", opts.to.join(", "));
    console.log("Subject:", opts.subject);
    console.log("HTML length:", opts.html.length, "chars");
    return true;
  }

  try {
    const fromEmail = process.env.EMAIL_FROM || "reports@crestline.app";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Crestline Reports <${fromEmail}>`,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Resend API error:", err);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Email send error:", err);
    return false;
  }
}

/**
 * Generate and send a report for a shop
 */
export async function sendEmailReport(
  admin: any,
  shopDomain: string,
  reportType: "weekly" | "monthly"
): Promise<{ success: boolean; message: string }> {
  try {
    // Get shop + settings
    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
      include: { settings: true },
    });

    if (!shop?.settings?.emailReportsEnabled) {
      return { success: false, message: "Email reports not enabled for this shop." };
    }

    const recipients = shop.settings.emailReportRecipients;
    if (!recipients || recipients.length === 0) {
      return { success: false, message: "No recipients configured." };
    }

    const since = reportType === "weekly" ? "last_7_days" : "last_month";
    const periodLabel = reportType === "weekly"
      ? `Week of ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "long", year: "numeric" });

    // Fetch data in parallel
    const [salesResult, productsResult, customersResult, sessionsResult] = await Promise.allSettled([
      runShopifyQL(admin, `FROM sales SHOW total_sales, net_sales, orders, average_order_value, discounts SINCE ${since}`),
      runShopifyQL(admin, `FROM sales SHOW total_sales, units_sold, product_title GROUP BY product_title SINCE ${since} ORDER BY total_sales DESC LIMIT 5`),
      runShopifyQL(admin, `FROM customers SHOW customer_count GROUP BY customer_type SINCE ${since}`),
      runShopifyQL(admin, `FROM sessions SHOW sessions, conversion_rate SINCE ${since}`),
    ]);

    const sales = salesResult.status === "fulfilled" ? salesResult.value?.rows?.[0] : null;
    const products = productsResult.status === "fulfilled" ? productsResult.value?.rows ?? [] : [];
    const customers = customersResult.status === "fulfilled" ? customersResult.value?.rows ?? [] : [];
    const sessions = sessionsResult.status === "fulfilled" ? sessionsResult.value?.rows?.[0] : null;

    const newCustomers = customers.find((r: any) => r.customer_type === "new");
    const returningCustomers = customers.find((r: any) => r.customer_type === "returning");

    const topProducts = products.map((p: any) => ({
      name: p.product_title || "Unknown",
      revenue: parseFloat(p.total_sales || "0"),
      units: parseInt(p.units_sold || "0"),
    }));

    const html = buildEmailHtml({
      shopDomain,
      period: periodLabel,
      totalSales: parseFloat(sales?.total_sales ?? "0"),
      netSales: parseFloat(sales?.net_sales ?? "0"),
      orders: parseInt(sales?.orders ?? "0"),
      aov: parseFloat(sales?.average_order_value ?? "0"),
      discounts: parseFloat(sales?.discounts ?? "0"),
      newCustomers: parseInt(newCustomers?.customer_count ?? "0"),
      returningCustomers: parseInt(returningCustomers?.customer_count ?? "0"),
      topProducts,
      conversionRate: parseFloat(sessions?.conversion_rate ?? "0"),
      reportType,
    });

    const subject = `📊 Crestline ${reportType === "weekly" ? "Weekly" : "Monthly"} Report — ${periodLabel}`;
    const sent = await sendEmail({ to: recipients, subject, html });

    // Log to DB
    await prisma.emailReport.create({
      data: {
        shopId: shop.id,
        type: reportType,
        recipients,
        subject,
        status: sent ? "sent" : "failed",
        data: { totalSales: sales?.total_sales, orders: sales?.orders },
      },
    });

    return {
      success: sent,
      message: sent
        ? `Report sent to ${recipients.join(", ")}`
        : "Failed to send email. Check RESEND_API_KEY.",
    };
  } catch (err: any) {
    console.error("sendEmailReport error:", err);
    return { success: false, message: err.message || "Unknown error" };
  }
}

/**
 * Get email report history for a shop
 */
export async function getEmailReportHistory(shopDomain: string) {
  try {
    const shop = await prisma.shop.findUnique({ where: { shopDomain } });
    if (!shop) return [];

    return await prisma.emailReport.findMany({
      where: { shopId: shop.id },
      orderBy: { sentAt: "desc" },
      take: 20,
    });
  } catch {
    return [];
  }
}