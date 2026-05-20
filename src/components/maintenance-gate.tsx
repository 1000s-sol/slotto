import { cookies, headers } from "next/headers";

import {
  MAINTENANCE_COOKIE,
  maintenanceApplies,
} from "@/lib/maintenance";

import { MaintenanceOverlay } from "./maintenance-overlay";

type Props = { children: React.ReactNode };

export async function MaintenanceGate({ children }: Props) {
  const host = (await headers()).get("host") ?? "";
  const bypass =
    (await cookies()).get(MAINTENANCE_COOKIE)?.value === "1";

  if (!maintenanceApplies(host) || bypass) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        aria-hidden
        className="pointer-events-none select-none blur-md brightness-[0.35] saturate-50"
      >
        {children}
      </div>
      <MaintenanceOverlay />
    </div>
  );
}
