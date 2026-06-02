import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface InventoryImportRow {
  sku: string;
  name: string;
  barcode?: string;
  description?: string;
  category?: string;
  price: number;
  cost?: number;
  available_quantity: number;
  reserved_quantity?: number;
  location?: string;
  status?: "active" | "discontinued";
}

function normalizeHeader(header: string) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function normalizeRow(row: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeHeader(key)] = value;
  }
  return normalized;
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[,\s]/g, "");
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function getField<T = string>(row: Record<string, unknown>, candidates: string[]): T | undefined {
  for (const key of candidates) {
    const value = row[key];
    if (value === undefined || value === null) {
      continue;
    }
    const text = typeof value === "string" ? value.trim() : String(value).trim();
    if (text === "") {
      continue;
    }
    return value as T;
  }
  return undefined;
}

function mapRow(row: Record<string, unknown>) {
  const normalized = normalizeRow(row);
  const sku = String(getField(normalized, ["sku", "item_sku", "product_sku", "code"]) || "").trim();
  const name = String(getField(normalized, ["name", "product_name", "title"]) || "").trim();
  const barcode = String(getField(normalized, ["barcode", "upc", "ean"]) || "").trim() || undefined;
  const description = String(getField(normalized, ["description", "details"]) || "").trim() || undefined;
  const category = String(getField(normalized, ["category", "department", "type"]) || "").trim() || undefined;
  const price = parseNumber(getField(normalized, ["price", "sale_price", "amount"])) ?? 0;
  const cost = parseNumber(getField(normalized, ["cost", "cost_price", "purchase_price"])) ?? 0;
  const available_quantity = parseNumber(getField(normalized, ["quantity", "available_quantity", "available", "stock", "qty"])) ?? 0;
  const reserved_quantity = parseNumber(getField(normalized, ["reserved_quantity", "reserved", "reserved_qty"])) ?? 0;
  const location = String(getField(normalized, ["location", "warehouse", "bin"]) || "").trim() || undefined;
  const status = String(getField(normalized, ["status", "product_status"]) || "").trim() as "active" | "discontinued" | undefined;

  return {
    sku,
    name,
    barcode,
    description,
    category,
    price,
    cost,
    available_quantity,
    reserved_quantity,
    location,
    status: status === "discontinued" ? "discontinued" : "active",
  } as InventoryImportRow;
}

export async function parseInventoryFile(file: File): Promise<InventoryImportRow[]> {
  const fileName = String(file.name || "").toLowerCase();

  if (fileName.endsWith(".csv") || file.type.includes("csv")) {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    const rows = parsed.data.map(mapRow).filter((row) => row.sku && row.name);
    return rows;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    range: 0,
  });

  return rows.map(mapRow).filter((row) => row.sku && row.name);
}

export function normalizeImportRows(rows: InventoryImportRow[]) {
  return rows.map((row) => ({
    ...row,
    available_quantity: Number(row.available_quantity || 0),
    reserved_quantity: Number(row.reserved_quantity || 0),
    price: Number(row.price || 0),
    cost: Number(row.cost || 0),
  }));
}
