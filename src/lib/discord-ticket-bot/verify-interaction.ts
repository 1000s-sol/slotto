import { verify } from "@noble/curves/ed25519";

import { discordTicketBotPublicKey } from "./config";

/** Discord interaction request signature (Ed25519). */
export function verifyDiscordInteractionRequest(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
): boolean {
  const publicKeyHex = discordTicketBotPublicKey();
  if (!publicKeyHex || !signatureHeader || !timestampHeader) return false;

  const ageSec = Math.abs(Date.now() / 1000 - Number(timestampHeader));
  if (!Number.isFinite(ageSec) || ageSec > 300) return false;

  try {
    const message = new TextEncoder().encode(timestampHeader + rawBody);
    const sig = hexToBytes(signatureHeader);
    const key = hexToBytes(publicKeyHex);
    if (sig.length !== 64 || key.length !== 32) return false;
    return verify(sig, message, key);
  } catch {
    return false;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
