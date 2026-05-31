import type { DrawEntrant } from "./ticket-holders";

export async function fetchDrawEntrantsClient(
  drawId: number,
): Promise<DrawEntrant[]> {
  const res = await fetch(`/api/lottery/draw-entrants?drawId=${drawId}`, {
    cache: "no-store",
  });
  const json = (await res.json()) as {
    entrants?: DrawEntrant[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(json.error ?? "Could not load draw entrants");
  }
  return json.entrants ?? [];
}
