function hueFromWallet(address: string): number {
  let h = 0;
  for (let i = 0; i < address.length; i += 1) {
    h = (h * 31 + address.charCodeAt(i)) % 360;
  }
  return h;
}

export function WalletAvatar({
  address,
  size = 64,
}: {
  address: string;
  size?: number;
}) {
  const hue = hueFromWallet(address);
  const dim = `${size}px`;
  return (
    <div
      className="shrink-0 rounded-full ring-2 ring-accent-gold/40"
      style={{
        width: dim,
        height: dim,
        background: `linear-gradient(135deg, hsl(${hue} 65% 42%), hsl(${(hue + 48) % 360} 70% 28%))`,
      }}
      aria-hidden
    />
  );
}
