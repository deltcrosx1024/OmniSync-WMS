import mongoose, { Schema, Document, Connection, Model } from "mongoose";

export interface IOrganization extends Document {
  pin: string; // Unique organization PIN
  name: string;
  description?: string;
  email?: string;
  phone?: string;
  address?: string;
  status: "active" | "inactive";
  createdBy: string; // User ID of superadmin who created this
  organizationGroupPin?: string; // Optional: PIN of organization group this belongs to
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    pin: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    createdBy: {
      type: String,
      required: true,
      index: true,
    },
    organizationGroupPin: {
      type: String,
      trim: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Index for organization group queries
OrganizationSchema.index({ organizationGroupPin: 1, status: 1 });

export function getOrganizationModel(connection: Connection = mongoose.connection): Model<IOrganization> {
  return connection.models.Organization || connection.model<IOrganization>("Organization", OrganizationSchema);
}

export const OrganizationModel = getOrganizationModel(mongoose.connection);
