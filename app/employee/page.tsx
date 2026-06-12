"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";

interface AuthProfile {
  id: string;
  name: string;
  role: string;
}

interface ShiftRecord {
  _id: string;
  employeeId: string;
  employeeName: string;
  role: string;
  clockInAt: string;
  clockOutAt?: string;
  expectedCash: number;
  actualCash?: number;
  status: string;
  reconciliation?: {
    variance: number;
    note: string;
  };
}

export default function EmployeePage() {
  const [pin, setPin] = useState("");
  const [user, setUser] = useState<AuthProfile | null>(null);
  const [token, setToken] = useState("");
  const [activeShift, setActiveShift] = useState<ShiftRecord | null>(null);
  const [history, setHistory] = useState<ShiftRecord[]>([]);
  const [actualCash, setActualCash] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
    if (token) {
      fetchShiftDetails();
    }
  }, [token]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pin.trim()) {
      setStatus("Enter your PIN to continue.");
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
        setStatus(payload.error || "Authentication failed.");
        return;
      }

      localStorage.setItem("gridflow-token", payload.token);
      localStorage.setItem("gridflow-user", JSON.stringify(payload.employee));
      setToken(payload.token);
      setUser(payload.employee);
      setPin("");
      setStatus("Logged in successfully.");
    } catch (err) {
      console.error(err);
      setStatus("Unable to authenticate.");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchShiftDetails() {
    if (!token) {
      return;
    }

    try {
      const [activeRes, historyRes] = await Promise.all([
        fetch("/api/shifts?active=true", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/shifts", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (activeRes.ok) {
        const activeJson = await activeRes.json();
        setActiveShift(activeJson.activeShift || null);
      }
      if (historyRes.ok) {
        const historyJson = await historyRes.json();
        setHistory(historyJson.history || []);
      }
    } catch (err) {
      console.error(err);
      setStatus("Unable to load shift details.");
    }
  }

  async function handleStartShift() {
    if (!token) {
      setStatus("Login required.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch("/api/shifts", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) {
        setStatus(result.error || "Unable to start shift.");
        return;
      }
      setActiveShift(result.shift);
      setHistory((prev) => [result.shift, ...prev]);
      setStatus("Shift started.");
    } catch (err) {
      console.error(err);
      setStatus("Failed to start shift.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleEndShift() {
    if (!token || !activeShift) {
      setStatus("No active shift to end.");
      return;
    }

    const value = parseFloat(actualCash);
    if (Number.isNaN(value)) {
      setStatus("Enter a valid cash amount.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/shifts", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ actualCash: value }),
      });
      const result = await response.json();
      if (!response.ok) {
        setStatus(result.error || "Unable to complete shift.");
        return;
      }
      setActiveShift(null);
      setHistory((prev) => [result.shift, ...prev.filter((item) => item._id !== result.shift._id)]);
      setActualCash("");
      setStatus("Shift ended and reconciliation recorded.");
    } catch (err) {
      console.error(err);
      setStatus("Failed to end shift.");
    } finally {
      setIsLoading(false);
    }
  }

  const balanceStatus = useMemo(() => {
    if (!activeShift) {
      return "No active shift.";
    }
    return `Expected cash: $${activeShift.expectedCash.toFixed(2)}`;
  }, [activeShift]);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    localStorage.removeItem("gridflow-token");
    localStorage.removeItem("gridflow-user");
    setToken("");
    setUser(null);
    setActiveShift(null);
    setHistory([]);
  }

  return (
    <div className="space-y-6">
      {!user ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold">Employee Sign-In</h2>
            <p className="mt-2 text-sm text-gray-600">Use your staff PIN so we can track punches and reconcile cashier totals.</p>
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <input
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                type="password"
                placeholder="Staff PIN"
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-white hover:bg-indigo-700"
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </button>
            </form>
            {status ? <p className="mt-4 text-sm text-red-600">{status}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Employee Shift Tracker</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">Clock in, record actual cash, and reconcile every shift.</p>
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
      </div>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-950">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Current shift</h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Track start, end, and cash reconciliation for the active shift.</p>
            </div>
            {!activeShift ? (
              <button
                type="button"
                onClick={handleStartShift}
                className="rounded-2xl bg-indigo-600 px-4 py-3 text-white hover:bg-indigo-700"
              >
                Start shift
              </button>
            ) : null}
          </div>

          {activeShift ? (
            <div className="mt-6 space-y-4 rounded-3xl bg-slate-50 p-5 dark:bg-slate-900">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Clocked in at</p>
                  <p className="mt-1 text-lg font-semibold">{new Date(activeShift.clockInAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Expected cash</p>
                  <p className="mt-1 text-lg font-semibold">${activeShift.expectedCash.toFixed(2)}</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Actual cash at shift end</label>
                <input
                  value={actualCash}
                  onChange={(event) => setActualCash(event.target.value)}
                  type="number"
                  placeholder="0.00"
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-lg focus:border-indigo-500 focus:outline-none dark:bg-gray-900 dark:border-gray-700"
                />
                <button
                  type="button"
                  onClick={handleEndShift}
                  className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-white hover:bg-emerald-700"
                >
                  Complete shift
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400">
              There is no active shift right now. Start your shift to begin logging cashier operations.
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-950">
          <h2 className="text-xl font-semibold">Recent reconciliation</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Review the latest completed shifts and variance reports.</p>

          <div className="mt-5 space-y-4">
            {history.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-5 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                No shift history available yet.
              </div>
            ) : (
              history.slice(0, 4).map((shift) => (
                <div key={shift._id} className="rounded-3xl border border-gray-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{shift.employeeName} · {shift.role}</p>
                      <p className="mt-1 text-lg font-semibold">{new Date(shift.clockInAt).toLocaleString()}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${shift.status === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-yellow-100 text-yellow-800"}`}>
                      {shift.status}
                    </span>
                  </div>
                  {shift.clockOutAt ? <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Closed at {new Date(shift.clockOutAt).toLocaleString()}</p> : null}
                  {shift.reconciliation ? (
                    <div className="mt-3 rounded-2xl bg-white p-3 text-sm text-slate-700 dark:bg-gray-900 dark:text-slate-200">
                      <p>Actual cash: ${shift.actualCash?.toFixed(2)}</p>
                      <p>Variance: ${shift.reconciliation.variance.toFixed(2)}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{shift.reconciliation.note}</p>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {status ? (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
          {status}
        </div>
      ) : null}
    </div>
  );
}
