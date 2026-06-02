// app/api/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToMongo, getMongoDb, MONGODB_INVENTORY_DB, MONGODB_POS_DB } from "../../lib/db/connection";
import { getProductModel } from "../../lib/db/schemas/product";
import { getInventoryModel } from "../../lib/db/schemas/inventory";
import { getTransactionModel } from "../../lib/db/schemas/transaction";

export async function POST(request: NextRequest) {
  await connectToMongo();
  const inventoryDb = getMongoDb(MONGODB_INVENTORY_DB);
  const posDb = getMongoDb(MONGODB_POS_DB);

  const ProductModel = getProductModel(inventoryDb);
  const InventoryModel = getInventoryModel(inventoryDb);
  const TransactionModel = getTransactionModel(posDb);
  await ProductModel.createCollection().catch(() => {});
  await InventoryModel.createCollection().catch(() => {});
  await TransactionModel.createCollection().catch(() => {});
  const session = await inventoryDb.startSession();
  session.startTransaction();

  try {
    const { items, shiftId } = await request.json();

    if (!Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      return NextResponse.json({ error: "Invalid items list" }, { status: 400 });
    }

    const transactionEntries: any[] = [];

    for (const item of items) {
      const { sku, quantity } = item;

      if (!sku || typeof quantity !== "number" || quantity <= 0) {
        await session.abortTransaction();
        return NextResponse.json({ error: `Invalid item: ${JSON.stringify(item)}` }, { status: 400 });
      }

      const product = await ProductModel.findOne({ sku }).session(session);
      if (!product) {
        await session.abortTransaction();
        return NextResponse.json({ error: `Product not found for SKU: ${sku}` }, { status: 404 });
      }

      const inventory = await InventoryModel.findOne({ productId: product._id }).session(session);
      if (!inventory) {
        await session.abortTransaction();
        return NextResponse.json({ error: `Inventory not found for product: ${product.name}` }, { status: 404 });
      }

      if (inventory.available_quantity < quantity) {
        await session.abortTransaction();
        return NextResponse.json({ error: `Insufficient stock for SKU: ${sku}. Available: ${inventory.available_quantity}, requested: ${quantity}` }, { status: 400 });
      }

      const result = await InventoryModel.updateOne(
        { _id: inventory._id, version: inventory.version },
        {
          $inc: {
            available_quantity: -quantity,
            reserved_quantity: quantity,
            version: 1,
          },
          $set: {
            lastUpdated: new Date(),
          },
        }
      ).session(session);

      if (result.modifiedCount === 0) {
        await session.abortTransaction();
        return NextResponse.json({ error: `Stock for SKU: ${sku} has been modified by another operation. Please retry.` }, { status: 409 });
      }

      transactionEntries.push({
        productId: product._id,
        sku: product.sku,
        barcode: product.barcode,
        employeeId: shiftId ? String(shiftId) : "unknown",
        employeeName: shiftId ? `Shift ${shiftId}` : "checkout",
        deviceId: "checkout",
        action: "checkout",
        quantity,
        notes: `Checkout processed${shiftId ? ` for shift ${shiftId}` : ""}`,
        metadata: { shiftId: shiftId || null },
      });
    }

    if (transactionEntries.length) {
      await TransactionModel.create(transactionEntries, { session });
    }

    await session.commitTransaction();
    session.endSession();

    return NextResponse.json({ success: true, message: "Checkout successful" }, { status: 200 });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}