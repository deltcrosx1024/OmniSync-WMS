"use client";

import { useEffect, useState } from "react";

type ConnectionStatus = "connected" | "disconnected" | "unknown";

export default function SystemStatus({ className }: Readonly<{ className?: string }>) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mongodbStatus, setMongodbStatus] = useState<ConnectionStatus>("unknown");
  const [loyverseStatus, setLoyverseStatus] = useState<ConnectionStatus>("unknown");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const token = window.localStorage.getItem("gridflow-token");
    const rawUser = window.localStorage.getItem("gridflow-user");
    const loggedIn = Boolean(token && rawUser);
    setIsLoggedIn(loggedIn);

    if (!loggedIn) return;

    let mounted = true;
    async function checkHealth() {
      try {
        const response = await fetch("/api/health");
        if (response.ok) {
          const data = await response.json();
          if (mounted) {
            setMongodbStatus(data.mongodb || "unknown");
            setLoyverseStatus(data.loyverse || "unknown");
          }
        }
      } catch {
        if (mounted) {
          setMongodbStatus("disconnected");
          setLoyverseStatus("disconnected");
        }
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
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