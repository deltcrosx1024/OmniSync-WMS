import mongoose, { Connection, Document, Schema, Model, model } from "mongoose";

// Product Schema (referenced by Inventory)
export interface IProduct extends Document {
  sku: string; // Stock Keeping Unit, unique
  barcode?: string; // Unique barcode for physical item scanning
  name: string;
  description?: string;
  category?: string;
  price: number; // Sale price
  cost?: number; // Cost price
  loyverseId?: string; // ID from Loyverse system
  status: "active" | "discontinued";
  lastSyncedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    sku: { type: String, required: true, unique: true, index: true },
    barcode: { type: String, unique: true, sparse: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    category: { type: String },
    price: { type: Number, required: true },
    cost: { type: Number },
    loyverseId: { type: String, unique: true, sparse: true },
    status: {
      type: String,
      required: true,
      enum: ["active", "discontinued"],
      default: "active",
    },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export function getProductModel(connection: Connection = mongoose.connection): Model<IProduct> {
  return connection.models.Product || connection.model<IProduct>("Product", ProductSchema);
}

export const ProductModel = getProductModel(mongoose.connection);