import { useEffect } from "react";

export function useServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[SW] registration failed", err);
    });
  }, []);
}
