import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "omnisync-dev-secret";
const TOKEN_LIFETIME_SECONDS = 60 * 60; // 1 hour

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(value: string) {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

export function signJwt(payload: Record<string, any>, expiresInSeconds = TOKEN_LIFETIME_SECONDS) {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const issuedAt = Math.floor(Date.now() / 1000);
  const body = base64UrlEncode(JSON.stringify({ ...payload, iat: issuedAt, exp: issuedAt + expiresInSeconds }));
  const signature = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64");
  const token = `${header}.${body}.${base64UrlEncode(signature)}`;
  return token;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) {
    return false;
  }

  const derived = scryptSync(password, salt, 64).toString("hex");
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
  } catch {
    return false;
  }
}

export function verifyJwt(token: string) {
  try {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      return null;
    }

    const signature = createHmac("sha256", JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest("base64");

    const reconstructed = base64UrlEncode(signature);
    const valid = timingSafeEqual(Buffer.from(reconstructed), Buffer.from(encodedSignature));
    if (!valid) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (typeof payload.exp !== "number" || Math.floor(Date.now() / 1000) >= payload.exp) {
      return null;
    }

    return payload as Record<string, any>;
  } catch {
    return null;
  }
}

export function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice(7).trim();
}
