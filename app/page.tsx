"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { cn } from "./lib/utils";

interface AuthProfile {
  id: string;
  name: string;
  role: string;
  email?: string;
  isSuperAdmin?: boolean;
}

export default function Dashboard() {
  const [token, setToken] = useState("");
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedToken = window.localStorage.getItem("gridflow-token");
    const savedUser = window.localStorage.getItem("gridflow-user");

    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setProfile(JSON.parse(savedUser));
      } catch {
        window.localStorage.removeItem("gridflow-user");
      }
    }
  }, []);

  const quickLinks = useMemo(
    () => [
      { label: "Inventory", href: "/inventory", color: "bg-indigo-600" },
      { label: "Cashier", href: "/cashier", color: "bg-slate-600" },
      { label: "Employee Shifts", href: "/employee", color: "bg-emerald-600" },
      ...(profile?.isSuperAdmin ? [{ label: "Admin Panel", href: "/admin", color: "bg-rose-600" }] : []),
    ],
    [profile]
  );

  async function handleLogin(event: any) {
    event.preventDefault();
    setStatus("");
    setIsLoading(true);

    if (!loginPin.trim() && (!loginEmail.trim() || !loginPassword.trim())) {
      setStatus("Enter a PIN or email/password to continue.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
          pin: loginPin.trim(),
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        setStatus(body.error || "Login failed. Please check your credentials.");
        return;
      }

      setToken(body.token);
      setProfile(body.employee);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("gridflow-token", body.token);
        window.localStorage.setItem("gridflow-user", JSON.stringify(body.employee));
        window.dispatchEvent(new Event("gridflow-auth-change"));
      }
      setStatus(`Welcome back, ${body.employee.name}.`);
      setLoginEmail("");
      setLoginPassword("");
      setLoginPin("");
    } catch (error) {
      console.error(error);
      setStatus("Unable to sign in. Try again later.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setToken("");
    setProfile(null);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem("gridflow-token");
      window.localStorage.removeItem("gridflow-user");
      window.dispatchEvent(new Event("gridflow-auth-change"));
    }
    setStatus("Signed out successfully.");
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/10">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">OmniSync WMS</p>
          <h1 className="mt-4 text-3xl font-semibold text-slate-900 dark:text-white">Sign in</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Use your email/password or staff PIN to continue.</p>
          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <div className="grid gap-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Email</span>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  placeholder="admin@example.com"
                  className="mt-2 block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Password</span>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  placeholder="••••••••"
                  className="mt-2 block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Or PIN</span>
              <input
                type="password"
                value={loginPin}
                onChange={(event) => setLoginPin(event.target.value)}
                placeholder="0000"
                className="mt-2 block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
            <button
              type="submit"
              className={cn(
                "w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition",
                isLoading ? "bg-slate-400" : "bg-indigo-600 hover:bg-indigo-700"
              )}
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
            {status ? <p className="text-sm text-rose-600 dark:text-rose-300">{status}</p> : null}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.8fr_0.9fr]">
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">OmniSync WMS</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Warehouse Portal</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Sign in to access inventory, cashier operations, employee shift tracking, and admin tools if you are a superadmin.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-950">
              <p className="font-semibold text-slate-900 dark:text-white">Signed in as</p>
              <p className="mt-2 text-lg font-medium text-slate-900 dark:text-slate-100">{profile.name}</p>
              <p className="text-slate-600 dark:text-slate-400">{profile.role}</p>
              {profile.isSuperAdmin ? (
                <span className="mt-3 inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
                  Superadmin
                </span>
              ) : null}
              <button
                type="button"
                onClick={handleLogout}
                className="mt-4 inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Sign out
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-950">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Active user</p>
              <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">{profile.name}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Role: {profile.role}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-950">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Portal access</p>
              <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
                {profile.isSuperAdmin ? "Superadmin" : "Standard user"}
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {profile.isSuperAdmin
                  ? "You can manage users, inventory imports, and system settings."
                  : "Use the links below to access your assigned tools."}
              </p>
            </div>
            {profile.isSuperAdmin ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 dark:border-rose-900/40 dark:bg-rose-950/30">
                <p className="text-sm uppercase tracking-[0.24em] text-rose-700 dark:text-rose-300">Superadmin menu</p>
                <p className="mt-3 text-2xl font-semibold text-rose-900 dark:text-rose-100">Admin tools</p>
                <p className="mt-2 text-sm text-rose-700 dark:text-rose-300">
                  You can access the admin panel for user and inventory management.
                </p>
                <Link href="/admin" className="mt-4 inline-flex items-center rounded-2xl bg-rose-600 px-4 py-3 text-sm font-medium text-white hover:bg-rose-700">
                  Open Admin Panel
                </Link>
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Quick links</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Navigate to the tool you need next.</p>
          <div className="mt-6 grid gap-3">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${item.color} rounded-3xl px-4 py-4 text-sm font-medium text-white shadow-sm transition hover:opacity-95`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
