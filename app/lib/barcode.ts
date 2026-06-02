import { randomInt } from "crypto";

export function generateBarcodeForSKU(sku: string) {
  const normalized = String(sku || "ITEM")
    .replace(/\W+/g, "")
    .toUpperCase()
    .slice(0, 6)
    .padEnd(6, "X");
  const randomSegment = String(randomInt(100000, 999999));
  return `GF${normalized}${randomSegment}`;
}
