import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

  if (!admin && topic !== "APP_UNINSTALLED") {
    throw new Response();
  }

  switch (topic) {
    case "APP_UNINSTALLED":
      if (session) {
        await prisma.session.deleteMany({ where: { shop } });
        await prisma.shop.deleteMany({ where: { shopDomain: shop } });
      }
      break;

    case "ORDERS_CREATE":
    case "ORDERS_UPDATED":
    case "ORDERS_PAID":
    case "ORDERS_CANCELLED":
      // Invalidate cached analytics for this shop
      await prisma.cacheEntry.deleteMany({
        where: {
          shop: { shopDomain: shop },
          key: { startsWith: "analytics:" },
        },
      });
      break;

    case "PRODUCTS_CREATE":
    case "PRODUCTS_UPDATE":
      await prisma.cacheEntry.deleteMany({
        where: {
          shop: { shopDomain: shop },
          key: { startsWith: "products:" },
        },
      });
      break;

    case "CUSTOMERS_CREATE":
    case "CUSTOMERS_UPDATE":
      await prisma.cacheEntry.deleteMany({
        where: {
          shop: { shopDomain: shop },
          key: { startsWith: "customers:" },
        },
      });
      break;

    case "INVENTORY_LEVELS_UPDATE":
      await prisma.cacheEntry.deleteMany({
        where: {
          shop: { shopDomain: shop },
          key: { startsWith: "inventory:" },
        },
      });
      break;

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  throw new Response();
};