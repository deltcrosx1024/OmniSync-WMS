"use client";

import { useEffect, useState } from "react";

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  isSuperAdmin: boolean;
  status: string;
  createdAt: string;
}

export default function AdminPage() {
  const [token, setToken] = useState<string>("");
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [message, setMessage] = useState<string>("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [newUser, setNewUser] = useState({ email: "", name: "", role: "cashier", pin: "", password: "" });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<string>("");

  useEffect(() => {
    if (globalThis.window === undefined) {
      return;
    }
    const saved = globalThis.window.localStorage.getItem("gridflow-token");
    if (saved) {
      setToken(saved);
      fetchUsers(saved);
    }
  }, []);

  async function fetchUsers(authToken?: string) {
    const bearer = authToken || token;
    if (!bearer) {
      return;
    }

    const response = await fetch("/api/users", {
      headers: {
        Authorization: `Bearer ${bearer}`,
      },
    });

    if (!response.ok) {
      setMessage("Unable to fetch users. Please sign in as superadmin.");
      return;
    }

    const data = await response.json();
    setUsers(data.users || []);
  }

  async function handleLogin(event: any) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword, pin: loginPin }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setMessage(body?.error || "Login failed");
      return;
    }

    const body = await response.json();
    const authToken = body.token;
    setToken(authToken);
    if (globalThis.window !== undefined) {
      globalThis.window.localStorage.setItem("gridflow-token", authToken);
      if (body.employee) {
        globalThis.window.localStorage.setItem("gridflow-user", JSON.stringify(body.employee));
      }
    }

    if (body.employee?.isSuperAdmin) {
      fetchUsers(authToken);
      setMessage("Superadmin signed in.");
    } else {
      setMessage("Signed in, but only superadmin may manage users.");
    }
  }

  async function handleCreateUser(event: any) {
    event.preventDefault();
    if (!token) {
      setMessage("Please sign in to create users.");
      return;
    }

    const response = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newUser),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setMessage(body?.error || "Failed to create user.");
      return;
    }

    setMessage("New user created successfully.");
    setNewUser({ email: "", name: "", role: "cashier", pin: "", password: "" });
    fetchUsers();
  }

  async function handleSyncLoyverse() {
    setMessage("Syncing Loyverse inventory...");
    const response = await fetch("/api/loyverse/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setMessage(body?.error || "Loyverse sync failed.");
      return;
    }

    const body = await response.json();
    setMessage(`Loyverse inventory imported: ${body.synced}`);
  }

  async function handleImportFile(event: any) {
    event.preventDefault();
    if (!importFile) {
      setImportResult("Please select a file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", importFile);

    const response = await fetch("/api/import/inventory", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setImportResult(body?.error || "Import failed.");
      return;
    }

    const body = await response.json();
    setImportResult(`Imported ${body.imported || 0} rows successfully.`);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6">
          <h1 className="text-2xl font-semibold mb-4">Superadmin Control Panel</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
            Use this page to sign in, manage employee accounts, sync Loyverse inventory, and import CSV/XLSX products.
          </p>

          <form onSubmit={handleLogin} className="space-y-4 mb-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">Email</span>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 bg-white text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="admin@example.com"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Password</span>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 bg-white text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="••••••••"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium">Or PIN</span>
              <input
                type="text"
                value={loginPin}
                onChange={(event) => setLoginPin(event.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 bg-white text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="0000"
              />
            </label>
            <button type="submit" className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Sign in as Superadmin
            </button>
          </form>

          {message ? <div className="rounded-md bg-indigo-50 p-4 text-sm text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">{message}</div> : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={handleSyncLoyverse} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              Sync Loyverse Inventory
            </button>
            <button type="button" onClick={() => fetchUsers()} className="rounded-md bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
              Refresh User List
            </button>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold mb-4">Inventory Import</h2>
          <form onSubmit={handleImportFile} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Upload CSV / XLSX</span>
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={(event) => setImportFile(event.target.files?.[0] || null)}
                className="mt-1 block w-full text-sm text-gray-900 dark:text-gray-100"
              />
            </label>
            <button type="submit" className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Import Inventory
            </button>
          </form>
          {importResult ? <p className="mt-4 rounded-md bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-200">{importResult}</p> : null}
        </section>
      </div>

      <section className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold mb-4">Superadmin user management</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Name</th>
                <th className="px-4 py-2 text-left font-semibold">Email</th>
                <th className="px-4 py-2 text-left font-semibold">Role</th>
                <th className="px-4 py-2 text-left font-semibold">Status</th>
                <th className="px-4 py-2 text-left font-semibold">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {users.length ? (
                users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3">{user.name}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">{user.role}</td>
                    <td className="px-4 py-3">{user.status}</td>
                    <td className="px-4 py-3">{new Date(user.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-sm text-gray-500">
                    No users available. Sign in as a superadmin and refresh.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={handleCreateUser} className="mt-6 grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Name</span>
            <input
              value={newUser.name}
              onChange={(event) => setNewUser({ ...newUser, name: event.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 bg-white text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Employee name"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              value={newUser.email}
              onChange={(event) => setNewUser({ ...newUser, email: event.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 bg-white text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="email@example.com"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Role</span>
            <select
              value={newUser.role}
              onChange={(event) => setNewUser({ ...newUser, role: event.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 bg-white text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="cashier">Cashier</option>
              <option value="stock">Stock</option>
              <option value="supervisor">Supervisor</option>
              <option value="manager">Manager</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">PIN</span>
            <input
              value={newUser.pin}
              onChange={(event) => setNewUser({ ...newUser, pin: event.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 bg-white text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="1234"
            />
          </label>
          <label className="block lg:col-span-2">
            <span className="text-sm font-medium">Password (optional)</span>
            <input
              type="password"
              value={newUser.password}
              onChange={(event) => setNewUser({ ...newUser, password: event.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 bg-white text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Leave blank for PIN-only login"
            />
          </label>
          <button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 lg:col-span-2">
            Create New User
          </button>
        </form>
      </section>
    </div>
  );
}
