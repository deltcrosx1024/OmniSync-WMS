import { Schema, model, models, Document } from "mongoose";

export interface IInventoryTransaction extends Document {
  productId: Schema.Types.ObjectId;
  sku: string;
  barcode?: string;
  employeeId: string;
  employeeName: string;
  deviceId?: string;
  action: "checkout" | "reservation" | "adjustment" | "manual";
  quantity: number;
  notes?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const InventoryTransactionSchema = new Schema<IInventoryTransaction>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    sku: { type: String, required: true, index: true },
    barcode: { type: String, index: true },
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String, required: true },
    deviceId: { type: String },
    action: {
      type: String,
      enum: ["checkout", "reservation", "adjustment", "manual"],
      required: true,
      default: "manual",
    },
    quantity: { type: Number, required: true },
    notes: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

InventoryTransactionSchema.index({ createdAt: -1 });

export const TransactionModel = models.Transaction || model<IInventoryTransaction>("Transaction", InventoryTransactionSchema);
