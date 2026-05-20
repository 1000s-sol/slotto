import {
  discordDisplayLabel,
  discordProfileUrl,
  xProfileUrl,
} from "@/lib/social-profile-url";

export function DiscordProfileTag({ discord }: { discord: string }) {
  const href = discordProfileUrl(discord);
  const label = discordDisplayLabel(discord) ?? discord;
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent-cyan hover:underline"
      >
        {label}
      </a>
    );
  }
  return <span className="text-foreground">{label}</span>;
}

export function XProfileTag({ handle }: { handle: string }) {
  const href = xProfileUrl(handle);
  const label = handle.startsWith("@") ? handle : `@${handle}`;
  return (
    <a
      href={href ?? `https://x.com/${handle.replace(/^@/, "")}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent-cyan hover:underline"
    >
      {label}
    </a>
  );
}
