import { NextResponse } from "next/server";
import { connectToMongo, getMongoDb, MONGODB_INVENTORY_DB } from "../../lib/db/connection";
import { getProductModel } from "../../lib/db/schemas/product";

export async function GET() {
  const checks = {
    mongodb: "disconnected" as "connected" | "disconnected",
    loyverse: "disconnected" as "connected" | "disconnected",
  };

  try {
    await connectToMongo();
    const inventoryDb = getMongoDb(MONGODB_INVENTORY_DB);
    const ProductModel = getProductModel(inventoryDb);
    await ProductModel.findOne().lean().maxTimeMS(2000);
    checks.mongodb = "connected";
  } catch {
    checks.mongodb = "disconnected";
  }

  try {
    const clientId = process.env.LOYVERSE_CLIENT_ID;
    const clientSecret = process.env.LOYVERSE_CLIENT_SECRET;
    const tokenUrl = process.env.LOYVERSE_TOKEN_URL || "https://api.loyverse.com/oauth/token";

    if (clientId && clientSecret) {
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }),
        signal: AbortSignal.timeout(3000),
      });
      checks.loyverse = response.ok ? "connected" : "disconnected";
    }
  } catch {
    checks.loyverse = "disconnected";
  }

  return NextResponse.json(checks);
}