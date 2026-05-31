import type { PastWinnerApiRow } from "@/app/api/lottery/past-winners/route";

export async function fetchPastWinnersClient(): Promise<PastWinnerApiRow[]> {
  const res = await fetch("/api/lottery/past-winners", { cache: "no-store" });
  const json = (await res.json()) as {
    draws?: PastWinnerApiRow[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(json.error ?? "Could not load past winners");
  }
  return json.draws ?? [];
}
