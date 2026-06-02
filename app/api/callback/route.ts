import { NextResponse } from "next/server";
import { exchangeAuthorizationCode } from "../../lib/api/loyverseSync";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state");

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Loyverse authorization error: ${error}`,
        state,
      },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json(
      { success: false, error: "Missing authorization code." },
      { status: 400 }
    );
  }

  try {
    const redirectUri = process.env.LOYVERSE_REDIRECT_URI || new URL("/api/callback", url).toString();
    const tokenResponse = await exchangeAuthorizationCode(code, redirectUri);

    return NextResponse.json({ success: true, tokenResponse, state });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: message, state },
      { status: 500 }
    );
  }
}
