"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function isInternalNavigation(anchor: HTMLAnchorElement, event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (anchor.target === "_blank" || anchor.hasAttribute("download")) return false;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return false;
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin) return false;
  if (url.pathname === window.location.pathname && url.search === window.location.search) return false;
  return true;
}

/** Fires as soon as an in-app navigation starts, before the next page arrives. */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const route = `${pathname}?${search}`;
  const routeRef = useRef(route);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => setActive(false), 15000);
    return () => window.clearTimeout(id);
  }, [active]);

  useEffect(() => {
    if (routeRef.current === route) return;
    routeRef.current = route;
    if (!active) return;
    let cancelled = false;
    const started = performance.now();
    const tick = () => {
      if (cancelled) return;
      const busy = !!document.querySelector("[aria-busy='true']");
      if (busy || performance.now() - started < 280) {
        requestAnimationFrame(tick);
        return;
      }
      setActive(false);
    };
    const frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [route, active]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor || !isInternalNavigation(anchor, event)) return;
      setActive(true);
    };
    const onStart = () => setActive(true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("slotto:navigate", onStart);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("slotto:navigate", onStart);
    };
  }, []);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-1 overflow-hidden bg-[#0a204c]/80"
      role="progressbar"
      aria-label="Loading page"
    >
      <div className="nav-progress-bar h-full bg-gradient-to-r from-accent-gold via-white to-accent-blue" />
    </div>
  );
}
