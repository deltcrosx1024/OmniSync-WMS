"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function Sidebar({ className }: Readonly<{ className?: string }>) {
  const pathname = usePathname();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const token = window.localStorage.getItem("gridflow-token");
    const rawUser = window.localStorage.getItem("gridflow-user");
    setIsLoggedIn(Boolean(token && rawUser));

    if (!rawUser) {
      setIsSuperAdmin(false);
      return;
    }

    try {
      const parsed = JSON.parse(rawUser) as { isSuperAdmin?: boolean };
      setIsSuperAdmin(Boolean(parsed?.isSuperAdmin));
    } catch {
      setIsSuperAdmin(false);
    }
  }, []);

  if (!isLoggedIn) {
    return null;
  }

  return (
    <aside className={className}>
      <nav className="p-4 space-y-2">
        <Link
          href="/"
          className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
            pathname === "/" ? "bg-indigo-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
        >
          Dashboard
        </Link>
        <Link
          href="/inventory"
          className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
            pathname.startsWith("/inventory")
              ? "bg-indigo-600 text-white"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
        >
          Inventory
        </Link>
        <Link
          href="/cashier"
          className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
            pathname.startsWith("/cashier")
              ? "bg-indigo-600 text-white"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
        >
          Cashier
        </Link>
        <Link
          href="/employee"
          className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
            pathname.startsWith("/employee")
              ? "bg-indigo-600 text-white"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
        >
          Employee Shifts
        </Link>
        {isSuperAdmin ? (
          <Link
            href="/admin"
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
              pathname.startsWith("/admin")
                ? "bg-indigo-600 text-white"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            Admin
          </Link>
        ) : null}
      </nav>
    </aside>
  );
}
