"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect, useState, type ReactNode } from "react";

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/auth/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((json: { authSecret?: boolean }) => setEnabled(!!json.authSecret))
      .catch(() => setEnabled(false));
  }, []);

  if (!enabled) {
    return <>{children}</>;
  }

  // Avoid aggressive session refetching: the window-focus refetch races with
  // Next.js route prefetching and the aborted request logs an Auth.js
  // "NetworkError when attempting to fetch resource" to the console.
  return (
    <SessionProvider refetchOnWindowFocus={false}>{children}</SessionProvider>
  );
}
