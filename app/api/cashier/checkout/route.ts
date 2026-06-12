import { NextResponse } from "next/server";
import { connectToMongo, getMongoDb, MONGODB_INVENTORY_DB, MONGODB_POS_DB } from "../../../lib/db/connection";
import { getProductModel } from "../../../lib/db/schemas/product";
import { getInventoryModel } from "../../../lib/db/schemas/inventory";
import { getTransactionModel } from "../../../lib/db/schemas/transaction";
import { getEmployeeShiftModel } from "../../../lib/db/schemas/employeeShift";
import { getBearerToken, verifyJwt } from "../../../lib/auth";

interface CheckoutTransaction {
  productId: string;
  sku: string;
  barcode?: string;
  employeeId: string;
  employeeName: string;
  deviceId: string;
  action: "checkout" | "reservation" | "adjustment" | "manual";
  quantity: number;
  notes?: string;
  metadata?: Record<string, unknown>;
}

function authenticate(request: Request) {
  const token = getBearerToken(request);
  if (!token) throw new Error("Unauthorized");
  const payload = verifyJwt(token);
  if (!payload || typeof payload.sub !== "string") throw new Error("Unauthorized");
  return payload;
}

export async function POST(request: Request) {
  await connectToMongo();
  const inventoryDb = getMongoDb(MONGODB_INVENTORY_DB);
  const posDb = getMongoDb(MONGODB_POS_DB);

  const ProductModel = getProductModel(inventoryDb);
  const InventoryModel = getInventoryModel(inventoryDb);
  const TransactionModel = getTransactionModel(posDb);
  const EmployeeShiftModel = getEmployeeShiftModel(posDb);

  await ProductModel.createCollection().catch(() => {});
  await InventoryModel.createCollection().catch(() => {});
  await TransactionModel.createCollection().catch(() => {});
  await EmployeeShiftModel.createCollection().catch(() => {});

  const session = await inventoryDb.startSession();
  session.startTransaction();

  try {
    const payload = authenticate(request);
    const employeeId = String(payload.sub);
    const employeeName = payload.name as string;

    const { items } = await request.json();

    if (!Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      return NextResponse.json({ error: "Invalid items list" }, { status: 400 });
    }

    const shift = await EmployeeShiftModel.findOne({ employeeId, status: "active" }).session(session);
    if (!shift) {
      await session.abortTransaction();
      return NextResponse.json({ error: "No active shift. Start a shift first." }, { status: 400 });
    }

    let totalAmount = 0;
    const transactionEntries: CheckoutTransaction[] = [];

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

      if (inventory.reserved_quantity < quantity) {
        await session.abortTransaction();
        return NextResponse.json({ error: `Insufficient reserved stock for SKU: ${sku}. Reserved: ${inventory.reserved_quantity}, requested: ${quantity}` }, { status: 400 });
      }

      const result = await InventoryModel.updateOne(
        { _id: inventory._id, version: inventory.version },
        {
          $inc: {
            reserved_quantity: -quantity,
            version: 1,
          },
          $set: { lastUpdated: new Date() },
        }
      ).session(session);

      if (result.modifiedCount === 0) {
        await session.abortTransaction();
        return NextResponse.json({ error: `Stock for SKU: ${sku} has been modified by another operation. Please retry.` }, { status: 409 });
      }

      const lineTotal = product.price * quantity;
      totalAmount += lineTotal;

      transactionEntries.push({
        productId: product._id,
        sku: product.sku,
        barcode: product.barcode,
        employeeId,
        employeeName,
        deviceId: "cashier",
        action: "checkout",
        quantity,
        notes: `Sale completed`,
        metadata: { lineTotal },
      });
    }

    if (transactionEntries.length) {
      await TransactionModel.create(transactionEntries, { session });
    }

    shift.expectedCash += totalAmount;
    await shift.save({ session });

    await session.commitTransaction();
    session.endSession();

    return NextResponse.json({ success: true, totalAmount, expectedCash: shift.expectedCash }, { status: 200 });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}