/**
 * Probe Magic Eden + Helius for a collection’s on-chain size (no secrets printed).
 * Usage: node scripts/probe-collection-supply.mjs [me_symbol]
 * Default symbol: rejected_y00ts_club_
 */
import "dotenv/config";

const ME_API = "https://api-mainnet.magiceden.dev/v2";
const SYMBOL = process.argv[2]?.trim() || "rejected_y00ts_club_";

async function j(url) {
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  const t = await r.text();
  let body;
  try {
    body = JSON.parse(t);
  } catch {
    body = { _raw: t.slice(0, 200) };
  }
  return { ok: r.ok, status: r.status, body };
}

async function helius(method, params) {
  const key = process.env.HELIUS_API_KEY;
  if (!key) throw new Error("HELIUS_API_KEY missing in env");
  const r = await fetch(`https://mainnet.helius-rpc.com/?api-key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "probe", method, params }),
  });
  const j = await r.json();
  return { ok: r.ok, status: r.status, json: j };
}

function pickListingMint(listings) {
  if (!Array.isArray(listings) || !listings.length) return null;
  const row = listings[0];
  if (typeof row.tokenMint === "string") return row.tokenMint;
  const m = row.token?.mintAddress;
  return typeof m === "string" ? m : null;
}

function pickCollectionMintFromGetAsset(result) {
  if (!result || typeof result !== "object") return null;
  const g = result.grouping;
  if (g && typeof g === "object" && !Array.isArray(g)) {
    const c = g.collection;
    if (typeof c === "string" && c.length >= 32) return c;
  }
  if (Array.isArray(g)) {
    for (const e of g) {
      const gv = e?.group_value ?? e?.groupValue ?? e?.value;
      const gk = e?.group_key ?? e?.groupKey ?? e?.key;
      if ((gk === "collection" || gk === "Collection") && typeof gv === "string" && gv.length >= 32) return gv;
    }
  }
  const coll = result.content?.metadata?.collection;
  if (coll && typeof coll === "object" && typeof coll.key === "string") return coll.key;
  return null;
}

console.log("ME symbol:", SYMBOL);
console.log("---");

const statsUrl = `${ME_API}/collections/${encodeURIComponent(SYMBOL)}/stats`;
const colUrl = `${ME_API}/collections/${encodeURIComponent(SYMBOL)}`;
const listUrl = `${ME_API}/collections/${encodeURIComponent(SYMBOL)}/listings?offset=0&limit=3`;

const [statsRes, colRes, listRes] = await Promise.all([j(statsUrl), j(colUrl), j(listUrl)]);

console.log("ME /stats", statsRes.status, statsRes.ok ? "ok" : "fail");
if (statsRes.ok && statsRes.body && typeof statsRes.body === "object") {
  const b = statsRes.body;
  console.log("  listedCount:", b.listedCount);
  console.log("  floorPrice (lamports):", b.floorPrice);
}

console.log("ME /collections/{sym}", colRes.status, colRes.ok ? "ok" : "fail");
if (colRes.ok && colRes.body && typeof colRes.body === "object") {
  const b = colRes.body;
  const keys = ["size", "totalSupply", "supply", "nftCount", "count", "collectionMint", "address"];
  for (const k of keys) {
    if (b[k] !== undefined && b[k] !== null) console.log(`  ${k}:`, b[k]);
  }
}

console.log("ME /listings?limit=3", listRes.status, listRes.ok ? "ok" : "fail");
const sampleMint = listRes.ok ? pickListingMint(listRes.body) : null;
console.log("  sample NFT mint:", sampleMint ?? "(none)");

if (!sampleMint) {
  console.log("\nNo listing mint — cannot probe Helius grouping without another mint source.");
  process.exit(0);
}

console.log("\n--- Helius getAsset(sample mint) ---");
const ga = await helius("getAsset", {
  id: sampleMint,
  displayOptions: { showCollectionMetadata: true, showUnverifiedCollections: true },
});
console.log("HTTP", ga.status, ga.json?.error ? "RPC error" : "ok");
if (ga.json?.error) console.log("  error:", ga.json.error);
const colMint = ga.json?.result ? pickCollectionMintFromGetAsset(ga.json.result) : null;
console.log("  resolved collection mint:", colMint ?? "(none)");

if (!colMint) {
  console.log("\nCould not resolve verified collection mint from getAsset.");
  process.exit(0);
}

console.log("\n--- Helius searchAssets (limit=1 + showGrandTotal) — often equals page size, not supply ---");
const sa = await helius("searchAssets", {
  grouping: ["collection", colMint],
  limit: 1,
  page: 1,
  options: { showGrandTotal: true, showUnverifiedCollections: true },
});
const res = sa.json?.result;
console.log("HTTP", sa.status, sa.json?.error ? "RPC error" : "ok");
if (sa.json?.error) console.log("  error:", sa.json.error);
console.log("  result.total:", res?.total, "(may be bogus if equal to limit)");

const probeLimit = 120;
const sa2 = await helius("searchAssets", {
  grouping: ["collection", colMint],
  limit: probeLimit,
  page: 1,
  tokenType: "all",
  options: { showUnverifiedCollections: true },
});
const res2 = sa2.json?.result;
const nBroken = Array.isArray(res2?.items) ? res2.items.length : -1;
console.log(`\n--- Helius searchAssets + tokenType=all (limit=${probeLimit}) — often broken ---`);
console.log("  items returned:", nBroken);

let sum = 0;
let page = 1;
const gLimit = 1000;
while (page <= 20) {
  const g = await helius("getAssetsByGroup", {
    groupKey: "collection",
    groupValue: colMint,
    page,
    limit: gLimit,
  });
  const items = g.json?.result?.items;
  const batch = Array.isArray(items) ? items.length : 0;
  sum += batch;
  console.log(`  getAssetsByGroup page ${page}: +${batch} (running ${sum})`);
  if (batch < gLimit) break;
  page++;
}

const listed = statsRes.ok && typeof statsRes.body?.listedCount === "number" ? statsRes.body.listedCount : null;
console.log("\n--- Cross-check ---");
console.log("  ME listedCount:", listed);
console.log("  Helius getAssetsByGroup total count:", sum);
if (listed != null && sum < listed) {
  console.log("  WARNING: chain count < ME listings (unexpected).");
}
