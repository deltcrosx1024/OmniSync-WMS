import { NextResponse } from "next/server";
import { connectToMongo, getMongoDb, MONGODB_CREDENTIALS_DB } from "../../../lib/db/connection";
import { getUserModel } from "../../../lib/db/schemas/user";
import { signJwt, hashPassword, verifyPassword } from "../../../lib/auth";

const envSuperAdmin = {
  email: process.env.SUPERADMIN_EMAIL?.trim().toLowerCase() || "admin@omnisync.local",
  password: process.env.SUPERADMIN_PASSWORD || "Admin@123",
  pin: process.env.SUPERADMIN_PIN || "0000",
  name: process.env.SUPERADMIN_NAME || "Super Administrator",
  organizationPin: process.env.SUPERADMIN_ORG_PIN || "0000",
};

async function ensureDefaultSuperAdmin(UserModel: ReturnType<typeof getUserModel>) {
  const count = await UserModel.countDocuments();
  if (count === 0) {
    await UserModel.create({
      email: envSuperAdmin.email,
      name: envSuperAdmin.name,
      role: "superadmin",
      pin: envSuperAdmin.pin,
      organizationPin: envSuperAdmin.organizationPin,
      passwordHash: hashPassword(envSuperAdmin.password),
      isSuperAdmin: true,
      status: "active",
    });
  }
}

function matchEnvSuperAdmin({ email, password, pin }: { email?: string; password?: string; pin?: string }) {
  if (email && password) {
    if (email === envSuperAdmin.email && password === envSuperAdmin.password) {
      return envSuperAdmin;
    }
  }

  if (pin) {
    if (pin === envSuperAdmin.pin) {
      return envSuperAdmin;
    }
  }

  return null;
}

export async function POST(request: Request) {
  await connectToMongo();
  const credentialsDb = getMongoDb(MONGODB_CREDENTIALS_DB);
  const UserModel = getUserModel(credentialsDb);
  await UserModel.createCollection().catch(() => {});
  await ensureDefaultSuperAdmin(UserModel);

  const body = await request.json();
  const pin = typeof body.pin === "string" ? body.pin.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!pin && !(email && password)) {
    return NextResponse.json({ error: "PIN or email/password is required." }, { status: 400 });
  }

  let user = null;
  if (email && password) {
    const dbUser = await UserModel.findOne({ email, status: "active" });
    if (dbUser) {
      if (!dbUser.passwordHash || !verifyPassword(password, dbUser.passwordHash)) {
        return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
      }
      user = dbUser;
    } else {
      const fallback = matchEnvSuperAdmin({ email, password });
      if (!fallback) {
        return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
      }
      user = {
        _id: "env-superadmin",
        name: fallback.name,
        role: "superadmin",
        email: fallback.email,
        organizationPin: fallback.organizationPin,
        isSuperAdmin: true,
      } as any;
    }
  } else {
    const dbUser = await UserModel.findOne({ pin, status: "active" });
    if (dbUser) {
      user = dbUser;
    } else {
      const fallback = matchEnvSuperAdmin({ pin });
      if (!fallback) {
        return NextResponse.json({ error: "Invalid staff PIN." }, { status: 401 });
      }
      user = {
        _id: "env-superadmin",
        name: fallback.name,
        role: "superadmin",
        email: fallback.email,
        isSuperAdmin: true,
      } as any;
    }
  }

  const token = signJwt({
    sub: String(user._id),
    name: user.name,
    role: user.role,
    isSuperAdmin: Boolean(user.isSuperAdmin),
  });

  return NextResponse.json({
    token,
    employee: {
      id: String(user._id),
      name: user.name,
      role: user.role,
      email: user.email,
      isSuperAdmin: Boolean(user.isSuperAdmin),
    },
  });
}
