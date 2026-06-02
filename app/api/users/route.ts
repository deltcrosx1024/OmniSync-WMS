import { NextResponse } from "next/server";
import { connectToMongo, getMongoDb, MONGODB_CREDENTIALS_DB } from "../../lib/db/connection";
import { getUserModel } from "../../lib/db/schemas/user";
import { getBearerToken, verifyJwt, hashPassword } from "../../lib/auth";

async function authenticate(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }
  const payload = verifyJwt(token);
  if (!payload || typeof payload.sub !== "string") {
    return null;
  }
  return payload as Record<string, any>;
}

async function ensureDefaultSuperAdmin(UserModel: ReturnType<typeof getUserModel>) {
  const count = await UserModel.countDocuments();
  if (count === 0) {
    await UserModel.create({
      email: process.env.SUPERADMIN_EMAIL?.trim().toLowerCase() || "admin@omnisync.local",
      name: process.env.SUPERADMIN_NAME || "Super Administrator",
      role: "superadmin",
      pin: process.env.SUPERADMIN_PIN || "0000",
      passwordHash: hashPassword(process.env.SUPERADMIN_PASSWORD || "Admin@123"),
      isSuperAdmin: true,
      status: "active",
    });
  }
}

export async function GET(request: Request) {
  await connectToMongo();
  const credentialsDb = getMongoDb(MONGODB_CREDENTIALS_DB);
  const UserModel = getUserModel(credentialsDb);
  await UserModel.createCollection().catch(() => {});
  await ensureDefaultSuperAdmin(UserModel);

  const payload = await authenticate(request);
  if (!payload || !payload.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await UserModel.find({}, { passwordHash: 0 }).lean();
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  await connectToMongo();
  const credentialsDb = getMongoDb(MONGODB_CREDENTIALS_DB);
  const UserModel = getUserModel(credentialsDb);
  await UserModel.createCollection().catch(() => {});
  await ensureDefaultSuperAdmin(UserModel);

  const payload = await authenticate(request);
  if (!payload || !payload.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const role = typeof body.role === "string" ? body.role : "cashier";
  const pin = typeof body.pin === "string" ? body.pin.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !name || !role || !pin) {
    return NextResponse.json({ error: "Name, email, role, and PIN are required." }, { status: 400 });
  }

  const existing = await UserModel.findOne({ email });
  if (existing) {
    return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });
  }

  const user = await UserModel.create({
    email,
    name,
    role,
    pin,
    passwordHash: password ? hashPassword(password) : undefined,
    isSuperAdmin: role === "superadmin",
    status: "active",
  });

  return NextResponse.json({
    user: {
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
      status: user.status,
      createdAt: user.createdAt,
    },
  }, { status: 201 });
}
