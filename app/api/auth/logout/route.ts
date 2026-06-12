import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("gridflow-token");
  response.cookies.delete("gridflow-user");
  return response;
}