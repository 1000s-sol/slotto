import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  MAINTENANCE_COOKIE,
  isMaintenanceApiAllowlist,
  isMaintenanceExemptPath,
  maintenanceApplies,
} from "@/lib/maintenance";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  const host = request.nextUrl.hostname;
  const bypass = request.cookies.get(MAINTENANCE_COOKIE)?.value === "1";

  if (maintenanceApplies(host) && !bypass) {
    if (
      !isMaintenanceExemptPath(pathname) &&
      !isMaintenanceApiAllowlist(pathname)
    ) {
      const home = request.nextUrl.clone();
      home.pathname = "/";
      return NextResponse.redirect(home);
    }
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
