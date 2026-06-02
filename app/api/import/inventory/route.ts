import { NextResponse } from "next/server";
import { connectToMongo, getMongoDb, MONGODB_INVENTORY_DB } from "../../../lib/db/connection";
import { getProductModel } from "../../../lib/db/schemas/product";
import { getInventoryModel } from "../../../lib/db/schemas/inventory";
import { generateBarcodeForSKU } from "../../../lib/barcode";
import { InventoryImportRow, normalizeImportRows, parseInventoryFile } from "../../../lib/importHelpers";

async function upsertInventoryRow(row: InventoryImportRow, ProductModel: ReturnType<typeof getProductModel>, InventoryModel: ReturnType<typeof getInventoryModel>) {
  const normalizedSku = row.sku.trim();
  const product = await ProductModel.findOneAndUpdate(
    { sku: normalizedSku },
    {
      $set: {
        name: row.name.trim(),
        description: row.description || null,
        category: row.category || null,
        price: row.price,
        cost: row.cost ?? 0,
        loyverseId: row.sku,
        lastSyncedAt: new Date(),
        status: row.status || "active",
      },
      $setOnInsert: {
        barcode: row.barcode || generateBarcodeForSKU(normalizedSku),
      },
    },
    { upsert: true, new: true }
  );

  if (product && !product.barcode) {
    product.barcode = generateBarcodeForSKU(normalizedSku);
    await product.save();
  }

  if (product) {
    await InventoryModel.findOneAndUpdate(
      { productId: product._id },
      {
        $set: {
          available_quantity: Number(row.available_quantity || 0),
          reserved_quantity: Number(row.reserved_quantity || 0),
          location: row.location || "main",
          lastUpdated: new Date(),
        },
        $setOnInsert: {
          version: 0,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
}

export async function POST(request: Request) {
  await connectToMongo();
  const inventoryDb = getMongoDb(MONGODB_INVENTORY_DB);
  const ProductModel = getProductModel(inventoryDb);
  const InventoryModel = getInventoryModel(inventoryDb);
  await ProductModel.createCollection().catch(() => {});
  await InventoryModel.createCollection().catch(() => {});

  const contentType = request.headers.get("content-type") || "";
  let rows: InventoryImportRow[] = [];

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    if (file && file instanceof File) {
      rows = await parseInventoryFile(file);
    }
  } else {
    const body = await request.json().catch(() => ({}));
    if (Array.isArray(body.items)) {
      rows = normalizeImportRows(body.items as InventoryImportRow[]);
    }
  }

  if (!rows.length) {
    return NextResponse.json({ error: "No inventory rows found to import." }, { status: 400 });
  }

  const normalizedRows = normalizeImportRows(rows);
  for (const row of normalizedRows) {
    if (!row.sku || !row.name) {
      continue;
    }
    await upsertInventoryRow(row, ProductModel, InventoryModel);
  }

  return NextResponse.json({ success: true, imported: normalizedRows.length });
}
