import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
export const dynamic = "force-dynamic";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import SystemStatus from "./components/SystemStatus";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OmniSync WMS",
  description: "Warehouse Management System for motorcycle repair business",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-1">
          <Sidebar className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700" />
          <main className="flex-1 flex flex-col overflow-hidden">
            <SystemStatus className="h-12 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex items-center px-4 text-sm" />
            <div className="flex-1 p-6 overflow-y-auto">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}