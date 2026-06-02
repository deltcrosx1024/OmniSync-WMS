import { NextResponse } from "next/server";
import { connectToMongo } from "../../lib/db/connection";
import { EmployeeShiftModel } from "../../lib/db/schemas/employeeShift";
import { getBearerToken, verifyJwt } from "../../lib/auth";

function authenticate(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    throw new Error("Unauthorized");
  }
  const payload = verifyJwt(token);
  if (!payload || typeof payload.sub !== "string") {
    throw new Error("Unauthorized");
  }
  return payload;
}

export async function GET(request: Request) {
  await connectToMongo();
  let activeOnly = false;
  const url = new URL(request.url);
  if (url.searchParams.get("active") === "true") {
    activeOnly = true;
  }

  const payload = authenticate(request);
  const employeeId = payload.sub as string;

  if (activeOnly) {
    const activeShift = await EmployeeShiftModel.findOne({ employeeId, status: "active" }).sort({ clockInAt: -1 }).lean();
    return NextResponse.json({ activeShift });
  }

  const history = await EmployeeShiftModel.find({ employeeId })
    .sort({ clockInAt: -1 })
    .limit(50)
    .lean();

  return NextResponse.json({ history });
}

export async function POST(request: Request) {
  await connectToMongo();
  const payload = authenticate(request);
  const employeeId = payload.sub as string;
  const employeeName = payload.name as string;
  const role = (payload.role as string) || "cashier";

  const existingShift = await EmployeeShiftModel.findOne({ employeeId, status: "active" });
  if (existingShift) {
    return NextResponse.json({ error: "A shift is already active." }, { status: 409 });
  }

  const shift = await EmployeeShiftModel.create({
    employeeId,
    employeeName,
    role,
    pin: payload.pin || "",
    clockInAt: new Date(),
    expectedCash: 0,
    status: "active",
  });

  return NextResponse.json({ shift });
}

export async function PATCH(request: Request) {
  await connectToMongo();
  const payload = authenticate(request);
  const employeeId = payload.sub as string;
  const body = await request.json();
  const actualCash = typeof body.actualCash === "number" ? body.actualCash : null;

  if (actualCash === null) {
    return NextResponse.json({ error: "Actual cash amount is required." }, { status: 400 });
  }

  const shift = await EmployeeShiftModel.findOne({ employeeId, status: "active" });
  if (!shift) {
    return NextResponse.json({ error: "No active shift found." }, { status: 404 });
  }

  const variance = actualCash - shift.expectedCash;
  shift.actualCash = actualCash;
  shift.clockOutAt = new Date();
  shift.status = "completed";
  shift.reconciliation = {
    variance,
    note: variance === 0 ? "Balanced" : "Variance recorded",
  };

  await shift.save();
  return NextResponse.json({ shift });
}
