import { Schema, model, Document } from "mongoose";

export interface IEmployeeShift extends Document {
  employeeId: string;
  employeeName: string;
  role: "cashier" | "manager" | "supervisor" | "stock";
  pin: string;
  clockInAt: Date;
  clockOutAt?: Date;
  expectedCash: number;
  actualCash?: number;
  status: "active" | "completed";
  reconciliation?: {
    variance: number;
    note: string;
  };
}

const EmployeeShiftSchema = new Schema<IEmployeeShift>(
  {
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ["cashier", "manager", "supervisor", "stock"],
      default: "cashier",
    },
    pin: { type: String, required: true },
    clockInAt: { type: Date, required: true, default: Date.now },
    clockOutAt: { type: Date },
    expectedCash: { type: Number, required: true, default: 0 },
    actualCash: { type: Number },
    status: {
      type: String,
      required: true,
      enum: ["active", "completed"],
      default: "active",
    },
    reconciliation: {
      variance: { type: Number },
      note: { type: String },
    },
  },
  { timestamps: true }
);

EmployeeShiftSchema.index({ employeeId: 1, status: 1 });

export const EmployeeShiftModel = model<IEmployeeShift>("EmployeeShift", EmployeeShiftSchema);
