const X_URL = "https://x.com/slottogg_";

const xLogoPath =
  "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";

type Props = {
  className?: string;
  iconClassName?: string;
};

export function XSocialLink({
  className = "inline-flex rounded-md p-1 text-accent-cyan transition hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/50",
  iconClassName = "h-5 w-5",
}: Props) {
  return (
    <a
      href={X_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label="Slotto on X"
    >
      <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden fill="currentColor">
        <path d={xLogoPath} />
      </svg>
    </a>
  );
}
