import Image from "next/image";

/** Official Discord Clyde icon (brand asset in /public/brand). */
export function DiscordLogo({
  className,
  size = 20,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <Image
      src="/brand/discord-icon.svg"
      alt=""
      width={size}
      height={Math.round((size * 96.36) / 127.14)}
      className={className}
      aria-hidden
      unoptimized
    />
  );
}
