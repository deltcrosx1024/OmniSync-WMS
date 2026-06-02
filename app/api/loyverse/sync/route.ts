import { NextResponse } from "next/server";
import { getAccessToken, syncLoyverseItems } from "../../../lib/api/loyverseSync";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const accessToken = typeof body.accessToken === "string" && body.accessToken ? body.accessToken : await getAccessToken();

  const synced = await syncLoyverseItems(accessToken);
  return NextResponse.json({ success: true, synced });
}
