"use client";

import { useEffect, useState } from "react";

type ConnectionStatus = "connected" | "disconnected" | "unknown";

export default function SystemStatus({ className }: Readonly<{ className?: string }>) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mongodbStatus] = useState<ConnectionStatus>("connected");
  const [loyverseStatus] = useState<ConnectionStatus>("connected");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const token = window.localStorage.getItem("gridflow-token");
    const rawUser = window.localStorage.getItem("gridflow-user");
    setIsLoggedIn(Boolean(token && rawUser));
  }, []);

  if (!isLoggedIn) {
    return null;
  }

  const getStatusColor = (status: ConnectionStatus) => {
    switch (status) {
      case "connected":
        return "bg-green-500";
      case "disconnected":
        return "bg-red-500";
      default:
        return "bg-yellow-500";
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor(mongodbStatus)}`} />
          <span>MongoDB</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor(loyverseStatus)}`} />
          <span>Loyverse API</span>
        </div>
      </div>
    </div>
  );
}