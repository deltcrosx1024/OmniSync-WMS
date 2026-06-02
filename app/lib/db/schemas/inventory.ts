import mongoose, { Connection, Document, Schema, Model, model } from "mongoose";

// Inventory Schema
export interface IInventory extends Document {
  productId: Schema.Types.ObjectId; // Reference to Product
  available_quantity: number; // Available for sale
  reserved_quantity: number; // Reserved for active repair jobs
  location?: string; // Warehouse location/bin
  version: number; // For optimistic locking
  lastUpdated: Date;
}

const InventorySchema = new Schema<IInventory>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    available_quantity: { type: Number, required: true, default: 0 },
    reserved_quantity: { type: Number, required: true, default: 0 },
    location: { type: String },
    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

// Index for quick lookups by productId
InventorySchema.index({ productId: 1 });

export function getInventoryModel(connection: Connection = mongoose.connection): Model<IInventory> {
  return connection.models.Inventory || connection.model<IInventory>("Inventory", InventorySchema);
}

export const InventoryModel = getInventoryModel(mongoose.connection);