import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToMongo } from "../../../lib/db/connection";
import { ProductModel } from "../../../lib/db/schemas/product";
import { InventoryModel } from "../../../lib/db/schemas/inventory";
import { TransactionModel } from "../../../lib/db/schemas/transaction";
import { getBearerToken, verifyJwt } from "../../../lib/auth";

function authenticate(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }
  return verifyJwt(token);
}

export async function GET(request: Request) {
  await connectToMongo();

  const url = new URL(request.url);
  const sku = url.searchParams.get("sku")?.trim() || undefined;
  const barcode = url.searchParams.get("barcode")?.trim() || undefined;

  if (!sku && !barcode) {
    return NextResponse.json({ error: "SKU or barcode is required." }, { status: 400 });
  }

  const product = barcode ? await ProductModel.findOne({ barcode }) : await ProductModel.findOne({ sku });
  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const inventory = await InventoryModel.findOne({ productId: product._id });
  return NextResponse.json({
    product: {
      id: String(product._id),
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price,
      cost: product.cost,
      status: product.status,
    },
    inventory: inventory
      ? {
          available_quantity: inventory.available_quantity,
          reserved_quantity: inventory.reserved_quantity,
          location: inventory.location,
          version: inventory.version,
          lastUpdated: inventory.lastUpdated,
        }
      : null,
  });
}

export async function POST(request: Request) {
  await connectToMongo();

  const payload = authenticate(request);
  if (!payload || typeof payload.sub !== "string") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const transactions = Array.isArray(body.transactions) ? body.transactions : [];
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "mobile";

  if (!transactions.length) {
    return NextResponse.json({ error: "No transactions provided." }, { status: 400 });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const results = [];
    for (const item of transactions) {
      const sku = typeof item.sku === "string" ? item.sku.trim() : undefined;
      const barcode = typeof item.barcode === "string" ? item.barcode.trim() : undefined;
      const quantity = typeof item.quantity === "number" ? item.quantity : 0;
      const action = typeof item.action === "string" ? item.action : "checkout";
      const notes = typeof item.notes === "string" ? item.notes : undefined;
      const metadata = typeof item.metadata === "object" && item.metadata !== null ? item.metadata : undefined;

      if (!sku && !barcode) {
        continue;
      }
      if (quantity <= 0) {
        continue;
      }

      const product = barcode ? await ProductModel.findOne({ barcode }).session(session) : await ProductModel.findOne({ sku }).session(session);
      if (!product) {
        await session.abortTransaction();
        return NextResponse.json({ error: "Product not found." }, { status: 404 });
      }

      const inventory = await InventoryModel.findOne({ productId: product._id }).session(session);
      if (!inventory) {
        await session.abortTransaction();
        return NextResponse.json({ error: "Inventory record not found." }, { status: 404 });
      }

      if (action === "checkout" || action === "reservation") {
        if (inventory.available_quantity < quantity) {
          await session.abortTransaction();
          return NextResponse.json({ error: "Insufficient stock for transaction.", sku, requested: quantity, available: inventory.available_quantity }, { status: 409 });
        }

        const updated = await InventoryModel.findOneAndUpdate(
          { _id: inventory._id, version: inventory.version, available_quantity: { $gte: quantity } },
          {
            $inc: {
              available_quantity: -quantity,
              reserved_quantity: quantity,
            },
            $set: {
              lastUpdated: new Date(),
              version: inventory.version + 1,
            },
          },
          { new: true, session }
        );

        if (!updated) {
          await session.abortTransaction();
          return NextResponse.json({ error: "Inventory conflict, please retry." }, { status: 409 });
        }

        await TransactionModel.create(
          [
            {
              productId: product._id,
              sku: product.sku,
              barcode: product.barcode,
              employeeId: payload.sub,
              employeeName: payload.name || "Unknown",
              deviceId,
              action: action === "reservation" ? "reservation" : "checkout",
              quantity,
              notes,
              metadata,
            },
          ],
          { session }
        );

        results.push({ sku: product.sku, status: "processed", quantity, action });
      } else {
        results.push({ sku: product.sku, status: "skipped", reason: "Unsupported action" });
      }
    }

    await session.commitTransaction();
    session.endSession();
    return NextResponse.json({ success: true, results });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Mobile sync error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
