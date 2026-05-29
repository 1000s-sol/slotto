import type { TickerPriceItem } from "@/lib/token-usd-prices";

/** Same feed as the site price ticker (Dex + Jupiter, 30s cache). */
export async function fetchTickerPricesClient(): Promise<TickerPriceItem[]> {
  const res = await fetch("/api/ticker-prices", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Could not load market prices.");
  }
  const json = (await res.json()) as { items?: TickerPriceItem[] };
  if (!Array.isArray(json.items)) {
    throw new Error("Invalid price feed response.");
  }
  return json.items;
}
