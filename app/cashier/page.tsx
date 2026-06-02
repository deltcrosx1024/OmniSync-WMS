"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useOfflineSync } from "../lib/hooks/useOfflineSync";

interface AuthProfile {
  id: string;
  name: string;
  role: string;
}

interface CartItem {
  barcode: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

export default function CashierPage() {
  const [pin, setPin] = useState("");
  const [user, setUser] = useState<AuthProfile | null>(null);
  const [token, setToken] = useState("");
  const [barcode, setBarcode] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { saveTransactionOffline, syncOfflineTransactions, isSyncing, error } = useOfflineSync();

  useEffect(() => {
    const savedToken = localStorage.getItem("gridflow-token");
    const savedUser = localStorage.getItem("gridflow-user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("gridflow-user");
      }
    }
  }, []);

  useEffect(() => {
    if (user && navigator.onLine) {
      syncOfflineTransactions().catch(console.error);
    }
  }, [user, syncOfflineTransactions]);

  const expectedCash = useMemo(
    () => cart.reduce((sum, item) => sum + item.total, 0),
    [cart]
  );

  function setSession(tokenValue: string, profile: AuthProfile) {
    setToken(tokenValue);
    setUser(profile);
    localStorage.setItem("gridflow-token", tokenValue);
    localStorage.setItem("gridflow-user", JSON.stringify(profile));
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pin.trim()) {
      setStatus("Enter your staff PIN.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatus(payload.error || "Login failed.");
        return;
      }
      setSession(payload.token, payload.employee);
      setPin("");
      setStatus(`Welcome, ${payload.employee.name}.`);
    } catch (err) {
      console.error(err);
      setStatus("Login request failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleScan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!barcode.trim()) {
      setStatus("Scan or enter a barcode to reserve stock.");
      return;
    }

    const scanPayload = { barcode: barcode.trim(), quantity: 1 };
    setBarcode("");
    setStatus("Processing scan...");

    if (!navigator.onLine) {
      await saveOfflineTransaction(scanPayload);
      return;
    }

    try {
      const response = await fetch("/api/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scanPayload),
      });

      const result = await response.json();
      if (!response.ok) {
        setStatus(result.error || "Failed to reserve item.");
        if (response.status === 409) {
          return;
        }
        await saveOfflineTransaction(scanPayload);
        return;
      }

      const existingItem = cart.find((item) => item.barcode === result.product.barcode);
      const newLine: CartItem = {
        barcode: result.product.barcode,
        sku: result.product.sku,
        name: result.product.name,
        price: result.product.price,
        quantity: 1,
        total: result.product.price,
      };

      setCart((current) => {
        if (!existingItem) {
          return [newLine, ...current];
        }

        return current.map((item) =>
          item.barcode === existingItem.barcode
            ? {
                ...item,
                quantity: item.quantity + 1,
                total: Number(((item.quantity + 1) * item.price).toFixed(2)),
              }
            : item
        );
      });
      setStatus(`Reserved ${result.product.name}.`);
    } catch (err) {
      console.error(err);
      setStatus("Offline mode: saving transaction locally.");
      await saveOfflineTransaction(scanPayload);
    }
  }

  async function saveOfflineTransaction(scanPayload: { barcode: string; quantity: number }) {
    try {
      await saveTransactionOffline({
        type: "sale",
        barcode: scanPayload.barcode,
        quantity: scanPayload.quantity,
        timestamp: new Date().toISOString(),
        createdBy: user?.name ?? "Anonymous",
      });
      setCart((current) => [
        {
          barcode: scanPayload.barcode,
          sku: "UNKNOWN",
          name: "Offline Item",
          price: 0,
          quantity: scanPayload.quantity,
          total: 0,
        },
        ...current,
      ]);
      setStatus("Transaction saved offline and will sync when online.");
    } catch (err) {
      setStatus("Failed to save transaction offline.");
    }
  }

  function handleLogout() {
    setUser(null);
    setToken("");
    localStorage.removeItem("gridflow-token");
    localStorage.removeItem("gridflow-user");
  }

  return (
    <div className="space-y-6">
      {!user ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold">Staff Login</h2>
            <p className="mt-2 text-sm text-gray-600">Enter your PIN to access the cashier dashboard.</p>
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <input
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                placeholder="Enter staff PIN"
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg focus:border-indigo-500 focus:outline-none"
                type="password"
              />
              <button
                type="submit"
                className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-white hover:bg-indigo-700"
              >
                {isLoading ? "Authenticating..." : "Unlock POS"}
              </button>
            </form>
            {status ? <p className="mt-4 text-sm text-red-600">{status}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Cashier Dashboard</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Scan barcodes to reserve stock, track the current cart, and keep expected cash balanced.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-2xl bg-emerald-100 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
              {user?.name} · {user?.role}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-2xl border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              Logout
            </button>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-950">
            <form onSubmit={handleScan} className="space-y-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Scan barcode</label>
              <input
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                placeholder="Scan or enter a barcode"
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-lg focus:border-indigo-500 focus:outline-none"
              />
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="rounded-2xl bg-indigo-600 px-4 py-3 text-white hover:bg-indigo-700"
                >
                  Reserve item
                </button>
                <button
                  type="button"
                  onClick={() => setBarcode("")}
                  className="rounded-2xl border border-gray-300 px-4 py-3 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
                >
                  Clear
                </button>
              </div>
            </form>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900">
                <p className="text-sm text-gray-500">Expected cash</p>
                <p className="mt-2 text-3xl font-semibold">${expectedCash.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900">
                <p className="text-sm text-gray-500">Sync status</p>
                <p className="mt-2 text-xl font-semibold">{navigator.onLine ? "Online" : "Offline"}</p>
                {isSyncing ? <p className="text-sm text-gray-500">Syncing receipts...</p> : null}
              </div>
            </div>
            {status ? (
              <div className="mt-4 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                {status}
              </div>
            ) : null}
            {error ? (
              <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-200">
                {String(error)}
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-950">
            <h2 className="text-lg font-semibold">Offline receipts</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Transactions recorded locally while offline will sync automatically when a connection returns.
            </p>
            <button
              type="button"
              onClick={() => syncOfflineTransactions().catch(console.error)}
              className="mt-4 rounded-2xl bg-emerald-600 px-4 py-3 text-white hover:bg-emerald-700"
            >
              Sync now
            </button>
          </div>
        </section>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Active cart</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Reserved items queued for checkout.</p>
          </div>
          <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            Items: {cart.length}
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-gray-700 dark:text-gray-200">
            <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <tr>
                <th className="px-3 py-3">Barcode</th>
                <th className="px-3 py-3">SKU</th>
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Qty</th>
                <th className="px-3 py-3">Price</th>
                <th className="px-3 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item) => (
                <tr key={`${item.barcode}-${item.quantity}`} className="border-b border-gray-200 dark:border-gray-700">
                  <td className="px-3 py-3">{item.barcode}</td>
                  <td className="px-3 py-3">{item.sku}</td>
                  <td className="px-3 py-3">{item.name}</td>
                  <td className="px-3 py-3">{item.quantity}</td>
                  <td className="px-3 py-3">${item.price.toFixed(2)}</td>
                  <td className="px-3 py-3">${item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Expected cash from scanned items</p>
            <p className="text-3xl font-semibold">${expectedCash.toFixed(2)}</p>
          </div>
          <button
            type="button"
            onClick={() => setCart([])}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-white hover:bg-slate-800"
          >
            Clear cart
          </button>
        </div>
      </div>
    </div>
  );
}
