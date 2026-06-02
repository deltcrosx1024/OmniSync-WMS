import { connectToMongo } from "../db/connection";
import { ProductModel } from "../db/schemas/product";
import { InventoryModel } from "../db/schemas/inventory";
import { generateBarcodeForSKU } from "../barcode";

let accessToken: string | null = null;
let tokenExpiresAt: number = 0;

const LOYVERSE_CLIENT_ID = process.env.LOYVERSE_CLIENT_ID;
const LOYVERSE_CLIENT_SECRET = process.env.LOYVERSE_CLIENT_SECRET;
const LOYVERSE_TOKEN_URL = process.env.LOYVERSE_TOKEN_URL || "https://api.loyverse.com/oauth/token";
const LOYVERSE_API_BASE_URL = process.env.LOYVERSE_API_BASE_URL || "https://api.loyverse.com";

interface OAuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface LoyverseItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  price: number;
  cost?: number;
  inventory_quantity?: number;
}

async function requestToken(body: Record<string, unknown>) {
  const response = await fetch(LOYVERSE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Loyverse token request failed: ${response.statusText}`);
  }

  const data = (await response.json()) as OAuthResponse;
  if (!data.access_token || !data.refresh_token) {
    throw new Error("Loyverse token endpoint returned an invalid payload.");
  }

  return data;
}

export async function exchangeAuthorizationCode(code: string, redirectUri: string) {
  if (!LOYVERSE_CLIENT_ID || !LOYVERSE_CLIENT_SECRET) {
    throw new Error("Loyverse OAuth credentials are not configured.");
  }

  return requestToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: LOYVERSE_CLIENT_ID,
    client_secret: LOYVERSE_CLIENT_SECRET,
  });
}

export async function refreshAccessToken(refreshToken: string) {
  if (!LOYVERSE_CLIENT_ID || !LOYVERSE_CLIENT_SECRET) {
    throw new Error("Loyverse OAuth credentials are not configured.");
  }

  return requestToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: LOYVERSE_CLIENT_ID,
    client_secret: LOYVERSE_CLIENT_SECRET,
  });
}

async function fetchItemsPage(accessToken: string, cursor?: string | null) {
  const url = new URL(`${LOYVERSE_API_BASE_URL}/v1/items`);
  url.searchParams.set("limit", "100");
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Loyverse items: ${response.statusText}`);
  }

  return response.json();
}

export async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiresAt * 1000 - 60 * 1000) {
    return accessToken;
  }

  if (!LOYVERSE_CLIENT_ID || !LOYVERSE_CLIENT_SECRET) {
    throw new Error("Loyverse client credentials are not configured");
  }

  const response = await fetch(LOYVERSE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: LOYVERSE_CLIENT_ID,
      client_secret: LOYVERSE_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Loyverse access token: ${response.statusText}`);
  }

  const data = await response.json();
  const token = data.access_token;
  if (!token || typeof token !== "string") {
    throw new Error("Invalid Loyverse token response");
  }

  accessToken = token;
  tokenExpiresAt = Date.now() / 1000 + data.expires_in;
  return token;
}

export async function syncLoyverseItems(accessToken: string) {
  await connectToMongo();

  let cursor: string | null = null;
  let syncedCount = 0;

  do {
    const response = await fetchItemsPage(accessToken, cursor);
    const items: LoyverseItem[] = response.items || [];

    for (const item of items) {
      if (!item.sku || !item.name) {
        continue;
      }

      const product = await ProductModel.findOneAndUpdate(
        { sku: item.sku },
        {
          $set: {
            name: item.name,
            description: item.description || null,
            category: item.category || null,
            price: item.price,
            cost: typeof item.cost === "number" ? item.cost : 0,
            loyverseId: item.id,
            lastSyncedAt: new Date(),
            status: "active",
          },
          $setOnInsert: {
            barcode: generateBarcodeForSKU(item.sku),
          },
        },
        { upsert: true, new: true }
      );

      if (product && !product.barcode) {
        product.barcode = generateBarcodeForSKU(product.sku);
        await product.save();
      }

      if (product) {
        await InventoryModel.findOneAndUpdate(
          { productId: product._id },
          {
            $setOnInsert: {
              productId: product._id,
              available_quantity: typeof item.inventory_quantity === "number" ? item.inventory_quantity : 0,
              reserved_quantity: 0,
              location: "main",
              version: 0,
              lastUpdated: new Date(),
            },
          },
          { upsert: true, new: true }
        );
      }

      syncedCount += 1;
    }

    cursor = response.cursor?.next || null;
  } while (cursor);

  return syncedCount;
}
