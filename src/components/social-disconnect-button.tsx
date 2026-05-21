/** Red square disconnect control with white border and X icon. */
export function SocialDisconnectButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-white bg-red-600 text-white transition hover:bg-red-500 disabled:opacity-50"
    >
      <svg
        viewBox="0 0 24 24"
        width={14}
        height={14}
        aria-hidden
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
      >
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  );
}
