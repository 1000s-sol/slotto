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

  return <SessionProvider>{children}</SessionProvider>;
}
