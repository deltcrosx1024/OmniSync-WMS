import { NextResponse } from "next/server";
import { connectToMongo, getMongoDb, MONGODB_INVENTORY_DB } from "../../lib/db/connection";
import { getProductModel } from "../../lib/db/schemas/product";
import { getInventoryModel } from "../../lib/db/schemas/inventory";

export async function POST(request: Request) {
  await connectToMongo();
  const inventoryDb = getMongoDb(MONGODB_INVENTORY_DB);
  const ProductModel = getProductModel(inventoryDb);
  const InventoryModel = getInventoryModel(inventoryDb);
  await ProductModel.createCollection().catch(() => {});
  await InventoryModel.createCollection().catch(() => {});

  const body = await request.json();
  const barcode = typeof body.barcode === "string" ? body.barcode.trim() : undefined;
  const sku = typeof body.sku === "string" ? body.sku.trim() : undefined;
  const quantity = typeof body.quantity === "number" && body.quantity > 0 ? body.quantity : 1;

  if (!barcode && !sku) {
    return NextResponse.json({ error: "Missing barcode or SKU." }, { status: 400 });
  }

  const product = barcode
    ? await ProductModel.findOne({ barcode })
    : await ProductModel.findOne({ sku });

  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const inventory = await InventoryModel.findOne({ productId: product._id });
  if (!inventory) {
    return NextResponse.json({ error: "Inventory record not found." }, { status: 404 });
  }

  if (inventory.available_quantity < quantity) {
    return NextResponse.json(
      {
        error: "Insufficient stock.",
        available_quantity: inventory.available_quantity,
        requested_quantity: quantity,
      },
      { status: 409 }
    );
  }

  const updated = await InventoryModel.findOneAndUpdate(
    {
      _id: inventory._id,
      version: inventory.version,
      available_quantity: { $gte: quantity },
    },
    {
      $inc: {
        available_quantity: -quantity,
        reserved_quantity: quantity,
        version: 1,
      },
      $set: {
        lastUpdated: new Date(),
      },
    },
    { new: true }
  );

  if (!updated) {
    return NextResponse.json({ error: "Stock reservation conflict. Please retry." }, { status: 409 });
  }

  return NextResponse.json({
    success: true,
    product: {
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
      price: product.price,
    },
    inventory: {
      available_quantity: updated.available_quantity,
      reserved_quantity: updated.reserved_quantity,
      version: updated.version,
    },
  });
}
