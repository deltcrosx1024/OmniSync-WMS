// app/lib/hooks/useOfflineSync.ts
import { useEffect, useState, useCallback } from "react";

// IndexedDB helper functions
const DB_NAME = "OmniSyncOffline";
const STORE_NAME = "transactions";
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
  });
}

function addTransaction(transaction: any): Promise<void> {
  return openDatabase().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.add({
        ...transaction,
        timestamp: new Date().toISOString(),
      });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
      tx.oncomplete = () => db.close();
    });
  });
}

function getAllTransactions(): Promise<any[]> {
  return openDatabase().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result);
        db.close();
      };
    });
  });
}

function clearTransactions(): Promise<void> {
  return openDatabase().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve();
        db.close();
      };
    });
  });
}

/**
 * Custom hook for offline transaction storage and sync.
 * @returns {Object} with saveTransactionOffline, syncOfflineTransactions, isSyncing, error
 */
export function useOfflineSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // Save a transaction to IndexedDB for later sync when online
  const saveTransactionOffline = useCallback(async (transaction: any) => {
    try {
      await addTransaction(transaction);
      console.log("Transaction saved for offline sync");
    } catch (err) {
      console.error("Failed to save transaction offline:", err);
      setError(err);
      throw err;
    }
  }, []);

  // Sync all stored transactions to the cloud
  const syncOfflineTransactions = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const transactions = await getAllTransactions();
      if (transactions.length === 0) {
        setIsSyncing(false);
        return;
      }

      // In a real app, you would send these transactions to your API endpoint
      // For example, we might have a batch checkout endpoint: /api/batch-checkout
      // We'll simulate by logging and then clearing the store.
      // Replace this with an actual fetch to your API.
      console.log(`Syncing ${transactions.length} transactions to the cloud...`);
      // await fetch('/api/batch-checkout', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ transactions }),
      // });

      // For now, we'll just clear the store after a simulated delay
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate network delay

      // Clear the transactions after successful sync
      await clearTransactions();
      console.log("Offline transactions synced and cleared");
    } catch (err) {
      console.error("Failed to sync offline transactions:", err);
      setError(err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Automatically sync when online
  useEffect(() => {
    const handleOnline = () => {
      // Trigger sync when online
      syncOfflineTransactions().catch(console.error);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      // Also sync on mount if we are online
      if (navigator.onLine) {
        syncOfflineTransactions().catch(console.error);
      }
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
      }
    };
  }, [syncOfflineTransactions]);

  return {
    saveTransactionOffline,
    syncOfflineTransactions,
    isSyncing,
    error,
  };
}