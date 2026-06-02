import mongoose, { Schema, models, model, Document, Connection, Model } from "mongoose";

export interface IUser extends Document {
  email: string;
  name: string;
  role: "superadmin" | "manager" | "supervisor" | "cashier" | "stock";
  pin: string;
  passwordHash?: string;
  isSuperAdmin: boolean;
  status: "active" | "disabled";
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["superadmin", "manager", "supervisor", "cashier", "stock"],
      required: true,
      default: "cashier",
    },
    pin: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: false,
    },
    isSuperAdmin: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

export function getUserModel(connection: Connection = mongoose.connection): Model<IUser> {
  return connection.models.User || connection.model<IUser>("User", UserSchema);
}

export const UserModel = getUserModel(mongoose.connection);
