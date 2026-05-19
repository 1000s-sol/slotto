/** Convert human token amount to base units (e.g. "1.5" + 6 decimals). */
export function splUiAmountToBaseUnits(ui: string, decimals: number): bigint {
  const trimmed = ui.trim();
  if (!trimmed) throw new Error("Price is required");
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Invalid price format");
  }
  const [whole, frac = ""] = trimmed.split(".");
  const fracPadded = frac.padEnd(decimals, "0").slice(0, decimals);
  const combined = `${whole}${fracPadded}`.replace(/^0+/, "") || "0";
  return BigInt(combined);
}

export function splBaseUnitsToUi(amount: string, decimals: number): string {
  const n = BigInt(amount);
  if (decimals === 0) return n.toString();
  const s = n.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, -decimals) || "0";
  const frac = s.slice(-decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}
