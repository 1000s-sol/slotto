import { buildProfileWalletVerifyMessage } from "@/lib/wallet-verify-message";

export type LinkProfileWalletResult =
  | { ok: true; merged?: boolean }
  | { ok: false; reason: string };

/**
 * Sign + POST /api/profile/wallet/verify so Discord/X usernames attach to this
 * wallet for ticket tables. Session social alone is not enough.
 */
export async function linkProfileWalletClient(
  wallet: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
): Promise<LinkProfileWalletResult> {
  const message = buildProfileWalletVerifyMessage(wallet);
  let sig: Uint8Array;
  try {
    sig = await signMessage(new TextEncoder().encode(message));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Signature rejected";
    if (/reject|cancel|denied|user/i.test(msg)) {
      return { ok: false, reason: "Signature cancelled — try Link wallet again." };
    }
    return { ok: false, reason: msg };
  }

  const bs58 = (await import("bs58")).default;
  let res: Response;
  try {
    res = await fetch("/api/profile/wallet/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: wallet,
        message,
        signature: bs58.encode(sig),
      }),
    });
  } catch {
    return { ok: false, reason: "Network error — check connection and try again." };
  }

  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    reason?: string;
    merged?: boolean;
  };
  if (!json.ok) {
    return {
      ok: false,
      reason: json.reason ?? `Link failed (${res.status})`,
    };
  }
  return { ok: true, merged: json.merged };
}

export const PENDING_WALLET_LINK_KEY = "slotto_pending_wallet_link";

export function markPendingWalletLink(): void {
  try {
    sessionStorage.setItem(PENDING_WALLET_LINK_KEY, "1");
  } catch {
    /* private mode */
  }
}

export function consumePendingWalletLink(): boolean {
  try {
    if (sessionStorage.getItem(PENDING_WALLET_LINK_KEY) !== "1") return false;
    sessionStorage.removeItem(PENDING_WALLET_LINK_KEY);
    return true;
  } catch {
    return false;
  }
}
