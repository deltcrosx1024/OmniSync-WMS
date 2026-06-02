"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

interface InventoryRow {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  category?: string;
  price: number;
  cost?: number;
  status: string;
  description?: string;
  available_quantity?: number;
  reserved_quantity?: number;
  location?: string;
}

export default function InventoryPage() {
  const [data, setData] = useState<InventoryRow[]>([]);
  const [filter, setFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [bulkLocation, setBulkLocation] = useState("");
  const [bulkPrice, setBulkPrice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/products");
      const products = await response.json();
      setData(
        products.map((product: any) => ({
          id: String(product._id ?? product.id ?? product.sku),
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          category: product.category,
          price: product.price,
          cost: product.cost,
          status: product.status,
          description: product.description,
          available_quantity: product.available_quantity ?? 0,
          reserved_quantity: product.reserved_quantity ?? 0,
          location: product.location || "",
        }))
      );
    } catch (error) {
      console.error(error);
      setMessage("Unable to load inventory data.");
    } finally {
      setIsLoading(false);
    }
  }

  const columnHelper = createColumnHelper<InventoryRow>();

  const columns = useMemo(
    () => [
      columnHelper.accessor("sku", {
        header: "SKU",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("barcode", {
        header: "Barcode",
        cell: (info) => info.getValue() || "—",
      }),
      columnHelper.accessor("name", {
        header: "Item Name",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("category", {
        header: "Category",
        cell: (info) => info.getValue() || "Uncategorized",
      }),
      columnHelper.accessor("price", {
        header: "Price",
        cell: (info) => `$${info.getValue().toFixed(2)}`,
      }),
      columnHelper.accessor("available_quantity", {
        header: "Available",
        cell: (info) => info.getValue() ?? 0,
      }),
      columnHelper.accessor("reserved_quantity", {
        header: "Reserved",
        cell: (info) => info.getValue() ?? 0,
      }),
      columnHelper.accessor("location", {
        header: "Location",
        cell: (info) => info.getValue() || "Main",
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => (
          <span className={info.getValue() === "active" ? "text-green-600" : "text-orange-600"}>
            {info.getValue()}
          </span>
        ),
      }),
    ],
    [columnHelper]
  );

  const table = useReactTable({
    data: data.filter((row) => {
      const query = filter.toLowerCase();
      return (
        row.sku.toLowerCase().includes(query) ||
        row.name.toLowerCase().includes(query) ||
        String(row.barcode ?? "").toLowerCase().includes(query) ||
        String(row.category ?? "").toLowerCase().includes(query)
      );
    }),
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  async function handleBulkUpdate() {
    const ids = Object.keys(selectedIds).filter((id) => selectedIds[id]);
    if (ids.length === 0) {
      setMessage("Select at least one product to update.");
      return;
    }

    const updates = ids.map((id) => ({
      id,
      location: bulkLocation || undefined,
      price: bulkPrice ? parseFloat(bulkPrice) : undefined,
    }));

    try {
      const response = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const result = await response.json();
      if (response.ok) {
        setMessage(`Updated ${result.updated} products.`);
        setBulkLocation("");
        setBulkPrice("");
        setSelectedIds({});
        fetchProducts();
      } else {
        setMessage(result.error || "Bulk update failed.");
      }
    } catch (error) {
      console.error(error);
      setMessage("Unable to save bulk updates.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Inventory Management</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Catalog and stock views are integrated with product and inventory state.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search SKU, name, barcode"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-200"
          />
          <button
            type="button"
            onClick={fetchProducts}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
          >
            Refresh inventory
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Bulk location</label>
            <input
              value={bulkLocation}
              onChange={(event) => setBulkLocation(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-200"
              placeholder="Update location"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Bulk price</label>
            <input
              value={bulkPrice}
              onChange={(event) => setBulkPrice(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-200"
              placeholder="Set new price"
              type="number"
              min="0"
              step="0.01"
            />
          </div>
          <button
            type="button"
            onClick={handleBulkUpdate}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Apply bulk update
          </button>
        </div>

        <div className="overflow-hidden rounded-3xl border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  <th className="px-3 py-3">Select</th>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-3 py-3">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white text-sm text-gray-700 dark:divide-gray-700 dark:bg-gray-950 dark:text-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-3 py-10 text-center">
                    Loading inventory...
                  </td>
                </tr>
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedIds[row.id])}
                        onChange={(event) => {
                          setSelectedIds((current) => ({
                            ...current,
                            [row.id]: event.target.checked,
                          }));
                        }}
                      />
                    </td>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-3 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length + 1} className="px-3 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                    No matching items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
          {message}
        </div>
      ) : null}
    </div>
  );
}
