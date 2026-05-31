/**
 * URL safety for admin-supplied fields. Blocks dangerous schemes
 * (`javascript:`, `data:`, `vbscript:`, `file:`) that would otherwise be stored
 * and later emitted into `<a href>` / `<img src>`. Allows `http(s)://` URLs and
 * site-relative paths (e.g. uploaded image paths like `/uploads/…`). We allow
 * plain `http` so editing legacy listings never fails — the XSS risk is the
 * scheme, not the lack of TLS.
 */
export function isSafeHttpsOrRelativeUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  // Site-relative path (but not protocol-relative "//host").
  if (v.startsWith("/") && !v.startsWith("//")) return true;
  try {
    const proto = new URL(v).protocol;
    return proto === "https:" || proto === "http:";
  } catch {
    return false;
  }
}

/**
 * Validate an optional URL form field. Empty → `{ url: null }`. Non-empty must
 * be an http(s) link (or a site-relative path) or it returns an error message.
 */
export function sanitizeOptionalUrl(
  value: string | null | undefined,
  label: string,
): { url: string | null; error?: string } {
  const v = (value ?? "").trim();
  if (!v) return { url: null };
  if (isSafeHttpsOrRelativeUrl(v)) return { url: v };
  return { url: null, error: `${label} must be an http(s):// link.` };
}
