import { NextResponse } from "next/server";
import { connectToMongo } from "../../lib/db/connection";
import { ProductModel } from "../../lib/db/schemas/product";
import { InventoryModel } from "../../lib/db/schemas/inventory";
import { generateBarcodeForSKU } from "../../lib/barcode";

export async function GET() {
  await connectToMongo();

  const products = await ProductModel.aggregate([
    {
      $lookup: {
        from: "inventories",
        localField: "_id",
        foreignField: "productId",
        as: "inventory",
      },
    },
    {
      $unwind: {
        path: "$inventory",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        sku: 1,
        barcode: 1,
        name: 1,
        description: 1,
        category: 1,
        price: 1,
        cost: 1,
        status: 1,
        loyverseId: 1,
        lastSyncedAt: 1,
        available_quantity: "$inventory.available_quantity",
        reserved_quantity: "$inventory.reserved_quantity",
        location: "$inventory.location",
        version: "$inventory.version",
      },
    },
    {
      $sort: {
        name: 1,
        sku: 1,
      },
    },
  ]).exec();

  return NextResponse.json(products);
}

export async function POST(request: Request) {
  await connectToMongo();
  const body = await request.json().catch(() => ({}));

  const sku = typeof body.sku === "string" ? body.sku.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const price = typeof body.price === "number" ? body.price : 0;
  const cost = typeof body.cost === "number" ? body.cost : 0;
  const barcode = typeof body.barcode === "string" ? body.barcode.trim() : undefined;
  const description = typeof body.description === "string" ? body.description.trim() : undefined;
  const category = typeof body.category === "string" ? body.category.trim() : undefined;
  const availableQuantity = typeof body.available_quantity === "number" ? body.available_quantity : 0;
  const reservedQuantity = typeof body.reserved_quantity === "number" ? body.reserved_quantity : 0;
  const location = typeof body.location === "string" ? body.location.trim() : "main";

  if (!sku || !name) {
    return NextResponse.json({ error: "SKU and name are required." }, { status: 400 });
  }

  const existing = await ProductModel.findOne({ sku });
  if (existing) {
    return NextResponse.json({ error: "Product already exists." }, { status: 409 });
  }

  const product = await ProductModel.create({
    sku,
    barcode: barcode || generateBarcodeForSKU(sku),
    name,
    description,
    category,
    price,
    cost,
    status: "active",
    lastSyncedAt: new Date(),
  });

  await InventoryModel.create({
    productId: product._id,
    available_quantity: availableQuantity,
    reserved_quantity: reservedQuantity,
    location,
    version: 0,
    lastUpdated: new Date(),
  });

  return NextResponse.json({ success: true, product }, { status: 201 });
}

export async function PATCH(request: Request) {
  await connectToMongo();
  const body = await request.json();

  if (!Array.isArray(body.updates)) {
    return NextResponse.json({ error: "Missing updates array" }, { status: 400 });
  }

  const results = [];

  for (const update of body.updates) {
    if (!update.id) {
      continue;
    }

    const product = await ProductModel.findById(update.id);
    if (!product) {
      continue;
    }

    if (typeof update.sku === "string") {
      product.sku = update.sku;
    }
    if (typeof update.name === "string") {
      product.name = update.name;
    }
    if (typeof update.description === "string") {
      product.description = update.description;
    }
    if (typeof update.category === "string") {
      product.category = update.category;
    }
    if (typeof update.price === "number") {
      product.price = update.price;
    }
    if (typeof update.cost === "number") {
      product.cost = update.cost;
    }
    if (!product.barcode) {
      product.barcode = generateBarcodeForSKU(product.sku);
    }

    await product.save();

    const inventoryUpdates: Record<string, unknown> = { lastUpdated: new Date() };
    if (typeof update.available_quantity === "number") {
      inventoryUpdates.available_quantity = update.available_quantity;
    }
    if (typeof update.reserved_quantity === "number") {
      inventoryUpdates.reserved_quantity = update.reserved_quantity;
    }
    if (typeof update.location === "string") {
      inventoryUpdates.location = update.location;
    }

    if (Object.keys(inventoryUpdates).length > 1) {
      await InventoryModel.findOneAndUpdate(
        { productId: product._id },
        {
          $set: inventoryUpdates,
          $setOnInsert: {
            version: 0,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    results.push({ id: product._id, sku: product.sku });
  }

  return NextResponse.json({ updated: results.length, rows: results });
}
