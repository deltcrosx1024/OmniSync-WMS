// app/api/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ProductModel } from "../../lib/db/schemas/product";
import { InventoryModel } from "../../lib/db/schemas/inventory";
import mongoose from "mongoose";

export async function POST(request: NextRequest) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, shiftId } = await request.json();

    if (!Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      return NextResponse.json({ error: "Invalid items list" }, { status: 400 });
    }

    // We'll process each item
    for (const item of items) {
      const { sku, quantity } = item;

      if (!sku || typeof quantity !== "number" || quantity <= 0) {
        await session.abortTransaction();
        return NextResponse.json({ error: `Invalid item: ${JSON.stringify(item)}` }, { status: 400 });
      }

      // Find the product by SKU
      const product = await ProductModel.findOne({ sku }).session(session);
      if (!product) {
        await session.abortTransaction();
        return NextResponse.json({ error: `Product not found for SKU: ${sku}` }, { status: 404 });
      }

      // Find the inventory for this product
      const inventory = await InventoryModel.findOne({ productId: product._id }).session(session);
      if (!inventory) {
        await session.abortTransaction();
        return NextResponse.json({ error: `Inventory not found for product: ${product.name}` }, { status: 404 });
      }

      // Check if we have enough available quantity
      if (inventory.available_quantity < quantity) {
        await session.abortTransaction();
        return NextResponse.json({ error: `Insufficient stock for SKU: ${sku}. Available: ${inventory.available_quantity}, requested: ${quantity}` }, { status: 400 });
      }

      // Update inventory with optimistic locking
      // We use the current version in the update condition
      const result = await InventoryModel.updateOne(
        { _id: inventory._id, version: inventory.version }, // Condition: match the current version
        {
          $inc: {
            available_quantity: -quantity,
            reserved_quantity: quantity,
            version: 1, // Increment version
          },
          $set: {
            lastUpdated: new Date(),
          },
        }
      ).session(session);

      // If the update affected 0 documents, it means the version changed (someone else updated it)
      if (result.modifiedCount === 0) {
        await session.abortTransaction();
        return NextResponse.json({ error: `Stock for SKU: ${sku} has been modified by another operation. Please retry.` }, { status: 409 });
      }
    }

    // If we get here, all updates succeeded
    await session.commitTransaction();
    session.endSession();

    // Optionally, you can create a sales order or update the shift here
    // For now, we just return success
    return NextResponse.json({ success: true, message: "Checkout successful" }, { status: 200 });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}